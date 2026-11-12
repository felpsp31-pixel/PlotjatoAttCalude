import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearPasswordCache } from '@/lib/passwordCache';
import { esquecerSessaoSistema, sairFinanceiro } from '@/lib/sessaoFinanceiro';

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24h (1 dia)
const SESSION_KEY = 'app_session';
/** Tolerância máxima, sem internet, depois que a sessão venceu. */
const OFFLINE_EXTRA = 24 * 60 * 60 * 1000;

interface AuthContextType {
  authenticated: boolean;
  loading: boolean;
  login: (password: string) => Promise<boolean>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  authenticated: false,
  loading: true,
  login: async () => false,
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { expiresAt } = JSON.parse(raw);
    // Sem internet não dá para entrar de novo, então a sessão ganha até
    // mais um dia de tolerância (senão o balcão ficaria sem emitir recibo).
    const tolerancia = navigator.onLine === false ? OFFLINE_EXTRA : 0;
    if (Date.now() > expiresAt + tolerancia) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { expiresAt };
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

/** Usuário da última sessão guardada pelo Supabase, lida sem ir ao servidor. */
const usuarioGuardado = (): { is_anonymous?: boolean; app_metadata?: { papel?: string } } | null => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (!chave || !/^sb-.+-auth-token$/.test(chave)) continue;
      const salvo = JSON.parse(localStorage.getItem(chave) || 'null');
      return salvo?.user ?? salvo?.currentSession?.user ?? null;
    }
  } catch { /* ignore */ }
  return null;
};

const setSession = () => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ expiresAt: Date.now() + SESSION_TIMEOUT }));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const signOut = useCallback(async () => {
    localStorage.removeItem(SESSION_KEY);
    esquecerSessaoSistema();
    clearPasswordCache();
    setAuthenticated(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch { /* ignore */ }
  }, []);

  const scheduleExpiry = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!authenticated) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const { expiresAt } = JSON.parse(raw);
      const remaining = Number(expiresAt) - Date.now();
      // Vencendo sem internet, só sai quando a conexão voltar.
      const expirar = () => {
        if (navigator.onLine === false && Date.now() < Number(expiresAt) + OFFLINE_EXTRA) {
          window.addEventListener('online', () => signOut(), { once: true });
          timeoutRef.current = setTimeout(signOut, Number(expiresAt) + OFFLINE_EXTRA - Date.now());
        } else signOut();
      };
      if (remaining <= 0) {
        expirar();
      } else {
        timeoutRef.current = setTimeout(expirar, remaining);
      }
    } catch { /* ignore */ }
  }, [authenticated, signOut]);

  useEffect(() => {
    const restore = async () => {
      // So vale a sessao do usuario do sistema (a anonima foi desligada).
      const session = getSession();
      let valida = false;
      if (session) {
        try {
          // Sem internet o Supabase fica até meio minuto tentando renovar o
          // acesso antes de desistir. A sessão continua guardada e é renovada
          // quando a conexão volta, então offline vale a guardada direto.
          const offline = navigator.onLine === false;
          const user = offline ? usuarioGuardado() : (await supabase.auth.getSession()).data.session?.user;
          valida = !!user && !user.is_anonymous && ['sistema', 'financeiro'].includes(user.app_metadata?.papel ?? '');
          // Sessao do Financeiro que sobrou de uma aba fechada: tenta voltar para
          // a do sistema; se nao houver, pede a senha de acesso de novo.
          if (valida && !offline && user?.app_metadata?.papel === 'financeiro' && !sessionStorage.getItem('financial_auth')) {
            valida = await sairFinanceiro();
          }
        } catch { /* ignore */ }
      }
      if (!valida) {
        localStorage.removeItem(SESSION_KEY);
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
      }
      setAuthenticated(valida);
      setLoading(false);
    };
    restore();
    // Sessao expirada ou revogada no servidor: volta para a tela de senha.
    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT') {
        localStorage.removeItem(SESSION_KEY);
        setAuthenticated(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    scheduleExpiry();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [authenticated, scheduleExpiry]);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const normalizedPassword = password.trim();
      if (!normalizedPassword) return false;

      // A senha e conferida no servidor, que devolve a sessao do usuario do
      // sistema. Sem ela o banco nao libera nada.
      const { data, error } = await supabase.functions.invoke('validate-password', {
        body: { password: normalizedPassword, type: 'access_password' },
      });
      if (error || !data?.valid || !data.session) return false;
      const { error: sessErr } = await supabase.auth.setSession(data.session);
      if (sessErr) return false;
      setSession();
      setAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, loading, login, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
