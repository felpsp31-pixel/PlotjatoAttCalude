import { useSyncExternalStore } from 'react';

const assinar = (aviso: () => void) => {
  window.addEventListener('online', aviso);
  window.addEventListener('offline', aviso);
  return () => {
    window.removeEventListener('online', aviso);
    window.removeEventListener('offline', aviso);
  };
};

/** true com internet; muda sozinho quando a conexão cai ou volta. */
export const useConectado = () =>
  useSyncExternalStore(assinar, () => navigator.onLine, () => true);
