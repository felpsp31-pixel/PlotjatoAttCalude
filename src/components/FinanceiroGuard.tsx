import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { papelAtual, sairFinanceiro } from '@/lib/sessaoFinanceiro';

const OITO_HORAS = 8 * 60 * 60 * 1000;

// Libera o Financeiro so com o token desta aba (8h) E a sessao do usuario
// "financeiro". Vencido o prazo, volta para a sessao do sistema.
const FinanceiroGuard = () => {
  const [estado, setEstado] = useState<'checando' | 'ok' | 'negado'>('checando');

  useEffect(() => {
    let vivo = true;
    (async () => {
      let tokenValido = false;
      try {
        const [module, ts] = atob(sessionStorage.getItem('financial_auth') ?? '').split(':');
        tokenValido = module === 'financial' && Date.now() - Number(ts) < OITO_HORAS;
      } catch { /* token invalido */ }
      const ok = tokenValido && (await papelAtual()) === 'financeiro';
      if (!ok) await sairFinanceiro();
      if (vivo) setEstado(ok ? 'ok' : 'negado');
    })();
    return () => { vivo = false; };
  }, []);

  if (estado === 'checando') return null;
  if (estado === 'negado') return <Navigate to="/" replace />;
  return <Outlet />;
};

export default FinanceiroGuard;
