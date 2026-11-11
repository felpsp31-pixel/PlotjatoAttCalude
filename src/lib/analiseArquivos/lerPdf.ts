// Leitura de PDF no navegador com pdf.js. Este módulo só é baixado quando
// alguém clica em Analisar (import dinâmico na tela), então o pdf.js não pesa
// no resto do sistema. Nada é enviado para fora: o arquivo é lido na memória.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import { fracaoTinta } from './tinta';

GlobalWorkerOptions.workerSrc = workerUrl;

const PT_PARA_MM = 25.4 / 72;
export interface PaginaLida {
  pagina: number;
  larguraMm: number;
  alturaMm: number;
  /** % de tinta medido, sem o desconto do navegador. */
  preenchimentoBruto: number;
}

export class LeituraCancelada extends Error {
  constructor() {
    super('Leitura cancelada');
    this.name = 'LeituraCancelada';
  }
}

export async function lerPdf(
  arquivo: File,
  opcoes: { signal?: AbortSignal; aoLerPagina?: (pagina: number, total: number) => void } = {},
): Promise<PaginaLida[]> {
  const { signal, aoLerPagina } = opcoes;
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tarefa = getDocument({ data: dados });
  const abortar = () => void tarefa.destroy();
  signal?.addEventListener('abort', abortar);
  try {
    const doc = await tarefa.promise;
    const paginas: PaginaLida[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('O navegador não liberou o desenho da página.');

    for (let n = 1; n <= doc.numPages; n++) {
      if (signal?.aborted) throw new LeituraCancelada();
      const pagina = await doc.getPage(n);
      const [x0, y0, x1, y1] = pagina.view;
      const viewport = pagina.getViewport({ scale: 1 }); // 1 ponto = 1 pixel = 72 DPI
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvas, canvasContext: ctx, viewport }).promise;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      paginas.push({
        pagina: n,
        larguraMm: (x1 - x0) * PT_PARA_MM,
        alturaMm: (y1 - y0) * PT_PARA_MM,
        preenchimentoBruto: fracaoTinta(data) * 100,
      });
      pagina.cleanup();
      aoLerPagina?.(n, doc.numPages);
    }
    // Libera a memória do desenho antes do próximo arquivo.
    canvas.width = 0;
    canvas.height = 0;
    await doc.destroy();
    return paginas;
  } catch (e) {
    if (signal?.aborted) throw new LeituraCancelada();
    throw traduzirErro(e);
  } finally {
    signal?.removeEventListener('abort', abortar);
  }
}

function traduzirErro(e: unknown): Error {
  const nome = (e as { name?: string })?.name;
  if (nome === 'PasswordException') return new Error('PDF protegido por senha.');
  if (nome === 'InvalidPDFException') return new Error('Arquivo corrompido ou não é um PDF válido.');
  return e instanceof Error ? e : new Error(String(e));
}
