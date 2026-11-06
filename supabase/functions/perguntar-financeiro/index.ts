import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
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

// Teto de linhas enviadas ao modelo. Mandar o banco inteiro encareceria a
// chamada e passaria do limite por minuto da camada gratuita sem necessidade.
const MAX_LANCAMENTOS = 1200;

const INSTRUCAO = `Você é o assistente financeiro da Plotjato, uma gráfica de
plantas e projetos em Belo Horizonte. Responde ao dono da empresa, em
português do Brasil.

Como responder:
- Use APENAS os lançamentos fornecidos. Nunca invente número, cliente ou data.
- Se os dados não bastarem para responder, diga isso em uma frase e explique o
  que falta. Não estime, não arredonde para parecer completo.
- Valores em reais no formato R$ 1.234,56. Datas em DD/MM/AAAA.
- Seja direto: comece pela resposta, depois o detalhe que a sustenta.
- Duas a cinco frases, ou uma lista curta quando a pergunta pedir vários itens.
- Quando citar um total, diga de quantos lançamentos ele vem.
- "em aberto" = status open. "atrasado" = status overdue. "pago" = status paid.
- Não dê conselho jurídico nem contábil; se perguntarem isso, diga que é com o
  contador e responda só a parte factual.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const negado = await exigirSistema(req, corsHeaders);
  if (negado) return negado;

  try {
    const { pergunta } = await req.json();

    if (typeof pergunta !== "string" || pergunta.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: "Escreva a pergunta." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (pergunta.length > 1000) {
      return new Response(
        JSON.stringify({ error: "Pergunta longa demais." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY nao configurada");

    // Service role: a funcao le os dados ela mesma, em vez de confiar num
    // recorte vindo do navegador.
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const [lanc, forn] = await Promise.all([
      db.from("financial_invoices")
        .select("entity_name, entity_type, description, value, due_date, reference_month, status")
        .order("due_date", { ascending: false })
        .limit(MAX_LANCAMENTOS),
      db.from("suppliers").select("name").limit(300),
    ]);

    if (lanc.error) throw lanc.error;

    const linhas = lanc.data ?? [];
    if (linhas.length === 0) {
      return new Response(
        JSON.stringify({ resposta: "Ainda não há lançamentos no Financeiro para eu consultar." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // CSV em vez de JSON: mesma informacao com bem menos caractere repetido,
    // o que deixa a chamada mais barata e mais rapida.
    const csv = [
      "cliente;tipo;descricao;valor;vencimento;mes_ref;status",
      ...linhas.map((l) => [
        l.entity_name, l.entity_type,
        String(l.description ?? "").replace(/[;\n]/g, " "),
        l.value, l.due_date, l.reference_month, l.status,
      ].join(";")),
    ].join("\n");

    const hoje = new Date().toISOString().slice(0, 10);
    const fornecedores = (forn.data ?? []).map((f: { name: string }) => f.name);

    const contexto = [
      `Data de hoje: ${hoje}`,
      linhas.length === MAX_LANCAMENTOS
        ? `ATENÇÃO: são os ${MAX_LANCAMENTOS} lançamentos mais recentes por vencimento; pode haver outros mais antigos fora desta lista. Avise se a pergunta depender disso.`
        : `Total de lançamentos: ${linhas.length} (base completa).`,
      fornecedores.length
        ? `Estes nomes são fornecedores (saída de dinheiro), o resto é cliente: ${fornecedores.join(" | ")}`
        : "Não há fornecedores cadastrados.",
      "",
      "Lançamentos:",
      csv,
      "",
      `Pergunta: ${pergunta}`,
    ].join("\n");

    const response = await callGemini(GEMINI_API_KEY, {
      contents: [{ parts: [{ text: `${INSTRUCAO}\n\n${contexto}` }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
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
          error: mensagens[response.status] ?? "Erro ao consultar a IA.",
          detail: `[${response.status}] ${resumoDoErro(errorText)}`,
          modelo: modeloEmUso,
        }),
        { status: response.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const resposta: string = (data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "").join("") ?? "").trim();

    if (!resposta) {
      return new Response(
        JSON.stringify({ error: "A IA não devolveu resposta. Tente reformular a pergunta." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ resposta, lancamentos_consultados: linhas.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("perguntar-financeiro error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
