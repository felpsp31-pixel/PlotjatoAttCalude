import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { exigirSistema } from "../_shared/auth.ts";

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

const INSTRUCAO = `Você recebe uma mensagem informal de um cliente de uma
gráfica de plantas e projetos (WhatsApp, e-mail ou anotação) e extrai o
pedido dela.

Regras:
- Use SOMENTE o que está escrito. Não invente nada: o que não estiver claro é null.
- "servico" deve ser copiado EXATAMENTE de uma das opções da lista fornecida.
  Se nada na lista corresponder, use null — não escolha o mais parecido.
- "responsavel" idem: exatamente um nome da lista, ou null.
- "prazo" em YYYY-MM-DD. Resolva datas relativas ("hoje", "amanhã", "sexta",
  "semana que vem") a partir da data de hoje informada. Sem prazo citado, null.
- "hora" no formato HH:MM, 24 horas, só o horário do prazo:
  - horário explícito manda: "até as 14h" -> "14:00"; "9h30" -> "09:30";
    "meio-dia" -> "12:00"; "até as 5 da tarde" -> "17:00".
  - período sem hora exata: "de manhã" -> "09:00"; "à tarde" -> "14:00";
    "fim do dia"/"antes de fechar" -> "17:00"; "começo do dia" -> "08:00".
  - nada sobre horário: null.
- "prioridade", exatamente um destes quatro valores:
  - "urgente": precisa hoje, ou a pessoa diz que é urgente, emergência, "pra
    já", "pra ontem", "to precisando agora".
  - "alta": tem pressa declarada mas com prazo — "o quanto antes", "corre
    comigo", prazo para amanhã.
  - "baixa": a pessoa diz que não tem pressa, "quando der", "sem correria".
  - "media": o resto, inclusive quando não há sinal nenhum de urgência.
- "telefone": só dígitos, com DDD, se aparecer na mensagem.
- "descricao": o que foi pedido, em uma ou duas frases objetivas, incluindo
  quantidades, formatos e cores citados.
- "cliente": a empresa ou pessoa que está pedindo. Se a mensagem só trouxer o
  nome de quem escreveu, use esse nome.

Responda SOMENTE com JSON válido, sem cercas de código e sem texto em volta:
{"cliente":"...","telefone":"...","email":"...","servico":"...","descricao":"...","prazo":"2026-11-10","hora":"14:00","responsavel":"...","prioridade":"media"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const negado = await exigirSistema(req, corsHeaders);
  if (negado) return negado;

  try {
    const { texto, servicos, responsaveis, hoje } = await req.json();

    if (typeof texto !== "string" || texto.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Cole a mensagem do cliente para eu interpretar." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // Mensagem de WhatsApp nao passa disso; o corte evita mandar um arquivo
    // inteiro colado por engano e estourar a cota a toa.
    if (texto.length > 8000) {
      return new Response(
        JSON.stringify({ error: "Texto longo demais. Cole só a mensagem do pedido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY nao configurada");

    const listaServicos = Array.isArray(servicos) ? servicos.slice(0, 200) : [];
    const listaResp = Array.isArray(responsaveis) ? responsaveis.slice(0, 100) : [];

    const contexto = [
      `Data de hoje: ${typeof hoje === "string" ? hoje : new Date().toISOString().slice(0, 10)}`,
      `Serviços disponíveis: ${listaServicos.length ? listaServicos.join(" | ") : "(nenhum cadastrado)"}`,
      `Responsáveis: ${listaResp.length ? listaResp.join(" | ") : "(nenhum cadastrado)"}`,
      "",
      "Mensagem recebida:",
      texto,
    ].join("\n");

    const response = await callGemini(GEMINI_API_KEY, {
      contents: [{ parts: [{ text: `${INSTRUCAO}\n\n${contexto}` }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      const mensagens: Record<number, string> = {
        429: "Cota da IA esgotada. O detalhe diz se o limite e por minuto, por dia, ou se o modelo nao tem camada gratuita (limit: 0).",
        403: "Chave da IA invalida ou sem permissao. Verifique a GEMINI_API_KEY.",
        404: "Nenhum modelo de IA compativel esta disponivel para esta chave.",
        503: "A IA do Google esta sobrecarregada agora (fila da camada gratuita). Tente de novo em alguns minutos.",
      };
      return new Response(
        JSON.stringify({
          error: mensagens[response.status] ?? "Erro ao interpretar a mensagem.",
          detail: `[${response.status}] ${resumoDoErro(errorText)}`,
          modelo: modeloEmUso,
        }),
        { status: response.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
      return new Response(
        JSON.stringify({ error: "Nao consegui entender essa mensagem. Tente colar só o trecho do pedido." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const texto_ou_null = (v: unknown) =>
      typeof v === "string" && v.trim() ? v.trim() : null;

    // Servico e responsavel so passam se existirem mesmo na lista: o modelo
    // as vezes devolve algo parecido, e um valor inventado viraria um campo
    // que nao casa com nada no formulario.
    const daLista = (v: unknown, lista: string[]) => {
      const s = texto_ou_null(v);
      if (!s) return null;
      return lista.find((x) => x.toLowerCase() === s.toLowerCase()) ?? null;
    };

    const prazo = texto_ou_null(parsed.prazo);
    const prioridade = texto_ou_null(parsed.prioridade)?.toLowerCase();

    // Hora so passa se for HH:MM plausivel: "14:00" vale, "25:70" e "14h"
    // nao. O formulario cai no padrao quando vier null.
    const horaBruta = texto_ou_null(parsed.hora);
    const mh = horaBruta?.match(/^(\d{1,2}):(\d{2})$/);
    const hora = mh && Number(mh[1]) <= 23 && Number(mh[2]) <= 59
      ? `${mh[1].padStart(2, "0")}:${mh[2]}`
      : null;

    return new Response(
      JSON.stringify({
        cliente: texto_ou_null(parsed.cliente),
        telefone: texto_ou_null(parsed.telefone)?.replace(/\D/g, "") || null,
        email: texto_ou_null(parsed.email),
        servico: daLista(parsed.servico, listaServicos),
        descricao: texto_ou_null(parsed.descricao),
        prazo: prazo && /^\d{4}-\d{2}-\d{2}$/.test(prazo) ? prazo : null,
        hora,
        responsavel: daLista(parsed.responsavel, listaResp),
        // Os quatro valores do formulario. Validar contra tres rebaixava
        // "urgente" para "media" sem ninguem perceber.
        prioridade: ["urgente", "alta", "media", "baixa"].includes(prioridade ?? "")
          ? prioridade : "media",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("interpretar-demanda error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
