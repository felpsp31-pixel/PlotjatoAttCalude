import { useEffect, useState } from 'react';

declare const __BUILD_ID__: string;

/** Checagem de rotina, para a janela aberta o dia todo não ficar para trás. */
const INTERVALO_MS = 10 * 60 * 1000;

/**
 * Diz se já existe uma versão publicada mais nova que a desta janela.
 *
 * O app instalado não guarda cópia dos arquivos: ele busca tudo da Vercel a
 * cada abertura. O problema é a janela que fica aberta o dia inteiro no
 * balcão — ela segue rodando o código que carregou de manhã. Este hook
 * compara o build desta janela com o publicado e avisa quando diferem.
 */
export function useAtualizacaoDisponivel(): boolean {
  const [temNova, setTemNova] = useState(false);

  useEffect(() => {
    // Em desenvolvimento o build id muda a cada reinício do servidor e o
    // aviso apareceria à toa.
    if (import.meta.env.DEV) return;

    let vivo = true;

    const checar = async () => {
      // Só quando a janela está à vista: checar em aba escondida gasta
      // requisição e o aviso não seria visto mesmo.
      if (document.visibilityState !== 'visible') return;
      try {
        // no-store e o parâmetro: sem isso o navegador devolveria a própria
        // resposta antiga e a checagem nunca acusaria nada.
        const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const { build } = await r.json();
        if (vivo && typeof build === 'string' && build !== __BUILD_ID__) {
          setTemNova(true);
        }
      } catch {
        // Sem rede ou arquivo fora do ar: silêncio. Um erro aqui não é
        // problema do usuário, e insistir em avisar seria pior que não avisar.
      }
    };

    checar();
    const timer = setInterval(checar, INTERVALO_MS);
    // Voltar para a janela é o momento mais provável de haver versão nova.
    document.addEventListener('visibilitychange', checar);

    return () => {
      vivo = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', checar);
    };
  }, []);

  return temNova;
}
