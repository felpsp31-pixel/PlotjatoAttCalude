import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// As janelas (Dialog) bloqueiam cliques no resto da pagina enquanto estao
// abertas, pondo pointer-events: none no <body>. Se a tela muda no mesmo
// instante em que a janela fecha, esse bloqueio pode sobrar e nada mais
// responde ate um F5. A cada troca de tela, se nao ha janela aberta,
// removemos o bloqueio que tiver ficado.
const DestravarTela = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const t = setTimeout(() => {
      const aberta = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"]',
      );
      if (!aberta && document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = '';
      }
    }, 400);
    return () => clearTimeout(t);
  }, [pathname]);
  return null;
};

export default DestravarTela;
