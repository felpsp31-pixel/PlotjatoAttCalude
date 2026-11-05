import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-flash";

const SYSTEM_PROMPT = `Extraia da nota fiscal brasileira (NFS-e) os seguintes dados:
1. Valor Líquido da NFS-e (campo 'Valor Líquido da NFS-e', já descontado ISSQN retido — nunca usar o Valor do Serviço bruto)
2. Data de vencimento no formato YYYY-MM-DD (geralmente na descrição do serviço como 'VENCIMENTO DD/MM/AAAA')
3. ISSQN retido (número decimal, ou null se não houver retenção)
4. Nome do tomador do serviço
5. Número da NFS-e
Se não encontrar algum campo, use null. Responda SOMENTE em JSON válido, sem texto adicional:
{"valor_liquido": 700.48, "vencimento": "2025-03-10", "issqn_retido": 17.52, "tomador": "NOME DA EMPRESA", "numero_nfse": "200"}`;

// O Gemini responde 503 UNAVAILABLE quando o modelo esta sobrecarregado, o
// que e comum na camada gratuita. Nesses casos vale reenviar: costuma passar
// na segunda tentativa. 429 (cota por minuto) segue a mesma logica.
async function callGemini(apiKey: string, body: unknown): Promise<Response> {
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  let last: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return r;
    // 429 e cota estourada: insistir nao ajuda e so prende o usuario esperando.
    if (r.status !== 503) return r;
    last = r;
    if (attempt < 2) await new Promise((res) => setTimeout(res, 1500 * (attempt + 1)));
  }
  return last as Response;
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
        404: `Modelo "${GEMINI_MODEL}" nao encontrado para esta chave. Troque o secret GEMINI_MODEL.`,
      };
      return new Response(
        JSON.stringify({
          error: mensagens[response.status] ?? "Erro ao processar o PDF com IA.",
          // detalhe do provedor, para diagnostico: nao contem a chave
          detail: `[${response.status}] ${errorText.slice(0, 500)}`,
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
