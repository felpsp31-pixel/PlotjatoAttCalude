import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Extraia da nota fiscal brasileira (NFS-e) os seguintes dados:
1. Valor Líquido da NFS-e (campo 'Valor Líquido da NFS-e', já descontado ISSQN retido — nunca usar o Valor do Serviço bruto)
2. Data de vencimento no formato YYYY-MM-DD (geralmente na descrição do serviço como 'VENCIMENTO DD/MM/AAAA')
3. ISSQN retido (número decimal, ou null se não houver retenção)
4. Nome do tomador do serviço
5. Número da NFS-e
Se não encontrar algum campo, use null. Responda SOMENTE em JSON válido, sem texto adicional:
{"valor_liquido": 700.48, "vencimento": "2025-03-10", "issqn_retido": 17.52, "tomador": "NOME DA EMPRESA", "numero_nfse": "200"}`;

// Nomes de modelo do Gemini mudam e saem do ar sem aviso. Em vez de chumbar
// um nome e quebrar quando ele sai, a funcao pergunta ao Google quais modelos
// esta chave pode usar e vai descendo a lista ate um responder. O secret
// GEMINI_MODEL continua valendo como primeira escolha, mas deixa de ser
// obrigatorio: sem ele, a funcao se resolve sozinha.
const MODELO_PREFERIDO = Deno.env.get("GEMINI_MODEL") ?? "";
// Lembra entre invocacoes qual modelo respondeu, para nao listar toda vez.
let modeloEmUso: string | null = MODELO_PREFERIDO || null;

const ORDEM: RegExp[] = [
  /^gemini-flash-latest$/,
  /flash/,
  /^gemini-pro-latest$/,
  /pro/,
];

// Primeiro o tipo (flash antes de pro, por velocidade e cota gratuita),
// depois estavel antes de preview/lite, depois a geracao mais nova. Um alias
// sem numero ("gemini-flash-latest") conta como o mais novo de todos.
function nota(n: string) {
  let tier = ORDEM.length;
  for (let i = 0; i < ORDEM.length; i++) {
    if (ORDEM[i].test(n)) { tier = i; break; }
  }
  const m = n.match(/gemini-([0-9]+(?:\.[0-9]+)?)/);
  return {
    tier,
    penal: /lite|preview|exp|thinking/.test(n) ? 1 : 0,
    ver: m ? parseFloat(m[1]) : 99,
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

// 404 = nome de modelo que nao existe mais: troca de modelo e repete.
// 503 = modelo sobrecarregado, comum na camada gratuita: reenviar resolve.
// 429 = cota estourada: insistir nao ajuda e so prende o usuario esperando.
async function callGemini(apiKey: string, body: unknown): Promise<Response> {
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

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (r.ok) {
        if (modelo !== modeloEmUso) console.log(`usando o modelo "${modelo}"`);
        modeloEmUso = modelo;
        return r;
      }
      if (r.status === 404) {
        console.log(`modelo "${modelo}" indisponivel; tentando o proximo`);
        ultima = r;
        break;
      }
      if (r.status !== 503) return r;
      ultima = r;
      if (tentativa < 2) await new Promise((res) => setTimeout(res, 1500 * (tentativa + 1)));
    }
    // Sobrecarga nao se resolve trocando de modelo: para aqui.
    if (ultima && ultima.status === 503) return ultima;
  }

  return ultima ?? new Response(
    JSON.stringify({ error: { message: "Nenhum modelo de IA respondeu." } }),
    { status: 503 },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdf_base64 } = await req.json();

    if (!pdf_base64) {
      return new Response(
        JSON.stringify({ error: "PDF base64 data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const response = await callGemini(GEMINI_API_KEY, {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: "application/pdf", data: pdf_base64 } },
            { text: `${SYSTEM_PROMPT}\n\nExtraia os dados desta nota fiscal NFS-e conforme instruído.` },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      const mensagens: Record<number, string> = {
        429: "Cota da IA esgotada. Veja o detalhe para saber se e por minuto ou por dia.",
        403: "Chave da IA invalida ou sem permissao. Verifique a GEMINI_API_KEY.",
        404: "Nenhum modelo de IA compativel esta disponivel para esta chave.",
      };
      // Em 404 depois da redescoberta, mostra o que a chave realmente tem,
      // para o diagnostico nao depender de adivinhar nomes.
      let disponiveis: string[] | undefined;
      if (response.status === 404) {
        try {
          disponiveis = await listarModelos(GEMINI_API_KEY);
        } catch (e) {
          console.error("ListModels falhou:", e);
        }
      }

      return new Response(
        JSON.stringify({
          error: mensagens[response.status] ?? "Erro ao processar o PDF com IA.",
          // detalhe do provedor, para diagnostico: nao contem a chave
          detail: `[${response.status}] ${errorText.slice(0, 500)}`,
          modelo: modeloEmUso,
          ...(disponiveis?.length ? { modelos_disponiveis: disponiveis } : {}),
        }),
        { status: response.status === 429 ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await response.json();
    const content = aiData.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "";

    // Extract JSON from the response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(jsonStr);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      console.error("Failed to parse AI response as JSON:", content);
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair dados do PDF. Verifique se é uma NFS-e válida." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("extrair-nota error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
