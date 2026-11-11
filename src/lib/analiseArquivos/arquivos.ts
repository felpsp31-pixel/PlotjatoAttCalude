// Junta os arquivos escolhidos (seletor, pasta ou arrastar) e separa por tipo.

export type TipoArquivo = 'pdf' | 'dwg' | 'outro';

export interface ArquivoEntrada {
  file: File;
  /** Caminho dentro da pasta escolhida (ex.: "Obra X/Estrutura/E-01.pdf"), ou só o nome. */
  caminho: string;
}

export function tipoDoArquivo(nome: string): TipoArquivo {
  const ext = nome.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'dwg') return 'dwg';
  return 'outro';
}

/** Chave para não colocar o mesmo arquivo duas vezes na fila. */
export function chaveArquivo(a: ArquivoEntrada): string {
  return `${a.caminho}|${a.file.size}|${a.file.lastModified}`;
}

export interface Separados {
  pdf: ArquivoEntrada[];
  dwg: ArquivoEntrada[];
  ignorados: number;
}

export function separarPorTipo(entradas: ArquivoEntrada[]): Separados {
  const out: Separados = { pdf: [], dwg: [], ignorados: 0 };
  for (const e of entradas) {
    const t = tipoDoArquivo(e.file.name);
    if (t === 'pdf') out.pdf.push(e);
    else if (t === 'dwg') out.dwg.push(e);
    else out.ignorados++;
  }
  const porCaminho = (a: ArquivoEntrada, b: ArquivoEntrada) => a.caminho.localeCompare(b.caminho, 'pt-BR', { numeric: true });
  out.pdf.sort(porCaminho);
  out.dwg.sort(porCaminho);
  return out;
}

/** Arquivos de um <input type="file">, com ou sem seleção de pasta. */
export function deListaDeArquivos(lista: FileList | null): ArquivoEntrada[] {
  if (!lista) return [];
  return Array.from(lista).map(file => ({ file, caminho: file.webkitRelativePath || file.name }));
}

// Tipos mínimos da API de pastas do arrastar e soltar (FileSystemEntry).
interface Entrada {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}
interface EntradaArquivo extends Entrada {
  file(ok: (f: File) => void, erro?: (e: unknown) => void): void;
}
interface EntradaPasta extends Entrada {
  createReader(): { readEntries(ok: (e: Entrada[]) => void, erro?: (e: unknown) => void): void };
}

async function percorrer(entrada: Entrada, saida: ArquivoEntrada[]): Promise<void> {
  if (entrada.isFile) {
    const file = await new Promise<File>((ok, erro) => (entrada as EntradaArquivo).file(ok, erro));
    saida.push({ file, caminho: entrada.fullPath.replace(/^\//, '') || file.name });
    return;
  }
  if (!entrada.isDirectory) return;
  const leitor = (entrada as EntradaPasta).createReader();
  // readEntries devolve em lotes; precisa chamar até vir vazio.
  for (;;) {
    const lote = await new Promise<Entrada[]>((ok, erro) => leitor.readEntries(ok, erro));
    if (!lote.length) break;
    for (const filho of lote) await percorrer(filho, saida);
  }
}

/** Arquivos e pastas soltos na tela, percorrendo subpastas. */
export async function deArrastar(dados: DataTransfer): Promise<ArquivoEntrada[]> {
  const itens = Array.from(dados.items ?? []);
  const entradas: Entrada[] = [];
  for (const item of itens) {
    if (item.kind !== 'file') continue;
    const entrada = item.webkitGetAsEntry?.() as Entrada | null | undefined;
    if (entrada) entradas.push(entrada);
  }
  if (!entradas.length) return deListaDeArquivos(dados.files);
  const saida: ArquivoEntrada[] = [];
  for (const e of entradas) await percorrer(e, saida);
  return saida;
}
