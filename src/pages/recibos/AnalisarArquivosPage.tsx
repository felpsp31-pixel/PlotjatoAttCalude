import { Fragment, useMemo, useRef, useState } from 'react';
import { FileWarning, FolderOpen, FileUp, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  chaveArquivo, deArrastar, deListaDeArquivos, separarPorTipo, type ArquivoEntrada,
} from '@/lib/analiseArquivos/arquivos';
import {
  classificarFolha, corrigirPreenchimento, formatarCm, rotuloFormato, LIMITE_PREENCHIMENTO,
} from '@/lib/analiseArquivos/regras';
import { resumir, type ArquivoAnalisado, type FolhaAnalisada } from '@/lib/analiseArquivos/resumo';

// Lê formato e preenchimento de PDFs direto no navegador. Os arquivos não são
// enviados para o Supabase: tudo acontece na memória desta aba.

interface Progresso {
  arquivo: number;
  totalArquivos: number;
  nome: string;
  pagina: number;
  totalPaginas: number;
}

const formatarPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const separarCaminho = (caminho: string) => {
  const i = caminho.lastIndexOf('/');
  return i < 0 ? { pasta: '', nome: caminho } : { pasta: caminho.slice(0, i + 1), nome: caminho.slice(i + 1) };
};

const AnalisarArquivosPage = () => {
  const [fila, setFila] = useState<ArquivoEntrada[]>([]);
  const [dwgs, setDwgs] = useState<ArquivoEntrada[]>([]);
  const [ignorados, setIgnorados] = useState(0);
  const [resultados, setResultados] = useState<ArquivoAnalisado[]>([]);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const chaves = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const inputArquivos = useRef<HTMLInputElement>(null);
  const inputPasta = useRef<HTMLInputElement>(null);

  const analisando = progresso !== null;
  const resumo = useMemo(() => resumir(resultados), [resultados]);

  const adicionar = (entradas: ArquivoEntrada[]) => {
    const novas = entradas.filter(e => !chaves.current.has(chaveArquivo(e)));
    novas.forEach(e => chaves.current.add(chaveArquivo(e)));
    const sep = separarPorTipo(novas);
    if (sep.pdf.length) setFila(f => [...f, ...sep.pdf]);
    if (sep.dwg.length) setDwgs(d => [...d, ...sep.dwg]);
    if (sep.ignorados) setIgnorados(n => n + sep.ignorados);
    const repetidos = entradas.length - novas.length;
    if (!sep.pdf.length && !sep.dwg.length && entradas.length) {
      toast.info(repetidos ? 'Esses arquivos já estão na lista.' : 'Nenhum PDF encontrado.');
    }
  };

  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    adicionar(deListaDeArquivos(e.target.files));
    e.target.value = '';
  };

  const aoSoltar = async (e: React.DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    if (analisando) return;
    try {
      adicionar(await deArrastar(e.dataTransfer));
    } catch {
      toast.error('Não foi possível ler os arquivos arrastados.');
    }
  };

  const remover = (alvo: ArquivoEntrada) => {
    chaves.current.delete(chaveArquivo(alvo));
    setFila(f => f.filter(a => a !== alvo));
  };

  const limparTudo = () => {
    chaves.current.clear();
    setFila([]); setDwgs([]); setIgnorados(0); setResultados([]);
  };

  const limparResultados = () => {
    // Libera os arquivos já lidos para poderem ser adicionados de novo.
    chaves.current = new Set([...fila, ...dwgs].map(chaveArquivo));
    setResultados([]);
  };

  const analisar = async () => {
    if (!fila.length || analisando) return;
    const lote = [...fila];
    const controle = new AbortController();
    abortRef.current = controle;
    setProgresso({ arquivo: 1, totalArquivos: lote.length, nome: lote[0].caminho, pagina: 0, totalPaginas: 0 });
    let leitor: typeof import('@/lib/analiseArquivos/lerPdf');
    try {
      leitor = await import('@/lib/analiseArquivos/lerPdf');
    } catch {
      toast.error('Não foi possível carregar o leitor de PDF. Verifique a conexão e tente de novo.');
      setProgresso(null);
      return;
    }
    let lidos = 0;
    for (const [i, entrada] of lote.entries()) {
      if (controle.signal.aborted) break;
      setProgresso({ arquivo: i + 1, totalArquivos: lote.length, nome: entrada.caminho, pagina: 0, totalPaginas: 0 });
      let resultado: ArquivoAnalisado;
      try {
        const paginas = await leitor.lerPdf(entrada.file, {
          signal: controle.signal,
          aoLerPagina: (pagina, totalPaginas) => setProgresso(p => (p ? { ...p, pagina, totalPaginas } : p)),
        });
        resultado = {
          caminho: entrada.caminho,
          folhas: paginas.map(p => ({
            pagina: p.pagina,
            larguraMm: p.larguraMm,
            alturaMm: p.alturaMm,
            ...classificarFolha(p.larguraMm, p.alturaMm, corrigirPreenchimento(p.preenchimentoBruto)),
          })),
        };
      } catch (err) {
        if (err instanceof leitor.LeituraCancelada) break;
        resultado = { caminho: entrada.caminho, folhas: [], erro: err instanceof Error ? err.message : 'Erro ao ler o arquivo.' };
      }
      lidos++;
      setResultados(r => [...r, resultado]);
      setFila(f => f.filter(a => a !== entrada));
    }
    abortRef.current = null;
    setProgresso(null);
    if (controle.signal.aborted) toast.info(`Leitura cancelada. ${lidos} de ${lote.length} arquivos lidos.`);
  };

  const cancelar = () => abortRef.current?.abort();

  const pctProgresso = progresso
    ? ((progresso.arquivo - 1 + (progresso.totalPaginas ? progresso.pagina / progresso.totalPaginas : 0)) / progresso.totalArquivos) * 100
    : 0;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analisar arquivos</h1>
          <p className="text-sm text-muted-foreground">
            Lê o formato e o preenchimento de cada folha dos PDFs. Os arquivos são lidos neste computador e não são enviados.
          </p>
        </div>

        {/* Entrada de arquivos */}
        <div
          onDragOver={e => { e.preventDefault(); if (!analisando) setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltar}
          className={cn(
            'rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-3 text-center transition-colors',
            arrastando ? 'border-primary bg-primary/5' : 'border-border',
            analisando && 'opacity-60',
          )}
        >
          <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium text-foreground">Arraste arquivos ou pastas aqui</p>
            <p className="text-sm text-muted-foreground">PDF. Para DWG, gere o PDF antes.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="min-h-[44px]" disabled={analisando} onClick={() => inputArquivos.current?.click()}>
              <FileUp className="h-4 w-4 mr-2" /> Selecionar arquivos
            </Button>
            <Button variant="outline" className="min-h-[44px]" disabled={analisando} onClick={() => inputPasta.current?.click()}>
              <FolderOpen className="h-4 w-4 mr-2" /> Selecionar pasta
            </Button>
          </div>
          <input ref={inputArquivos} type="file" accept=".pdf,.dwg,application/pdf" multiple hidden onChange={aoEscolher} />
          <input
            ref={inputPasta}
            type="file"
            multiple
            hidden
            onChange={aoEscolher}
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
          />
        </div>

        {/* Fila e progresso */}
        {(fila.length > 0 || analisando) && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              {analisando && progresso ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                      <span className="truncate">
                        Lendo {progresso.arquivo} de {progresso.totalArquivos}: {separarCaminho(progresso.nome).nome}
                        {progresso.totalPaginas > 1 && ` (página ${progresso.pagina} de ${progresso.totalPaginas})`}
                      </span>
                    </span>
                    <Button variant="outline" size="sm" onClick={cancelar}>Cancelar</Button>
                  </div>
                  <Progress value={pctProgresso} aria-label="Progresso da leitura" />
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {fila.length} {fila.length === 1 ? 'PDF para analisar' : 'PDFs para analisar'}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="min-h-[44px]" onClick={limparTudo}>Limpar tudo</Button>
                    <Button className="min-h-[44px]" onClick={analisar}>
                      Analisar {fila.length} {fila.length === 1 ? 'PDF' : 'PDFs'}
                    </Button>
                  </div>
                </div>
              )}
              {fila.length > 0 && (
                <ul className="max-h-48 overflow-y-auto divide-y divide-border rounded-md border border-border text-sm">
                  {fila.map(a => {
                    const { pasta, nome } = separarCaminho(a.caminho);
                    return (
                      <li key={chaveArquivo(a)} className="flex items-center justify-between gap-2 px-3 py-1.5">
                        <span className="truncate">
                          <span className="text-muted-foreground">{pasta}</span>
                          <span className="text-foreground">{nome}</span>
                        </span>
                        {!analisando && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Tirar ${nome} da lista`} onClick={() => remover(a)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* DWG e ignorados */}
        {dwgs.length > 0 && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
            <p className="flex items-center gap-2 font-medium">
              <FileWarning className="h-4 w-4 shrink-0" aria-hidden />
              {dwgs.length === 1 ? '1 arquivo DWG não foi lido' : `${dwgs.length} arquivos DWG não foram lidos`}: gere o PDF e adicione aqui.
            </p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-200/80 break-words">
              {dwgs.slice(0, 6).map(d => separarCaminho(d.caminho).nome).join(', ')}
              {dwgs.length > 6 && ` e mais ${dwgs.length - 6}`}
            </p>
          </div>
        )}
        {ignorados > 0 && (
          <p className="text-sm text-muted-foreground">
            {ignorados === 1 ? '1 arquivo de outro tipo foi ignorado.' : `${ignorados} arquivos de outros tipos foram ignorados.`}
          </p>
        )}

        {/* Resultados */}
        {resultados.length > 0 && <TabelaResultados resultados={resultados} />}
      </div>

      {/* Resumo */}
      {resultados.length > 0 && (
        <div className="shrink-0 border-t border-border pt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {resumo.porNome.map(i => (
              <span key={i.nomeTabela} className={cn('rounded-md border px-2.5 py-1 text-sm font-medium', estiloFormato(i.nomeTabela.includes('+'), false))}>
                {i.quantidade}× {i.nomeTabela}
              </span>
            ))}
            {resumo.manualTamanho > 0 && (
              <span className={cn('rounded-md border px-2.5 py-1 text-sm font-medium', estiloFormato(false, true))}>
                {resumo.manualTamanho} manual: tamanho fora da tabela
              </span>
            )}
            {resumo.manualPreenchimento > 0 && (
              <span className={cn('rounded-md border px-2.5 py-1 text-sm font-medium', estiloFormato(false, true))}>
                {resumo.manualPreenchimento} manual: preenchimento acima de {LIMITE_PREENCHIMENTO}%
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {resumo.arquivos} {resumo.arquivos === 1 ? 'arquivo' : 'arquivos'} · {resumo.folhas} {resumo.folhas === 1 ? 'folha' : 'folhas'}
              {resumo.preenchimentoMedio != null && ` · preenchimento médio ${formatarPct(resumo.preenchimentoMedio)}`}
              {resumo.comErro > 0 && ` · ${resumo.comErro} com erro`}
            </span>
            {!analisando && (
              <Button variant="ghost" size="sm" onClick={limparResultados}>Limpar resultados</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function estiloFormato(alongado: boolean, manual: boolean) {
  if (manual) return 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300';
  if (alongado) return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200';
  return 'border-border bg-muted text-foreground';
}

const TabelaResultados = ({ resultados }: { resultados: ArquivoAnalisado[] }) => (
  <Card>
    <CardContent className="pt-2 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Folha</TableHead>
            <TableHead>Medidas</TableHead>
            <TableHead>Formato</TableHead>
            <TableHead className="text-right">Preenchimento</TableHead>
            <TableHead>Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resultados.map((r, i) => {
            const { pasta, nome } = separarCaminho(r.caminho);
            return (
              <Fragment key={`${i}-${r.caminho}`}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={5} className="py-2">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="min-w-0 break-words text-sm">
                        <span className="text-muted-foreground">{pasta}</span>
                        <span className="font-semibold text-foreground">{nome}</span>
                      </span>
                      {!r.erro && (
                        <span className="text-xs text-muted-foreground">
                          {r.folhas.length} {r.folhas.length === 1 ? 'folha' : 'folhas'}
                        </span>
                      )}
                    </span>
                    {r.erro && <span className="block text-sm text-destructive">Não foi possível ler: {r.erro}</span>}
                  </TableCell>
                </TableRow>
                {r.folhas.map(f => <LinhaFolha key={f.pagina} folha={f} />)}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

const LinhaFolha = ({ folha: f }: { folha: FolhaAnalisada }) => {
  const larg = Math.min(f.larguraMm, f.alturaMm);
  const comp = Math.max(f.larguraMm, f.alturaMm);
  const altoPreench = f.preenchimento != null && f.preenchimento > LIMITE_PREENCHIMENTO;
  return (
    <TableRow>
      <TableCell className="tabular-nums">{f.pagina}</TableCell>
      <TableCell className="whitespace-nowrap tabular-nums">{formatarCm(larg)} × {formatarCm(comp)} cm</TableCell>
      <TableCell>
        <span className={cn('inline-block rounded-md border px-2 py-0.5 text-sm font-medium whitespace-nowrap', estiloFormato(f.plus > 0, f.acimaDaTabela))}>
          {rotuloFormato(f, comp)}
        </span>
      </TableCell>
      <TableCell className={cn('text-right tabular-nums', altoPreench && 'font-semibold text-red-700 dark:text-red-300')}>
        {f.preenchimento != null ? formatarPct(f.preenchimento) : '—'}
      </TableCell>
      <TableCell className="text-sm">
        {f.manual ? <span className="text-red-700 dark:text-red-300">Manual: {f.manual}</span> : <span className="text-muted-foreground">Pela tabela</span>}
      </TableCell>
    </TableRow>
  );
};

export default AnalisarArquivosPage;
