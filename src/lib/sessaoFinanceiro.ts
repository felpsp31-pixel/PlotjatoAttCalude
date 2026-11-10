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

// Volta para o usuario "sistema" e devolve true. Se nao houver sessao do
// sistema para voltar (aba fechada dentro do Financeiro, por exemplo) e a
// atual for a do financeiro, encerra a sessao nesta maquina e devolve false:
// a senha de acesso sera pedida de novo. A sessao financeira nunca sobra.
export async function sairFinanceiro(): Promise<boolean> {
  sessionStorage.removeItem(FIN_AUTH);
  const raw = sessionStorage.getItem(CHAVE);
  sessionStorage.removeItem(CHAVE);
  if (raw) {
    try {
      const { error } = await supabase.auth.setSession(JSON.parse(raw) as Tokens);
      if (!error) return true;
    } catch { /* cai para o encerramento abaixo */ }
  }
  if ((await papelAtual()) !== 'financeiro') return true;
  await supabase.auth.signOut({ scope: 'local' });
  return false;
}

export function esquecerSessaoSistema(): void {
  sessionStorage.removeItem(CHAVE);
  sessionStorage.removeItem(FIN_AUTH);
}
