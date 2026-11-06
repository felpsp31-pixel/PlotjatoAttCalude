import { supabase } from '@/integrations/supabase/client';

// Os buckets sao privados. Os anexos continuam guardados com o endereco
// "publico" (formato antigo), e na hora de abrir trocamos por um link
// assinado que expira em 1 hora.
const PADRAO = /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/;

export function caminhoDoArquivo(url: string): { bucket: string; caminho: string } | null {
  const m = PADRAO.exec(url);
  if (!m) return null;
  return { bucket: m[1], caminho: decodeURIComponent(m[2]) };
}

export async function urlAssinada(url: string, segundos = 3600): Promise<string> {
  const alvo = caminhoDoArquivo(url);
  if (!alvo) return url; // link externo: usa como esta
  const { data, error } = await supabase.storage.from(alvo.bucket).createSignedUrl(alvo.caminho, segundos);
  if (error || !data?.signedUrl) return url;
  return data.signedUrl;
}
