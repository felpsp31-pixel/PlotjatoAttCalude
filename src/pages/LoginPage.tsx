import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { prewarmValidatePassword } from '@/lib/prewarm';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(() =>
    parseInt(sessionStorage.getItem('login_attempts') ?? '0', 10)
  );
  const [blocked, setBlocked] = useState(() =>
    sessionStorage.getItem('login_blocked') === 'true'
  );
  const [remainingTime, setRemainingTime] = useState(() => {
    const until = parseInt(sessionStorage.getItem('login_blocked_until') ?? '0', 10);
    const diff = Math.ceil((until - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    prewarmValidatePassword();
  }, []);

  useEffect(() => {
    if (!blocked) return;

    const storedUntil = parseInt(sessionStorage.getItem('login_blocked_until') ?? '0', 10);
    const isNewBlock = storedUntil === 0 || storedUntil <= Date.now();

    if (isNewBlock) {
      const until = Date.now() + 600_000;
      sessionStorage.setItem('login_blocked', 'true');
      sessionStorage.setItem('login_blocked_until', String(until));
      setRemainingTime(600);
    } else {
      const diff = Math.ceil((storedUntil - Date.now()) / 1000);
      setRemainingTime(diff > 0 ? diff : 0);
    }

    const interval = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setBlocked(false);
          setAttempts(0);
          sessionStorage.removeItem('login_blocked');
          sessionStorage.removeItem('login_blocked_until');
          sessionStorage.removeItem('login_attempts');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [blocked]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    const normalizedPassword = password.trim();
    if (!normalizedPassword) return;

    setLoading(true);
    try {
      const ok = await login(normalizedPassword);
      if (ok) {
        const token = btoa(`system:${Date.now()}:${Math.random().toString(36).slice(2)}`);
        sessionStorage.setItem('system_auth', token);
        navigate('/');
      } else {
        setError(true);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        sessionStorage.setItem('login_attempts', String(newAttempts));
        if (newAttempts >= 3) {
          setBlocked(true);
          toast.error('Acesso bloqueado por 10 minutos após 3 tentativas incorretas.');
        }
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/logo.png"
            alt="Logo Plotjato"
            className="h-20 sm:h-28 w-auto object-contain"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mt-3">Plotjato</h1>
          <p className="text-sm text-muted-foreground mt-1">Sistema de Gestão</p>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 border border-border">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Digite a senha de acesso"
                  className="pl-9 text-base"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  autoFocus
                  disabled={blocked}
                />
              </div>
              {error && !blocked && <p className="text-sm text-destructive">Senha incorreta</p>}
            </div>
            <Button type="submit" className="w-full min-h-[44px]" disabled={loading || blocked}>
              {blocked
                ? `Bloqueado — aguarde ${formatTime(remainingTime)}`
                : loading ? 'Verificando...' : 'Entrar'}
            </Button>
            {blocked && (
              <p className="text-sm text-destructive text-center">
                Muitas tentativas incorretas. Tente novamente em {formatTime(remainingTime)}.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
