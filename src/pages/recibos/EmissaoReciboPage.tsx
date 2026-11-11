import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRecibos } from '@/contexts/RecibosContext';
import Combobox from '@/components/recibos/Combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import type { LinhaRecibo } from '@/types/recibos';
import { generateReciboPdf, buildReciboFileName } from '@/lib/reciboPdf';
import { hojeBR } from '@/lib/dataLocal';
import { formatarDocumento, formatarTelefone } from '@/lib/documento';

const formatDate = (date: string) => {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
};

const CODIGO_PERSONALIZADO = '0';
const FORMAS_PAGAMENTO = ['PIX', 'Dinheiro', 'Cartão'] as const;

const emptyLines = (): LinhaRecibo[] =>
  Array.from({ length: 10 }, () => ({ serviceCode: '', description: '', quantity: 0, unitPrice: 0, total: 0 }));

// modo 'orcamento': mesma tela e mesmo PDF, mas nao salva nada, nao consome
// numeracao e nao tem Pago. So exporta/imprime para enviar ao cliente.
const EmissaoReciboPage = ({ modo = 'recibo' }: { modo?: 'recibo' | 'orcamento' }) => {
  const orcamento = modo === 'orcamento';
  const location = useLocation();
  const { clientes, solicitantes, obras, servicos, clientServices, recibos, addRecibo, empresaInfo, loading } = useRecibos();
  const [clienteId, setClienteId] = useState('');
  const [clienteAvulso, setClienteAvulso] = useState('');
  // 'faturado': empresa cadastrada, entra no fechamento do mes.
  // 'avulso': paga na hora, nao gera lancamento a receber.
  const [tipoCliente, setTipoCliente] = useState<'faturado' | 'avulso'>('faturado');
  const [avulsoTelefone, setAvulsoTelefone] = useState('');
  const [avulsoDocumento, setAvulsoDocumento] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [solicitanteId, setSolicitanteId] = useState('');
  const [obraId, setObraId] = useState('');
  const [obraAvulsa, setObraAvulsa] = useState('');
  const [lines, setLines] = useState<LinhaRecibo[]>(emptyLines());
  const [saved, setSaved] = useState(false);
  const [lastRecibo, setLastRecibo] = useState<typeof recibos[0] | null>(null);
  const [isPago, setIsPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [hasDiscount, setHasDiscount] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'value'>('percent');
  const [discountInput, setDiscountInput] = useState<string>('');
  const demandaIdRef = useRef<string | null>(null);

  // Auto-fill client from demandas navigation
  useEffect(() => {
    const state = location.state as { clienteNome?: string; clienteId?: string | null; isAvulso?: boolean; obraId?: string | null; solicitanteId?: string | null; demandaId?: string | null } | null;
    if (!state?.clienteNome) return;
    if (state.demandaId) demandaIdRef.current = state.demandaId;
    if (state.clienteId && !state.isAvulso) {
      setClienteId(state.clienteId);
      setClienteSearch(state.clienteNome);
      setClienteAvulso('');
      setIsPago(false);
      setTipoCliente('faturado');
      if (state.obraId) setObraId(state.obraId);
      if (state.solicitanteId) setSolicitanteId(state.solicitanteId);
    } else {
      setTipoCliente('avulso');
      setClienteId('');
      setClienteAvulso(state.clienteNome);
      setClienteSearch(state.clienteNome);
      setIsPago(true);
    }
    window.history.replaceState({}, document.title);
  }, [location.state]);

  const trocarTipoCliente = (novo: 'faturado' | 'avulso') => {
    if (saved || novo === tipoCliente) return;
    setTipoCliente(novo);
    setClienteId('');
    setClienteAvulso('');
    setClienteSearch('');
    setSolicitanteId('');
    setAvulsoTelefone('');
    setAvulsoDocumento('');
    // Avulso paga na hora; faturado entra no fechamento do mes.
    setIsPago(novo === 'avulso');
    if (novo === 'faturado') setFormaPagamento('');
  };

  const filteredClienteOptions = useMemo(() => {
    if (!clienteSearch.trim()) return clientes;
    return clientes.filter(c => c.name.toLowerCase().includes(clienteSearch.toLowerCase()));
  }, [clientes, clienteSearch]);

  const filteredSolicitantes = useMemo(() => solicitantes.filter(s => s.clienteId === clienteId), [solicitantes, clienteId]);
  const filteredObras = useMemo(() => obras.filter(o => o.clienteId === clienteId), [obras, clienteId]);

  // Auto-insert/remove delivery line when obra changes or subtotal crosses exemption threshold
  useEffect(() => {
    if (saved) return;
    const obra = obras.find(o => o.id === obraId);
    setLines(prev => {
      // Remove any existing delivery line
      const withoutDelivery = prev.filter(l => l.serviceCode !== 'ENTREGA');
      
      // Calculate subtotal without delivery
      const subtotal = withoutDelivery.reduce((s, l) => s + l.total, 0);
      
      const shouldAddDelivery = obra?.hasDelivery && obra.deliveryValue > 0 &&
        !(obra.exemptionValue > 0 && subtotal >= obra.exemptionValue);
      
      if (shouldAddDelivery) {
        const lastFilledIdx = withoutDelivery.reduce((last, l, i) => l.serviceCode ? i : last, -1);
        const insertIdx = lastFilledIdx + 1;
        const deliveryLine: LinhaRecibo = {
          serviceCode: 'ENTREGA',
          description: 'Entrega',
          quantity: 1,
          unitPrice: obra.deliveryValue,
          total: obra.deliveryValue,
        };
        const result = [...withoutDelivery];
        result.splice(insertIdx, 0, deliveryLine);
        while (result.length < 10) result.push({ serviceCode: '', description: '', quantity: 0, unitPrice: 0, total: 0 });
        return result;
      }
      // Ensure at least 10 lines
      while (withoutDelivery.length < 10) withoutDelivery.push({ serviceCode: '', description: '', quantity: 0, unitPrice: 0, total: 0 });
      return withoutDelivery;
    });
  }, [obraId, obras, saved]);

  // Subtotal without delivery for exemption check
  const subtotalWithoutDelivery = useMemo(() =>
    lines.filter(l => l.serviceCode !== 'ENTREGA').reduce((s, l) => s + l.total, 0),
  [lines]);

  // Check exemption threshold when lines change
  useEffect(() => {
    if (saved || !obraId) return;
    const obra = obras.find(o => o.id === obraId);
    if (!obra?.hasDelivery || !obra.exemptionValue || obra.exemptionValue <= 0) return;
    
    const hasDeliveryLine = lines.some(l => l.serviceCode === 'ENTREGA');
    
    if (subtotalWithoutDelivery >= obra.exemptionValue && hasDeliveryLine) {
      setLines(prev => {
        const without = prev.filter(l => l.serviceCode !== 'ENTREGA');
        while (without.length < 10) without.push({ serviceCode: '', description: '', quantity: 0, unitPrice: 0, total: 0 });
        return without;
      });
    } else if (subtotalWithoutDelivery < obra.exemptionValue && !hasDeliveryLine && obra.deliveryValue > 0) {
      setLines(prev => {
        const without = prev.filter(l => l.serviceCode !== 'ENTREGA');
        const lastFilledIdx = without.reduce((last, l, i) => l.serviceCode ? i : last, -1);
        const deliveryLine: LinhaRecibo = {
          serviceCode: 'ENTREGA', description: 'Entrega', quantity: 1,
          unitPrice: obra.deliveryValue, total: obra.deliveryValue,
        };
        const result = [...without];
        result.splice(lastFilledIdx + 1, 0, deliveryLine);
        while (result.length < 10) result.push({ serviceCode: '', description: '', quantity: 0, unitPrice: 0, total: 0 });
        return result;
      });
    }
  }, [subtotalWithoutDelivery, obraId, obras, saved]);

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discountAmount = useMemo(() => {
    if (!hasDiscount) return 0;
    const v = parseFloat(discountInput.replace(',', '.')) || 0;
    if (discountType === 'percent') return Math.min(subtotal, (subtotal * v) / 100);
    return Math.min(subtotal, v);
  }, [hasDiscount, discountInput, discountType, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);

  const nextNumber = useMemo(() => {
    const maxNum = recibos.reduce((max, rc) => {
      const n = parseInt(rc.number, 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
    return String(maxNum + 1).padStart(4, '0');
  }, [recibos]);

  const updateLine = (idx: number, field: string, value: string | number) => {
    setLines(prev => {
      const next = [...prev];
      const line = { ...next[idx] };
      if (field === 'serviceCode') {
        const val = value as string;
        if (val.startsWith('CS:')) {
          const csCode = val.slice(3);
          const cs = clientSpecificServices.find(s => s.code === csCode);
          line.serviceCode = val;
          line.description = cs?.description ?? '';
          line.unitPrice = cs?.unitPrice ?? 0;
        } else if (val === CODIGO_PERSONALIZADO) {
          // Fora do padrao: descricao e valor digitados na propria linha.
          line.serviceCode = val;
          line.description = '';
          line.unitPrice = 0;
        } else {
          const svc = servicos.find(s => s.code === val);
          line.serviceCode = val;
          line.description = svc?.description ?? '';
          line.unitPrice = svc?.unitPrice ?? 0;
        }
        line.total = line.quantity * line.unitPrice;
      } else if (field === 'quantity') {
        line.quantity = Number(value) || 0;
        line.total = line.quantity * line.unitPrice;
      } else if (field === 'description') {
        line.description = String(value);
      } else if (field === 'unitPrice') {
        line.unitPrice = Number(String(value).replace(',', '.')) || 0;
        line.total = line.quantity * line.unitPrice;
      }
      next[idx] = line;
      return next;
    });
  };

  // Valida o formulario e devolve linhas e total; null (com aviso) se faltar algo.
  const montarDocumento = () => {
    if (tipoCliente === 'faturado' && !clienteId) { toast.error('Selecione um cliente cadastrado ou mude para Avulso.'); return null; }
    if (tipoCliente === 'avulso' && !clienteAvulso.trim()) { toast.error('Digite o nome do cliente avulso.'); return null; }
    const validLines = lines.filter(l => l.serviceCode && l.quantity > 0);
    if (validLines.length === 0) { toast.error('Adicione ao menos um serviço.'); return null; }
    const personalizadaIncompleta = validLines.find(l => l.serviceCode === CODIGO_PERSONALIZADO && (!l.description.trim() || l.unitPrice <= 0));
    if (!orcamento && isPago && !formaPagamento) { toast.error('Escolha a forma de pagamento.'); return null; }
    if (personalizadaIncompleta) { toast.error('No serviço personalizado (código 0), preencha a descrição e o valor.'); return null; }
    const sub = validLines.reduce((s, l) => s + l.total, 0);
    const v = parseFloat(discountInput.replace(',', '.')) || 0;
    const desc = !hasDiscount ? 0 : discountType === 'percent' ? Math.min(sub, (sub * v) / 100) : Math.min(sub, v);
    return { validLines, total: Math.max(0, sub - desc) };
  };

  const handleSave = async () => {
    const montado = montarDocumento();
    if (!montado) return;
    const { validLines, total } = montado;
    setSalvando(true);
    const recibo = await addRecibo({
      date: hojeBR(),
      isPago, formaPagamento: isPago ? formaPagamento : undefined,
      obraAvulsa: obraId ? undefined : obraAvulsa.trim() || undefined,
      clienteAvulsoTelefone: tipoCliente === 'avulso' ? avulsoTelefone.trim() || undefined : undefined,
      clienteAvulsoDocumento: tipoCliente === 'avulso' ? avulsoDocumento.trim() || undefined : undefined,
      clienteId: clienteId || '',
      clienteAvulso: clienteId ? undefined : clienteAvulso.trim(),
      solicitanteId, obraId,
      lines: validLines,
      total,
    });
    setSalvando(false);
    if (!recibo) return; // o aviso de erro ja apareceu; o formulario fica como esta
    setLastRecibo(recibo);
    setSaved(true);
    toast.success(`Recibo Nº ${recibo.number} emitido com sucesso!`);

    // Update demanda with recibo value if linked
    if (demandaIdRef.current) {
      await supabase.from('demandas').update({ valor_recibo: total }).eq('id', demandaIdRef.current);
      demandaIdRef.current = null;
    }
  };

  const handleNew = () => {
    setClienteId(''); setClienteAvulso(''); setClienteSearch(''); setSolicitanteId(''); setObraId('');
    setLines(emptyLines()); setSaved(false); setLastRecibo(null); setIsPago(tipoCliente === 'avulso'); setFormaPagamento(''); setObraAvulsa(''); setAvulsoTelefone(''); setAvulsoDocumento('');
    setHasDiscount(false); setDiscountInput(''); setDiscountType('percent');
  };

  const clienteDoRecibo = (r: typeof lastRecibo) => {
    const cadastrado = clientes.find(c => c.id === r?.clienteId);
    if (cadastrado || !r?.clienteAvulso) return cadastrado;
    return { id: '', name: r.clienteAvulso, cnpj: r.clienteAvulsoDocumento ?? '', phone: r.clienteAvulsoTelefone ?? '', email: '' };
  };

  const pdfContext = () => ({
    cliente: clienteDoRecibo(lastRecibo),
    solicitante: solicitantes.find(s => s.id === lastRecibo?.solicitanteId),
    obra: obras.find(o => o.id === lastRecibo?.obraId) ?? (lastRecibo?.obraAvulsa ? { name: lastRecibo.obraAvulsa } : undefined),
    empresaInfo,
    isPago,
    formaPagamento: isPago ? formaPagamento : undefined,
    descontoLabel: hasDiscount && discountType === 'percent'
      ? `Desconto (${parseFloat(discountInput.replace(',', '.')) || 0}%):`
      : 'Desconto:',
  });

  // Orcamento: PDF direto do formulario, sem salvar e sem numero.
  const orcamentoPdf = async () => {
    const montado = montarDocumento();
    if (!montado) return null;
    const doc = {
      id: 'orcamento', number: '', date: hojeBR(),
      clienteId: clienteId || '', clienteAvulso: clienteId ? undefined : clienteAvulso.trim(),
      clienteAvulsoTelefone: avulsoTelefone.trim() || undefined,
      clienteAvulsoDocumento: avulsoDocumento.trim() || undefined,
      solicitanteId, obraId, obraAvulsa: obraId ? undefined : obraAvulsa.trim() || undefined,
      lines: montado.validLines, total: montado.total,
    };
    const ctx = {
      cliente: clientes.find(c => c.id === clienteId)
        ?? (clienteAvulso.trim()
          ? { id: '', name: clienteAvulso.trim(), cnpj: avulsoDocumento.trim(), phone: avulsoTelefone.trim(), email: '' }
          : undefined),
      solicitante: solicitantes.find(s => s.id === solicitanteId),
      obra: obras.find(o => o.id === obraId) ?? (obraAvulsa.trim() ? { name: obraAvulsa.trim() } : undefined),
      empresaInfo,
      tipo: 'orcamento' as const,
      descontoLabel: hasDiscount && discountType === 'percent'
        ? `Desconto (${parseFloat(discountInput.replace(',', '.')) || 0}%):`
        : 'Desconto:',
    };
    return { pdf: await generateReciboPdf(doc, ctx), nome: buildReciboFileName(doc, ctx) };
  };

  const handleOrcamentoExport = async () => {
    const r = await orcamentoPdf();
    if (r) r.pdf.save(r.nome);
  };

  const handleOrcamentoPrint = async () => {
    const r = await orcamentoPdf();
    if (!r) return;
    const url = URL.createObjectURL(r.pdf.output('blob'));
    const w = window.open(url);
    if (w) w.onload = () => { w.print(); URL.revokeObjectURL(url); };
  };

  const handleExportPdf = async () => {
    if (!lastRecibo) return;
    const ctx = pdfContext();
    const doc = await generateReciboPdf(lastRecibo, ctx);
    doc.save(buildReciboFileName(lastRecibo, ctx));
  };

  const handlePrint = async () => {
    if (!lastRecibo) return;
    const doc = await generateReciboPdf(lastRecibo, pdfContext());
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const w = window.open(url);
    if (w) w.onload = () => { w.print(); URL.revokeObjectURL(url); };
  };

  const clientSpecificServices = useMemo(() =>
    clientServices.filter(cs => cs.clienteId === clienteId), [clientServices, clienteId]);

  // Cliente com tabela propria ve so os valores dele; os demais veem a tabela
  // comum. O codigo 0 aparece sempre, para servicos fora do padrao.
  const servicoOptions = useMemo(() => {
    const personalizado = { value: CODIGO_PERSONALIZADO, label: '0 - Serviço personalizado' };
    if (clientSpecificServices.length > 0) {
      return [personalizado, ...clientSpecificServices.map(cs => ({ value: `CS:${cs.code}`, label: `★ ${cs.code} - ${cs.description}` }))];
    }
    return [personalizado, ...servicos.map(s => ({ value: s.code, label: `${s.code} - ${s.description}` }))];
  }, [servicos, clientSpecificServices]);

  // Ao trocar de cliente, limpa as linhas com codigos que ele nao pode usar
  // (ex.: valor comum escolhido antes de selecionar um cliente com tabela propria).
  useEffect(() => {
    if (saved) return;
    const permitidos = new Set(servicoOptions.map(o => o.value));
    setLines(prev => {
      const invalida = (l: LinhaRecibo) => l.serviceCode && l.serviceCode !== 'ENTREGA' && !permitidos.has(l.serviceCode);
      if (!prev.some(invalida)) return prev;
      return prev.map(l => invalida(l) ? { serviceCode: '', description: '', quantity: 0, unitPrice: 0, total: 0 } : l);
    });
  }, [servicoOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">{orcamento ? 'Orçamento' : 'Emissão de Recibo'}</h1>
          <div className="flex items-center gap-3">
            {!orcamento && (
              <span className="text-sm font-semibold text-primary">
                Nº {saved && lastRecibo ? lastRecibo.number : nextNumber}
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              {formatDate(hojeBR())}
            </span>
          </div>
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-4 border rounded-md px-3 py-2" disabled={saved}>
        <legend className="sr-only">Tipo de recibo</legend>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="tipo-recibo"
            value="faturado"
            checked={tipoCliente === 'faturado'}
            onChange={() => trocarTipoCliente('faturado')}
            className="h-4 w-4 accent-primary"
          />
          <span className="font-medium">Faturado</span>
          <span className="text-xs text-muted-foreground">cliente cadastrado, entra no fechamento do mês</span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="tipo-recibo"
            value="avulso"
            checked={tipoCliente === 'avulso'}
            onChange={() => trocarTipoCliente('avulso')}
            className="h-4 w-4 accent-primary"
          />
          <span className="font-medium">Avulso</span>
          <span className="text-xs text-muted-foreground">paga na hora, não gera cobrança</span>
        </label>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <label className="text-xs font-medium text-foreground" htmlFor="campo-cliente">Cliente</label>
          {tipoCliente === 'faturado' ? (
            <>
              <Input
                id="campo-cliente"
                placeholder="Buscar cliente cadastrado..."
                value={clienteSearch}
                onChange={e => {
                  setClienteSearch(e.target.value);
                  setClientDropdownOpen(true);
                  setClienteId('');
                  setSolicitanteId('');
                  setObraId('');
                }}
                onFocus={() => setClientDropdownOpen(true)}
                onBlur={() => setTimeout(() => setClientDropdownOpen(false), 200)}
                disabled={saved}
                className="h-7 text-xs"
              />
              {clientDropdownOpen && clienteSearch.trim() && !saved && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                  {filteredClienteOptions.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => {
                        setClienteId(c.id);
                        setClienteSearch(c.name);
                        setClientDropdownOpen(false);
                        setSolicitanteId('');
                        setObraId('');
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                  {filteredClienteOptions.length === 0 && (
                    <div className="px-3 py-1.5 text-xs text-muted-foreground">
                      Nenhum cliente com esse nome. Para atender sem cadastro, marque Avulso.
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <Input
              id="campo-cliente"
              placeholder="Nome de quem está pagando"
              value={clienteAvulso}
              onChange={e => { setClienteAvulso(e.target.value); setClienteSearch(e.target.value); }}
              disabled={saved}
              className="h-7 text-xs"
            />
          )}
        </div>
        {tipoCliente === 'avulso' && (
          <>
            <div>
              <label className="text-xs font-medium text-foreground" htmlFor="campo-telefone">Telefone</label>
              <Input
                id="campo-telefone"
                inputMode="tel"
                placeholder="(31) 99999-9999"
                value={avulsoTelefone}
                onChange={e => setAvulsoTelefone(formatarTelefone(e.target.value))}
                disabled={saved}
                className="h-7 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground" htmlFor="campo-documento">CPF / CNPJ</label>
              <Input
                id="campo-documento"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={avulsoDocumento}
                onChange={e => setAvulsoDocumento(formatarDocumento(e.target.value))}
                disabled={saved}
                className="h-7 text-xs"
              />
            </div>
          </>
        )}
        {tipoCliente === 'faturado' && (
        <div>
          <label className="text-xs font-medium text-foreground">Solicitante</label>
          <Combobox options={filteredSolicitantes.map(s => ({ value: s.id, label: s.name }))} value={solicitanteId} onValueChange={setSolicitanteId} placeholder="Selecione" disabled={saved || !clienteId} />
        </div>
        )}
        <div>
          <label className="text-xs font-medium text-foreground">Obra</label>
          <Combobox
            options={filteredObras.map(o => ({ value: o.id, label: o.name }))}
            value={obraId}
            onValueChange={(v) => { setObraId(v); setObraAvulsa(''); }}
            textoLivre={obraAvulsa}
            onTextoLivre={(t) => { setObraAvulsa(t); setObraId(''); }}
            placeholder="Selecione ou digite"
            searchPlaceholder="Buscar ou digitar obra..."
            disabled={saved}
          />
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto flex-1 min-h-0">
        <Table>
          <TableHeader>
            <TableRow className="h-8">
              <TableHead className="py-1 text-xs w-[180px]">Serviço</TableHead>
              <TableHead className="py-1 text-xs">Descrição</TableHead>
              <TableHead className="py-1 text-xs w-[70px]">Qtd</TableHead>
              <TableHead className="py-1 text-xs w-[100px]">Unitário</TableHead>
              <TableHead className="py-1 text-xs w-[100px]">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, idx) => (
              <TableRow key={idx} className="h-8">
                <TableCell className="py-0.5 px-2">
                  <Combobox options={servicoOptions} value={line.serviceCode} onValueChange={v => updateLine(idx, 'serviceCode', v)} placeholder="Código" disabled={saved} />
                </TableCell>
                <TableCell className="py-0.5 px-2 text-xs text-foreground">
                  {line.serviceCode === CODIGO_PERSONALIZADO ? (
                    <Input value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} disabled={saved} placeholder="Descreva o serviço" className="h-7 text-base" />
                  ) : line.description}
                </TableCell>
                <TableCell className="py-0.5 px-2">
                  <Input type="number" min={0} value={line.quantity || ''} onChange={e => updateLine(idx, 'quantity', e.target.value)} disabled={saved} className="h-7 w-16 text-base" />
                </TableCell>
                <TableCell className="py-0.5 px-2 text-xs text-foreground">
                  {line.serviceCode === CODIGO_PERSONALIZADO ? (
                    <Input type="number" min={0} step="0.01" value={line.unitPrice || ''} onChange={e => updateLine(idx, 'unitPrice', e.target.value)} disabled={saved} placeholder="0,00" className="h-7 w-24 text-base" />
                  ) : line.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </TableCell>
                <TableCell className="py-0.5 px-2 text-xs font-medium text-foreground">
                  {line.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-1 gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            {hasDiscount && discountAmount > 0 && (
              <div className="text-xs text-muted-foreground">
                Subtotal: {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · Desconto: -{discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            )}
            <p className="text-sm font-bold text-foreground">
              Total: {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          {!orcamento && (<>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox checked={isPago} onCheckedChange={(v) => { setIsPago(!!v); if (!v) setFormaPagamento(''); }} disabled={saved} />
            Pago
          </label>
          {isPago && (
            <Select value={formaPagamento} onValueChange={setFormaPagamento} disabled={saved}>
              <SelectTrigger className="h-8 w-[130px] text-sm">
                <SelectValue placeholder="Forma de pgto." />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          </>)}
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox checked={hasDiscount} onCheckedChange={(v) => setHasDiscount(!!v)} disabled={saved} />
            Desconto
          </label>
          {hasDiscount && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={discountInput}
                onChange={e => setDiscountInput(e.target.value)}
                disabled={saved}
                placeholder="0"
                className="h-7 w-24 text-base"
              />
              <select
                value={discountType}
                onChange={e => setDiscountType(e.target.value as 'percent' | 'value')}
                disabled={saved}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="percent">%</option>
                <option value="value">R$</option>
              </select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {orcamento ? (<>
          <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={handleOrcamentoExport}>Exportar PDF</Button>
          <Button size="sm" variant="secondary" className="min-h-[44px] sm:min-h-0" onClick={handleOrcamentoPrint}>Imprimir</Button>
          <Button size="sm" variant="outline" className="min-h-[44px] sm:min-h-0" onClick={handleNew}>Novo Orçamento</Button>
          </>) : (<>
          <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={handleSave} disabled={saved || salvando}>{salvando ? 'Salvando…' : 'Salvar Recibo'}</Button>
          <Button size="sm" variant="outline" className="min-h-[44px] sm:min-h-0" onClick={handleNew}>Novo Recibo</Button>
          {saved && <Button size="sm" variant="secondary" className="min-h-[44px] sm:min-h-0" onClick={handleExportPdf}>Exportar PDF</Button>}
          {saved && <Button size="sm" variant="secondary" className="min-h-[44px] sm:min-h-0" onClick={handlePrint}>Imprimir</Button>}
          </>)}
        </div>
      </div>
    </div>
  );
};

export default EmissaoReciboPage;
