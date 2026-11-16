import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Entity, Invoice } from '@/types/finance';
import { decodificar, lerExtrato, type Transacao } from '@/lib/extratoBancario';
import { conferirExtrato, type Confianca, type EntidadeConf, type LancamentoConf, type ResultadoTransacao } from '@/lib/conferenciaExtrato';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import Combobox from '@/components/recibos/Combobox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => iso.split('-').reverse().join('/');
const TAMANHO_MAX = 5 * 1024 * 1024;

const ROTULO: Record<Confianca, { texto: string; cor: string }> = {
  alta: { texto: 'Confere', cor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40' },
  media: { texto: 'Confirme', cor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40' },
  baixa: { texto: 'Só o valor', cor: 'bg-muted text-muted-foreground border-border' },
};

interface Props {
  entities: Entity[];
  invoices: Invoice[];
  /** Chamado depois de dar baixa, para recarregar os lançamentos. */
  onBaixa: () => void;
}

// Conferência de pagamentos pelo extrato do banco (OFX/CSV baixado por você).
// O arquivo é lido no navegador e descartado: só ficam gravados os lançamentos
// que você marcou como pagos.
const ConferirExtratoDialog = ({ entities, invoices, onBaixa }: Props) => {
  const [open, setOpen] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [lendo, setLendo] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [resultado, setResultado] = useState<{ entradas: ResultadoTransacao[]; saidasIgnoradas: number } | null>(null);
  // Lançamentos escolhidos por pagamento (começa na sugestão) e se está marcado para baixar.
  const [escolha, setEscolha] = useState<Record<string, string[]>>({});
  const [marcado, setMarcado] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const clientes = useMemo(() => new Map(entities.filter(e => e.type !== 'supplier').map(e => [e.id, e])), [entities]);
  const lancamentos = useMemo<LancamentoConf[]>(
    () => invoices.filter(i => clientes.has(i.entityId)).map(i => ({
      id: i.id, entityId: i.entityId, entityName: clientes.get(i.entityId)!.name,
      description: i.description, value: i.value, dueDate: i.dueDate, status: i.status,
    })),
    [invoices, clientes],
  );
  const porId = useMemo(() => new Map(lancamentos.map(l => [l.id, l])), [lancamentos]);
  const opcoesManuais = useMemo(
    () => lancamentos.filter(l => l.status !== 'paid')
      .sort((a, b) => a.entityName.localeCompare(b.entityName, 'pt-BR') || a.dueDate.localeCompare(b.dueDate))
      .map(l => ({ value: l.id, label: `${l.entityName} — ${l.description} — ${brl(l.value)} — venc. ${dataBR(l.dueDate)}` })),
    [lancamentos],
  );

  const reiniciar = () => { setResultado(null); setNomeArquivo(''); setEscolha({}); setMarcado({}); };

  const lerArquivo = async (arquivo: File) => {
    if (arquivo.size > TAMANHO_MAX) { toast.error('Arquivo grande demais (máximo 5 MB). Baixe um período menor.'); return; }
    setLendo(true);
    try {
      const texto = decodificar(await arquivo.arrayBuffer());
      const transacoes: Transacao[] = lerExtrato(texto);
      const ent: EntidadeConf[] = [...clientes.values()].map(c => ({ id: c.id, name: c.name, document: c.document }));
      const r = conferirExtrato(transacoes, lancamentos, ent);
      const esc: Record<string, string[]> = {};
      const mar: Record<string, boolean> = {};
      for (const e of r.entradas) {
        if (!e.melhor) continue;
        esc[e.transacao.id] = e.melhor.lancamentos.map(l => l.id);
        mar[e.transacao.id] = e.melhor.confianca === 'alta' && !e.jaPago;
      }
      setResultado(r); setEscolha(esc); setMarcado(mar); setNomeArquivo(arquivo.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não consegui ler o arquivo.');
    } finally {
      setLendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const trocar = (txId: string, lancId: string) => {
    if (!lancId) return;
    setEscolha(p => ({ ...p, [txId]: [lancId] }));
    setMarcado(p => ({ ...p, [txId]: true }));
  };

  // Lançamentos que serão baixados (sem repetir e sem os que já estão pagos).
  const aBaixar = useMemo(() => {
    const ids = new Set<string>();
    for (const [tx, marc] of Object.entries(marcado)) {
      if (!marc) continue;
      for (const id of escolha[tx] ?? []) if (porId.get(id)?.status !== 'paid') ids.add(id);
    }
    return [...ids].map(id => porId.get(id)!).filter(Boolean);
  }, [marcado, escolha, porId]);
  const totalBaixa = aBaixar.reduce((s, l) => s + l.value, 0);

  const darBaixa = async () => {
    if (aBaixar.length === 0) return;
    setBaixando(true);
    const ids = aBaixar.map(l => l.id);
    const { error } = await supabase.from('financial_invoices').update({ status: 'paid' }).in('id', ids);
    setBaixando(false);
    if (error) { toast.error('Não consegui dar baixa. Tente de novo.'); return; }
    onBaixa();
    toast.success(`${ids.length} ${ids.length === 1 ? 'lançamento marcado' : 'lançamentos marcados'} como pago.`, {
      action: {
        label: 'Desfazer',
        onClick: async () => {
          const anteriores = aBaixar.filter(l => l.status === 'open');
          const vencidos = aBaixar.filter(l => l.status === 'overdue');
          // 'vencido' é calculado na tela; no banco o lançamento volta a ficar 'open'.
          await supabase.from('financial_invoices').update({ status: 'open' }).in('id', [...anteriores, ...vencidos].map(l => l.id));
          onBaixa();
          toast.info('Baixa desfeita.');
        },
      },
      duration: 10000,
    });
    setOpen(false);
    reiniciar();
  };

  const grupos = useMemo(() => {
    if (!resultado) return null;
    const e = resultado.entradas;
    return {
      conferem: e.filter(r => r.melhor && !r.jaPago && r.melhor.confianca === 'alta'),
      decidir: e.filter(r => r.melhor && !r.jaPago && r.melhor.confianca !== 'alta'),
      jaPagos: e.filter(r => r.jaPago),
      semMatch: e.filter(r => !r.melhor),
    };
  }, [resultado]);

  const Linha = ({ r, permiteTrocar = true }: { r: ResultadoTransacao; permiteTrocar?: boolean }) => {
    const t = r.transacao;
    const ids = escolha[t.id] ?? [];
    const ls = ids.map(id => porId.get(id)).filter((l): l is LancamentoConf => !!l);
    const somaLanc = ls.reduce((s, l) => s + l.value, 0);
    const menor = ls.length > 0 && Math.round(t.valor * 100) < Math.round(somaLanc * 100);
    const maior = ls.length > 0 && Math.round(t.valor * 100) > Math.round(somaLanc * 100);
    const alterado = r.melhor && ids.join() !== r.melhor.lancamentos.map(l => l.id).join();
    const rotulo = r.melhor && !alterado ? ROTULO[r.melhor.confianca] : null;
    return (
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-x-4 gap-y-2 py-3 border-b border-border last:border-0">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">{brl(t.valor)}</span>
            <span className="text-xs text-muted-foreground">{dataBR(t.data)}</span>
          </div>
          <p className="text-xs text-muted-foreground break-words">{t.descricao || 'Sem descrição'}</p>
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-start gap-2">
            {ls.length > 0 && !r.jaPago && (
              <Checkbox
                className="mt-0.5"
                checked={!!marcado[t.id]}
                onCheckedChange={v => setMarcado(p => ({ ...p, [t.id]: !!v }))}
                aria-label={`Dar baixa: ${brl(t.valor)} de ${t.descricao}`}
              />
            )}
            <div className="min-w-0 flex-1 text-sm">
              {ls.length === 0 ? (
                <span className="text-muted-foreground">Nenhum lançamento em aberto parecido.</span>
              ) : ls.map(l => (
                <p key={l.id} className="text-foreground break-words">
                  <strong>{l.entityName}</strong> · {l.description} · {brl(l.value)} · venc. {dataBR(l.dueDate)}
                </p>
              ))}
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {r.jaPago && <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">Já consta como pago</span>}
                {rotulo && !r.jaPago && <span className={cn('rounded border px-1.5 py-0.5 text-[11px]', rotulo.cor)}>{rotulo.texto}</span>}
                {alterado && <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">Escolhido por você</span>}
                {r.melhor && !alterado && <span className="text-[11px] text-muted-foreground">{r.melhor.motivos.join(' · ')}</span>}
              </div>
              {menor && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Extrato {brl(t.valor)}, {brl(somaLanc - t.valor)} a menos que o lançamento (retenção de imposto?). Confira antes de dar baixa.</p>}
              {maior && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Extrato {brl(t.valor - somaLanc)} a mais que o lançamento.</p>}
            </div>
          </div>
          {permiteTrocar && (
            <Combobox
              options={opcoesManuais}
              value=""
              onValueChange={v => trocar(t.id, v)}
              placeholder={ls.length ? 'Trocar por outro lançamento…' : 'Escolher o lançamento…'}
              searchPlaceholder="Buscar cliente ou valor…"
              emptyText="Nenhum lançamento em aberto."
            />
          )}
        </div>
      </div>
    );
  };

  const Secao = ({ titulo, dica, itens, permiteTrocar }: { titulo: string; dica?: string; itens: ResultadoTransacao[]; permiteTrocar?: boolean }) =>
    itens.length === 0 ? null : (
      <section>
        <h3 className="text-sm font-semibold text-foreground">{titulo} <span className="font-normal text-muted-foreground">({itens.length})</span></h3>
        {dica && <p className="text-xs text-muted-foreground mb-1">{dica}</p>}
        <div>{itens.map(r => <Linha key={r.transacao.id} r={r} permiteTrocar={permiteTrocar} />)}</div>
      </section>
    );

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)} title="Conferir pagamentos pelo extrato do banco">
        <FileSpreadsheet className="h-4 w-4" />
        <span className="hidden sm:inline">Conferir extrato</span>
      </Button>

      <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) reiniciar(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-3 [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Conferir pagamentos pelo extrato</DialogTitle>
            <DialogDescription>
              Envie o extrato do banco (OFX ou CSV). O arquivo é lido aqui no navegador e não fica guardado: só os lançamentos que você marcar são dados como pagos.
            </DialogDescription>
          </DialogHeader>

          {!resultado ? (
            <label
              className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-10 text-center cursor-pointer hover:bg-muted/40"
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) lerArquivo(f); }}
            >
              {lendo ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
              <span className="text-sm text-foreground">Arraste o extrato aqui ou clique para escolher</span>
              <span className="text-xs text-muted-foreground">.ofx, .csv ou .txt</span>
              <input ref={inputRef} type="file" accept=".ofx,.csv,.txt,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }} />
            </label>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground break-all">{nomeArquivo}</span>
                <span className="text-foreground">{resultado.entradas.length} entradas</span>
                <span className="text-emerald-600 dark:text-emerald-400">{grupos!.conferem.length} conferem</span>
                <span className="text-amber-600 dark:text-amber-400">{grupos!.decidir.length} para você decidir</span>
                <span className="text-muted-foreground">{grupos!.semMatch.length} sem lançamento{grupos!.jaPagos.length > 0 && ` · ${grupos!.jaPagos.length} já pagos`}{resultado.saidasIgnoradas > 0 && ` · ${resultado.saidasIgnoradas} saídas ignoradas`}</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={reiniciar}>Trocar arquivo</Button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                <Secao titulo="Conferem" dica="Valor igual e cliente reconhecido. Já vêm marcados." itens={grupos!.conferem} />
                <Secao titulo="Para você decidir" dica="Marque os que estiverem certos, ou troque o lançamento." itens={grupos!.decidir} />
                <Secao titulo="Sem lançamento correspondente" dica="Escolha o lançamento manualmente, se houver." itens={grupos!.semMatch} />
                <Secao titulo="Já constam como pagos" itens={grupos!.jaPagos} permiteTrocar={false} />
                {resultado.entradas.length === 0 && <p className="text-sm text-muted-foreground">Este extrato não tem entradas (só saídas).</p>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">
                  {aBaixar.length === 0 ? 'Nenhum lançamento marcado.' : <>Serão marcados como pagos: <strong className="text-foreground">{aBaixar.length}</strong> · {brl(totalBaixa)}</>}
                </span>
                <Button onClick={darBaixa} disabled={aBaixar.length === 0 || baixando}>
                  {baixando && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Dar baixa{aBaixar.length > 0 ? ` em ${aBaixar.length}` : ''}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ConferirExtratoDialog;
