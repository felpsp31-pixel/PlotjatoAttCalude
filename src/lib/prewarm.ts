import { supabase } from '@/integrations/supabase/client';

let warmed = false;

/**
 * Mantém a edge function `validate-password` "quente" para evitar cold-starts
 * (~2s) na primeira validação real de senha.
 * Faz um OPTIONS leve que apenas inicializa o runtime no servidor.
 */
export const prewarmValidatePassword = () => {
  if (warmed) return;
  warmed = true;
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-password`;
    // OPTIONS preflight é o mais leve; apenas dispara o boot do worker.
    fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type, authorization',
      },
    }).catch(() => { /* silent */ });
  } catch { /* ignore */ }
};

// Suprime aviso de import não-usado em ambientes que não chamam supabase aqui
void supabase;
