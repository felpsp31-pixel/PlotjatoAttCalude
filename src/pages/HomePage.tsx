import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { prewarmValidatePassword } from '@/lib/prewarm';
import { FileText, Lock, LogOut, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isPasswordCached, cachePassword } from '@/lib/passwordCache';
import ThemeToggle from '@/components/ThemeToggle';

const HomePage = () => {
  const navigate = useNavigate();
  const { signOut: authSignOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    prewarmValidatePassword();
  }, []);

  const handleFinanceiroAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const cached = await isPasswordCached('financial_password', trimmed);
      if (!cached) {
        const { data, error } = await supabase.functions.invoke('validate-password', {
          body: { password: trimmed, type: 'financial_password' },
        });
        if (error || !data?.valid) {
          setError(true);
          return;
        }
        await cachePassword('financial_password', trimmed);
      }

      const token = btoa(`financial:${Date.now()}:${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem('financial_auth', token);
      setModalOpen(false);
      navigate('/financeiro');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('system_auth');
    sessionStorage.removeItem('financial_auth');
    sessionStorage.removeItem('recibos_auth');
    authSignOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 sm:p-6 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle expanded={false} />
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground min-h-[44px]"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>

      <div className="flex flex-col items-center mb-10">
        <img
          src="/logo.png"
          alt="Logo da empresa"
          className="h-16 sm:h-24 w-auto object-contain"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full">
        <Card className="flex flex-col items-center text-center">
          <CardHeader>
            <ClipboardList className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="text-lg">Demandas</CardTitle>
            <CardDescription>Gestão de demandas, prazos e responsáveis</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full min-h-[44px]" onClick={() => navigate('/demandas')}>Acessar</Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col items-center text-center">
          <CardHeader>
            <FileText className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="text-lg">Emissão Recibos</CardTitle>
            <CardDescription>Emissão de recibos, clientes e serviços</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full min-h-[44px]" onClick={() => navigate('/recibos')}>Acessar</Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col items-center text-center">
          <CardHeader>
            <Lock className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="text-lg">Financeiro</CardTitle>
            <CardDescription>Faturamento geral, notas fiscais e relatórios financeiros</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full min-h-[44px]" onClick={() => setModalOpen(true)}>Acessar</Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Financeiro</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFinanceiroAuth} className="space-y-4">
            <Input
              type="password"
              placeholder="Senha"
              className="text-base"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
            />
            {error && <p className="text-sm text-destructive">Senha incorreta</p>}
            <Button type="submit" className="w-full min-h-[44px]" disabled={loading}>
              {loading ? 'Verificando...' : 'Entrar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
