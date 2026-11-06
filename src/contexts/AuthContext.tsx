import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { clearPasswordCache } from '@/lib/passwordCache';

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24h (1 dia)
const SESSION_KEY = 'app_session';

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
    if (Date.now() > expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return { expiresAt };
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
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
    clearPasswordCache();
    setAuthenticated(false);
    try {
      await supabase.auth.signOut();
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
      if (remaining <= 0) {
        signOut();
      } else {
        timeoutRef.current = setTimeout(signOut, remaining);
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
          const { data } = await supabase.auth.getSession();
          const user = data.session?.user;
          valida = !!user && !user.is_anonymous && user.app_metadata?.papel === 'sistema';
        } catch { /* ignore */ }
      }
      if (!valida) {
        localStorage.removeItem(SESSION_KEY);
        try { await supabase.auth.signOut(); } catch { /* ignore */ }
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
