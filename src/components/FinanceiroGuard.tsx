import { Navigate, Outlet } from 'react-router-dom';

const FinanceiroGuard = () => {
  const token = sessionStorage.getItem('financial_auth') ?? '';
  try {
    const decoded = atob(token);
    const [module, ts] = decoded.split(':');
    const age = Date.now() - Number(ts);
    const valid = module === 'financial' && age < 8 * 60 * 60 * 1000;
    if (!valid) return <Navigate to="/" replace />;
  } catch {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

export default FinanceiroGuard;
