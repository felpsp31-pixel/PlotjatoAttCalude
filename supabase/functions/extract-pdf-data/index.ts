import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    // Converte em base64 por blocos: espalhar o array inteiro com (...) estoura
    // a pilha em PDFs acima de ~100KB.
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const base64 = btoa(binary);

    // API do Gemini direto no Google (camada gratuita, sem cartão).
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
      method: 'POST',
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                text: `Analise este documento PDF (boleto ou nota fiscal) e extraia as seguintes informações:
1. Valor total (em reais, apenas o número com decimais, ex: 1500.00)
2. Data de vencimento (no formato YYYY-MM-DD)
3. Descrição curta do documento (ex: "NF 1234 - Consultoria" ou "Boleto - Mensalidade")

Responda APENAS em JSON válido com este formato exato:
{
  "value": 1500.00,
  "dueDate": "2026-03-20",
  "description": "NF 1234 - Consultoria"
}

Se não conseguir identificar algum campo, use null para esse campo.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // detalhe do provedor, para diagnostico: nao contem a chave
      throw new Error(`Gemini API error [${response.status}]: ${errorText.slice(0, 400)}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('') || '';

    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(extracted), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error extracting PDF data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
