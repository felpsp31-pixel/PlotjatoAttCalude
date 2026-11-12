import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useConectado } from '@/hooks/useConectado';

const loginDestaAba = () => {
  try {
    const decoded = atob(sessionStorage.getItem('system_auth') ?? '');
    const [module, ts] = decoded.split(':');
    return module === 'system' && Date.now() - Number(ts) < 8 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const SystemGuard = () => {
  const conectado = useConectado();
  const { authenticated, loading } = useAuth();
  if (loginDestaAba()) return <Outlet />;

  // Sem internet não há como digitar a senha (ela é conferida no servidor).
  // Se o aparelho já tem um login válido guardado, deixa entrar para emitir
  // recibo; quando a conexão voltar, a senha é pedida na próxima troca de tela.
  if (!conectado) {
    if (loading) return null;
    if (authenticated) return <Outlet />;
  }
  return <Navigate to="/login" replace />;
};

export default SystemGuard;
