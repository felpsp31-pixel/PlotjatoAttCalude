import { Navigate, Outlet } from 'react-router-dom';

const SystemGuard = () => {
  const token = sessionStorage.getItem('system_auth') ?? '';
  try {
    const decoded = atob(token);
    const [module, ts] = decoded.split(':');
    const age = Date.now() - Number(ts);
    const valid = module === 'system' && age < 8 * 60 * 60 * 1000;
    if (!valid) return <Navigate to="/login" replace />;
  } catch {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

export default SystemGuard;
