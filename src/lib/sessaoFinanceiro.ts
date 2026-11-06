import { supabase } from '@/integrations/supabase/client';

// Ao entrar no Financeiro, o app troca a sessao do usuario "sistema" pela do
// usuario "financeiro" (o unico que o banco deixa ver os dados financeiros).
// A sessao do sistema fica guardada nesta aba para voltar a ela na saida.
const CHAVE = 'sessao_sistema';
const FIN_AUTH = 'financial_auth';

type Tokens = { access_token: string; refresh_token: string };

export async function papelAtual(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous) return null;
  return (user.app_metadata?.papel as string) ?? null;
}

export async function entrarFinanceiro(sessaoFinanceiro: Tokens): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const atual = data.session;
  if (atual && atual.user.app_metadata?.papel === 'sistema') {
    sessionStorage.setItem(CHAVE, JSON.stringify({
      access_token: atual.access_token,
      refresh_token: atual.refresh_token,
    }));
  }
  const { error } = await supabase.auth.setSession(sessaoFinanceiro);
  if (error) return false;
  const token = btoa(`financial:${Date.now()}:${Math.random().toString(36).slice(2)}`);
  sessionStorage.setItem(FIN_AUTH, token);
  return true;
}

// Volta para o usuario "sistema". Se a sessao guardada nao existir mais,
// segue com a do financeiro (que tambem acessa tudo do sistema).
export async function sairFinanceiro(): Promise<void> {
  sessionStorage.removeItem(FIN_AUTH);
  const raw = sessionStorage.getItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
  if (!raw) return;
  try {
    const tokens = JSON.parse(raw) as Tokens;
    await supabase.auth.setSession(tokens);
  } catch { /* mantem a sessao atual */ }
}

export function esquecerSessaoSistema(): void {
  sessionStorage.removeItem(CHAVE);
  sessionStorage.removeItem(FIN_AUTH);
}
