import { Navigate, Outlet, useLocation } from 'react-router-dom';
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

/** Telas liberadas sem a senha da aba, apenas enquanto não há internet. */
const ROTAS_OFFLINE = new Set(['/recibos', '/recibos/orcamento']);

const SystemGuard = () => {
  const conectado = useConectado();
  const { authenticated, loading } = useAuth();
  const { pathname } = useLocation();
  if (loginDestaAba()) return <Outlet />;

  // Sem internet não há como digitar a senha (ela é conferida no servidor).
  // Se o aparelho já tem um login válido guardado, libera só a emissão de
  // recibo e de orçamento. Quando a conexão volta, pede a senha de novo.
  if (!conectado) {
    if (loading) return null;
    if (authenticated) {
      return ROTAS_OFFLINE.has(pathname.replace(/\/+$/, '')) ? <Outlet /> : <Navigate to="/recibos" replace />;
    }
  }
  return <Navigate to="/login" replace />;
};

export default SystemGuard;
