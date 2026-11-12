import { registerSW } from 'virtual:pwa-register';

// Registra a cópia do app no aparelho (service worker), para ele abrir mesmo
// sem internet. A versão nova baixa sozinha em segundo plano, mas só passa a
// valer quando o usuário clica em Atualizar no aviso.

let ativarVersaoNova: ((recarregar?: boolean) => Promise<void>) | undefined;

export function iniciarModoOffline() {
  if (import.meta.env.DEV || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  ativarVersaoNova = registerSW({ immediate: true });
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Troca para a versão publicada mais nova e recarrega a página. */
export async function recarregarComVersaoNova() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && ativarVersaoNova) {
      await reg.update().catch(() => undefined);
      // Dá tempo de a versão nova terminar de baixar.
      const inicio = Date.now();
      while (!reg.waiting && Date.now() - inicio < 15000) {
        if (!reg.installing && Date.now() - inicio > 2000) break;
        await esperar(300);
      }
      if (reg.waiting) {
        await ativarVersaoNova(true); // ativa e recarrega
        return;
      }
    }
  } catch {
    // Sem service worker: o recarregamento comum já busca a versão nova.
  }
  window.location.reload();
}
