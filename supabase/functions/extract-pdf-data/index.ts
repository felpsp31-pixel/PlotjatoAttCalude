import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Nomes de modelo do Gemini mudam e saem do ar sem aviso. Em vez de chumbar
// um nome e quebrar quando ele sai, a funcao pergunta ao Google quais modelos
// esta chave pode usar e vai descendo a lista ate um responder. O secret
// GEMINI_MODEL continua valendo como primeira escolha, mas deixa de ser
// obrigatorio: sem ele, a funcao se resolve sozinha.
const MODELO_PREFERIDO = Deno.env.get('GEMINI_MODEL') ?? '';
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
// sem numero ('gemini-flash-latest') conta como o mais novo de todos.
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
    'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
    { headers: { 'x-goog-api-key': apiKey } },
  );
  if (!r.ok) return [];
  const j = await r.json();
  const nomes: string[] = (j.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m: { name: string }) => m.name.replace('models/', ''))
    .filter((n: string) =>
      !n.includes('embedding') && !n.includes('aqa') && !n.includes('image'));
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
          method: 'POST',
          headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (r.ok) {
        if (modelo !== modeloEmUso) console.log(`usando o modelo '${modelo}'`);
        modeloEmUso = modelo;
        return r;
      }
      if (r.status === 404) {
        console.log(`modelo '${modelo}' indisponivel; tentando o proximo`);
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
    JSON.stringify({ error: { message: 'Nenhum modelo de IA respondeu.' } }),
    { status: 503 },
  );
}

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

    const response = await callGemini(GEMINI_API_KEY, {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: `Analise este documento PDF (boleto ou nota fiscal) e extraia as seguintes informações:
1. Valor total (em reais, apenas o número com decimais, ex: 1500.00)
2. Data de vencimento (no formato YYYY-MM-DD)
3. Descrição curta do documento (ex: "NF 1234 - Consultoria" ou "Boleto - Mensalidade")

Responda APENAS em JSON válido com este formato exato:
{
  "value": 1500.00,
  "dueDate": "2026-03-20",
  "description": "NF 1234 - Consultoria"
}

Se não conseguir identificar algum campo, use null para esse campo.` },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
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
