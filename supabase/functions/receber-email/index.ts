import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// A descoberta de modelo abaixo e identica a das outras funcoes. Esta
// duplicada de proposito: cada funcao e publicada colando um arquivo so no
// painel do Supabase, e um import compartilhado quebraria esse fluxo.
const MODELO_PREFERIDO = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash-lite";
let modeloEmUso: string | null = MODELO_PREFERIDO;

const ORDEM: RegExp[] = [
  /^gemini-flash-lite-latest$/,
  /flash-lite/,
  /^gemini-flash-latest$/,
  /flash/,
  /^gemini-pro-latest$/,
  /pro/,
];

function nota(n: string) {
  let tier = ORDEM.length;
  for (let i = 0; i < ORDEM.length; i++) {
    if (ORDEM[i].test(n)) { tier = i; break; }
  }
  const m = n.match(/^gemini-([0-9]+(?:\.[0-9]+)?)-/);
  return {
    tier,
    penal: /preview|exp|thinking/.test(n) ? 1 : 0,
    ver: n.endsWith("-latest") ? 99 : (m ? parseFloat(m[1]) : 0),
  };
}

async function listarModelos(apiKey: string): Promise<string[]> {
  const r = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200",
    { headers: { "x-goog-api-key": apiKey } },
  );
  if (!r.ok) return [];
  const j = await r.json();
  const nomes: string[] = (j.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m: { name: string }) => m.name.replace("models/", ""))
    .filter((n: string) =>
      !n.includes("embedding") && !n.includes("aqa") && !n.includes("image"));
  return nomes.sort((a, b) => {
    const A = nota(a), B = nota(b);
    return A.tier - B.tier || A.penal - B.penal || B.ver - A.ver ||
      a.localeCompare(b);
  });
}

const PRAZO_MS = 40_000;

async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  const limite = Date.now() + PRAZO_MS;
  const tentados = new Set<string>();
  let candidatos: string[] | null = null;
  let ultima: Response | null = null;

  const proximoModelo = async (): Promise<string | null> => {
    if (modeloEmUso && !tentados.has(modeloEmUso)) return modeloEmUso;
    if (candidatos === null) candidatos = await listarModelos(apiKey);
    return candidatos.find((n) => !tentados.has(n)) ?? null;
  };

  for (let troca = 0; troca < 6; troca++) {
    const modelo = await proximoModelo();
    if (!modelo) break;
    tentados.add(modelo);

    for (let tentativa = 0; tentativa < 2; tentativa++) {
      if (Date.now() > limite) return ultima ?? semResposta(tentados);

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (r.ok) { modeloEmUso = modelo; return r; }
      ultima = r;

      if (r.status === 404) break;

      if (r.status === 503) {
        if (tentativa === 0) {
          await new Promise((res) => setTimeout(res, 700 + Math.random() * 600));
          continue;
        }
        if (modeloEmUso === modelo) modeloEmUso = null;
        break;
      }

      if (r.status === 429) {
        const txt = await r.clone().text();
        if (/"?limit"?:\s*0\b/.test(txt) || /"quotaValue":\s*"0"/.test(txt)) {
          if (modeloEmUso === modelo) modeloEmUso = null;
          break;
        }
        return r;
      }

      return r;
    }
  }
  return ultima ?? semResposta(tentados);
}

function semResposta(tentados: Set<string>): Response {
  return new Response(
    JSON.stringify({ error: { message: `Nenhum modelo respondeu. Tentados: ${[...tentados].join(", ")}.` } }),
    { status: 503 },
  );
}

function resumoDoErro(texto: string): string {
  try {
    const j = JSON.parse(texto);
    const m = j?.error?.message ?? j?.message;
    if (typeof m === "string" && m) return m;
  } catch { /* nao era JSON */ }
  return texto.slice(0, 300);
}

const INSTRUCAO = `Você classifica um e-mail recebido na caixa de entrada de
uma gráfica de plantas e projetos (plotagem, impressão, placas de obra).

Escolha UM tipo:
- "cobranca": alguém está cobrando a gráfica. Boleto, fatura, nota fiscal de
  fornecedor, mensalidade, conta de consumo, aviso de vencimento, recibo a
  pagar. É dinheiro que a gráfica PAGA.
- "demanda": um cliente está pedindo um serviço, pedindo orçamento, mandando
  arquivo para imprimir ou perguntando prazo/preço de um trabalho.
- "ignorar": todo o resto. Propaganda, newsletter, promoção, marketing,
  oferta de produto ou serviço que a gráfica não pediu, aviso automático de
  rede social, confirmação de cadastro, spam, corrente, cobrança de teste.

Regras:
- A lista de serviços cadastrados NÃO decide o tipo. Um cliente pedindo
  qualquer impressão, plotagem, cópia ou acabamento é "demanda", mesmo que o
  serviço não esteja na lista: nesse caso "servico" fica null e pronto.
  Arquivo em anexo com pedido para imprimir é sempre "demanda".
- Na dúvida entre "demanda" e "ignorar", escolha "ignorar" apenas quando NÃO
  houver pedido nenhum: uma oferta comercial recebida não é pedido de cliente.
- Propaganda de fornecedor com preços e boleto de exemplo é "ignorar", não
  "cobranca". Só é cobrança se houver uma dívida real da gráfica.
- Use SOMENTE o que está escrito. O que não estiver claro é null. Não invente
  valor, vencimento nem prazo.
- "motivo": uma frase curta dizendo por que escolheu esse tipo.

Se for "cobranca", preencha "cobranca":
- "fornecedor": quem está cobrando (a empresa, não a pessoa).
- "valor": número em reais, só dígitos e ponto decimal ("1234.50"). Sem
  valor claro, null. Se houver vários, o total a pagar.
- "vencimento": YYYY-MM-DD. Resolva datas relativas pela data de hoje.
- "descricao": o que está sendo cobrado, em poucas palavras.

Se for "demanda", preencha "demanda":
- "cliente": a empresa ou pessoa que está pedindo.
- "telefone": só dígitos, com DDD, se aparecer.
- "servico": copiado EXATAMENTE de uma das opções da lista. Nada parecido:
  se não houver correspondência, null.
- "descricao": o que foi pedido, em uma ou duas frases, com quantidades,
  formatos e cores citados.
- "prazo": YYYY-MM-DD, resolvido pela data de hoje. Sem prazo citado, null.
- "prioridade": "urgente" (precisa hoje, diz que é urgente), "alta" (pressa
  declarada, prazo amanhã), "baixa" (diz que não tem pressa), "media" (resto).

Responda SOMENTE com JSON válido, sem cercas de código e sem texto em volta:
{"tipo":"demanda","motivo":"...","cobranca":null,"demanda":{"cliente":"...","telefone":null,"servico":null,"descricao":"...","prazo":null,"prioridade":"media"}}`;

const texto_ou_null = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // Quem chama e o script do Gmail da empresa, que nao tem login no sistema:
  // a autorizacao e o segredo EMAIL_SECRET, como nos jobs do cron.
  const segredo = Deno.env.get("EMAIL_SECRET") ?? "";
  const enviado = req.headers.get("x-email-secret") ?? "";
  if (!segredo || enviado.length !== segredo.length || enviado !== segredo) {
    return json({ error: "Não autorizado." }, 401);
  }

  try {
    const body = await req.json();
    const gmailId = texto_ou_null(body?.gmail_id);
    if (!gmailId) return json({ error: "gmail_id ausente." }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // O script pode reenviar o mesmo e-mail (nova execucao, falha de rede).
    const { data: jaTem } = await admin
      .from("emails_recebidos").select("id").eq("gmail_id", gmailId).maybeSingle();
    if (jaTem) return json({ duplicado: true });

    const assunto = (texto_ou_null(body?.assunto) ?? "").slice(0, 300);
    const corpo = (texto_ou_null(body?.corpo) ?? "").slice(0, 6000);
    const remetente = (texto_ou_null(body?.nome) ?? "").slice(0, 200);
    const remetenteEmail = (texto_ou_null(body?.de) ?? "").toLowerCase().slice(0, 200);
    const anexos = Array.isArray(body?.anexos) ? body.anexos.slice(0, 20) : [];
    const recebidoEm = texto_ou_null(body?.recebido_em) ?? new Date().toISOString();

    const [{ data: servicos }, { data: clientes }, { data: fornecedores }] = await Promise.all([
      admin.from("servicos").select("description").limit(200),
      admin.from("clientes").select("id, name, email").limit(500),
      admin.from("suppliers").select("id, name, email").limit(500),
    ]);
    const listaServicos = (servicos ?? []).map((s) => s.description as string);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY nao configurada");

    const hoje = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());

    const contexto = [
      `Data de hoje: ${hoje}`,
      `Serviços disponíveis: ${listaServicos.length ? listaServicos.join(" | ") : "(nenhum cadastrado)"}`,
      "",
      `De: ${remetente} <${remetenteEmail}>`,
      `Assunto: ${assunto}`,
      anexos.length ? `Anexos: ${anexos.map((a: { nome?: string }) => a?.nome ?? "").join(", ")}` : "Anexos: (nenhum)",
      "",
      "Corpo:",
      corpo,
    ].join("\n");

    const response = await callGemini(GEMINI_API_KEY, {
      contents: [{ parts: [{ text: `${INSTRUCAO}\n\n${contexto}` }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      return json({
        error: "Não consegui classificar este e-mail agora.",
        detail: `[${response.status}] ${resumoDoErro(errorText)}`,
      }, response.status === 429 ? 429 : 500);
    }

    const data = await response.json();
    const content: string = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    let bruto = content.trim();
    const cerca = bruto.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (cerca) bruto = cerca[1].trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(bruto);
    } catch {
      console.error("Resposta nao era JSON:", content.slice(0, 300));
      return json({ error: "Resposta da IA ilegível." }, 422);
    }

    const tipo = ["cobranca", "demanda", "ignorar"].includes(String(parsed.tipo))
      ? String(parsed.tipo)
      : "ignorar";

    // Casa o remetente com um cadastro: primeiro pelo e-mail, que e exato;
    // depois pelo nome, que a IA leu do texto.
    const achar = (
      lista: { id: string; name: string; email: string | null }[] | null,
      nome: string | null,
    ) => {
      const l = lista ?? [];
      const porEmail = remetenteEmail
        ? l.find((e) => (e.email ?? "").toLowerCase().trim() === remetenteEmail)
        : undefined;
      if (porEmail) return porEmail;
      const n = (nome ?? "").toLowerCase().trim();
      return n ? l.find((e) => (e.name ?? "").toLowerCase().trim() === n) : undefined;
    };

    const data_iso = (v: unknown) => {
      const s = texto_ou_null(v);
      return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    };

    let dados: Record<string, unknown> = {};
    if (tipo === "cobranca") {
      const c = (parsed.cobranca ?? {}) as Record<string, unknown>;
      const nome = texto_ou_null(c.fornecedor) ?? remetente;
      const achado = achar(fornecedores as never, nome);
      const valor = Number(String(c.valor ?? "").replace(/[^\d.]/g, ""));
      dados = {
        fornecedor: nome,
        fornecedor_id: achado?.id ?? null,
        valor: Number.isFinite(valor) && valor > 0 ? valor : null,
        vencimento: data_iso(c.vencimento),
        descricao: texto_ou_null(c.descricao) ?? assunto,
      };
    } else if (tipo === "demanda") {
      const d = (parsed.demanda ?? {}) as Record<string, unknown>;
      const nome = texto_ou_null(d.cliente) ?? remetente;
      const achado = achar(clientes as never, nome);
      const servico = texto_ou_null(d.servico);
      const prioridade = String(texto_ou_null(d.prioridade) ?? "media").toLowerCase();
      dados = {
        cliente: achado?.name ?? nome,
        cliente_id: achado?.id ?? null,
        telefone: texto_ou_null(d.telefone)?.replace(/\D/g, "") || null,
        servico: servico
          ? listaServicos.find((s) => s.toLowerCase() === servico.toLowerCase()) ?? null
          : null,
        descricao: texto_ou_null(d.descricao) ?? assunto,
        prazo: data_iso(d.prazo),
        prioridade: ["urgente", "alta", "baixa", "media"].includes(prioridade) ? prioridade : "media",
      };
    }

    const { error: insErr } = await admin.from("emails_recebidos").insert({
      gmail_id: gmailId,
      recebido_em: recebidoEm,
      remetente,
      remetente_email: remetenteEmail,
      assunto,
      resumo: corpo.slice(0, 1500),
      anexos,
      link: texto_ou_null(body?.link),
      tipo,
      motivo: texto_ou_null(parsed.motivo),
      dados,
    });
    if (insErr) throw insErr;

    return json({ tipo, gravado: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Erro ao processar o e-mail." }, 500);
  }
});
