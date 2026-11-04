import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, CalendarIcon, Search, Trash2, Edit, ArrowLeft, CheckCircle2, AlertTriangle, FileText, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Filter, X, PackageCheck, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import ThemeToggle from '@/components/ThemeToggle';

interface Demanda {
  id: string;
  cliente_id: string | null;
  cliente_nome: string;
  telefone: string;
  email: string;
  servico: string;
  descricao: string;
  prazo: string | null;
  responsavel_id: string | null;
  status: string;
  prioridade: string;
  canal: string;
  created_at: string;
  concluido_at: string | null;
  obra_id: string | null;
  solicitante_id: string | null;
  tipo_saida: string | null;
  retirado: boolean;
  retirado_at: string | null;
  valor_recibo: number | null;
}

interface Responsavel {
  id: string;
  name: string;
}

interface Cliente {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Servico {
  id: string;
  description: string;
}

const statusColors: Record<string, string> = {
  pendente: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  em_andamento: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  em_atraso: 'bg-red-500/15 text-red-700 dark:text-red-400',
  concluido: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  em_atraso: 'Em atraso',
  concluido: 'Concluído',
};

const prioridadeOrder: Record<string, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

const prioridadeColors: Record<string, string> = {
  baixa: 'bg-green-500/15 text-green-700 dark:text-green-400',
  media: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  alta: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  urgente: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

const prioridadeLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

const canalOptions = ['WhatsApp', 'Email', 'Telefone', 'Presencial'];

const ITEMS_PER_PAGE = 10;

const DemandasPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [obrasAll, setObrasAll] = useState<{ id: string; name: string; cliente_id: string }[]>([]);
  const [solicitantesAll, setSolicitantesAll] = useState<{ id: string; name: string; cliente_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [clienteSearch, setClienteSearch] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [servico, setServico] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState<Date | undefined>();
  const [prazoHora, setPrazoHora] = useState('12:00');
  const [responsavelId, setResponsavelId] = useState('');
  const [status, setStatus] = useState('pendente');
  const [prioridade, setPrioridade] = useState('media');
  const [canal, setCanal] = useState('');
  const [demandaObraId, setDemandaObraId] = useState('');
  const [demandaSolicitanteId, setDemandaSolicitanteId] = useState('');

  // Mini-modal state
  const [newResponsavelOpen, setNewResponsavelOpen] = useState(false);
  const [newResponsavelName, setNewResponsavelName] = useState('');

  // Client search
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);

  // Serviço search
  const [servicoDropdownOpen, setServicoDropdownOpen] = useState(false);

  // Confirm complete dialog
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [confirmCompleteId, setConfirmCompleteId] = useState<string | null>(null);

  // Post-completion saída dialog
  const [showSaidaDialog, setShowSaidaDialog] = useState(false);
  const [selectedSaida, setSelectedSaida] = useState<string | null>(null);

  // Post-completion recibo dialog
  const [showReciboButton, setShowReciboButton] = useState(false);
  const [completedDemandaData, setCompletedDemandaData] = useState<Demanda | null>(null);

  // Pagination
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [completedPageIndex, setCompletedPageIndex] = useState(0);
  const [retiradaPageIndex, setRetiradaPageIndex] = useState(0);

  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterResponsavel, setFilterResponsavel] = useState('');
  const [filterCliente, setFilterCliente] = useState('');
  const [appliedFilterResp, setAppliedFilterResp] = useState('');
  const [appliedFilterCliente, setAppliedFilterCliente] = useState('');
  const [filterSaida, setFilterSaida] = useState('');
  const [appliedFilterSaida, setAppliedFilterSaida] = useState('');
  const filtersActive = !!(appliedFilterResp || appliedFilterCliente || appliedFilterSaida);

  const applyFilters = () => {
    setAppliedFilterResp(filterResponsavel);
    setAppliedFilterCliente(filterCliente);
    setAppliedFilterSaida(filterSaida);
    setFilterOpen(false);
    setActivePageIndex(0);
    setCompletedPageIndex(0);
    setRetiradaPageIndex(0);
  };

  const clearFilters = () => {
    setFilterResponsavel('');
    setFilterCliente('');
    setFilterSaida('');
    setAppliedFilterResp('');
    setAppliedFilterCliente('');
    setAppliedFilterSaida('');
    setFilterOpen(false);
    setActivePageIndex(0);
    setCompletedPageIndex(0);
    setRetiradaPageIndex(0);
  };

  const filteredClientes = useMemo(() => {
    if (!clienteSearch.trim()) return clientes;
    return clientes.filter(c => c.name.toLowerCase().includes(clienteSearch.toLowerCase()));
  }, [clientes, clienteSearch]);

  const filteredServicos = useMemo(() => {
    if (!servico.trim()) return servicos;
    return servicos.filter(s => s.description.toLowerCase().includes(servico.toLowerCase()));
  }, [servicos, servico]);

  // Sorting
  const [sortField, setSortField] = useState<'prazo' | 'prioridade' | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const toggleSort = (field: 'prazo' | 'prioridade') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Compute effective status (mark overdue as em_atraso)
  const getEffectiveStatus = (d: Demanda) => {
    if (d.status === 'concluido') return 'concluido';
    if (d.prazo && new Date(d.prazo).getTime() < Date.now()) return 'em_atraso';
    return d.status;
  };

  const applyFilterToDemandas = (list: (Demanda & { _effectiveStatus: string })[]) => {
    let filtered = list;
    if (appliedFilterResp) {
      filtered = filtered.filter(d => d.responsavel_id === appliedFilterResp);
    }
    if (appliedFilterCliente) {
      filtered = filtered.filter(d => d.cliente_nome.toLowerCase().includes(appliedFilterCliente.toLowerCase()));
    }
    if (appliedFilterSaida) {
      filtered = filtered.filter(d => d.tipo_saida === appliedFilterSaida);
    }
    return filtered;
  };

  const activeDemandas = useMemo(() => {
    const active = demandas
      .map(d => ({ ...d, _effectiveStatus: getEffectiveStatus(d) }))
      .filter(d => d._effectiveStatus !== 'concluido');

    const filtered = applyFilterToDemandas(active);

    return filtered.sort((a, b) => {
      if (sortField === 'prazo') {
        const pa = a.prazo ? new Date(a.prazo).getTime() : Infinity;
        const pb = b.prazo ? new Date(b.prazo).getTime() : Infinity;
        return sortAsc ? pa - pb : pb - pa;
      }
      if (sortField === 'prioridade') {
        const pa = prioridadeOrder[a.prioridade] ?? 2;
        const pb = prioridadeOrder[b.prioridade] ?? 2;
        return sortAsc ? pb - pa : pa - pb;
      }
      return 0;
    });
  }, [demandas, sortField, sortAsc, appliedFilterResp, appliedFilterCliente]);

  const completedNotRetirada = useMemo(() => {
    const completed = demandas
      .map(d => ({ ...d, _effectiveStatus: getEffectiveStatus(d) }))
      .filter(d => d._effectiveStatus === 'concluido' && !d.retirado)
      .sort((a, b) => {
        const ca = a.concluido_at ? new Date(a.concluido_at).getTime() : 0;
        const cb = b.concluido_at ? new Date(b.concluido_at).getTime() : 0;
        return cb - ca;
      });
    return applyFilterToDemandas(completed);
  }, [demandas, appliedFilterResp, appliedFilterCliente]);

  const completedRetirada = useMemo(() => {
    const completed = demandas
      .map(d => ({ ...d, _effectiveStatus: getEffectiveStatus(d) }))
      .filter(d => d._effectiveStatus === 'concluido' && d.retirado)
      .sort((a, b) => {
        const ca = a.retirado_at ? new Date(a.retirado_at).getTime() : 0;
        const cb = b.retirado_at ? new Date(b.retirado_at).getTime() : 0;
        return cb - ca;
      });
    return applyFilterToDemandas(completed);
  }, [demandas, appliedFilterResp, appliedFilterCliente]);

  // Paginated slices
  const activeTotal = activeDemandas.length;
  const activeTotalPages = Math.max(1, Math.ceil(activeTotal / ITEMS_PER_PAGE));
  const activeSlice = activeDemandas.slice(activePageIndex * ITEMS_PER_PAGE, (activePageIndex + 1) * ITEMS_PER_PAGE);

  const completedTotal = completedNotRetirada.length;
  const completedTotalPages = Math.max(1, Math.ceil(completedTotal / ITEMS_PER_PAGE));
  const completedSlice = completedNotRetirada.slice(completedPageIndex * ITEMS_PER_PAGE, (completedPageIndex + 1) * ITEMS_PER_PAGE);

  const retiradaTotal = completedRetirada.length;
  const retiradaTotalPages = Math.max(1, Math.ceil(retiradaTotal / ITEMS_PER_PAGE));
  const retiradaSlice = completedRetirada.slice(retiradaPageIndex * ITEMS_PER_PAGE, (retiradaPageIndex + 1) * ITEMS_PER_PAGE);

  // Reset page when data changes
  useEffect(() => { setActivePageIndex(0); }, [activeTotal]);
  useEffect(() => { setCompletedPageIndex(0); }, [completedTotal]);
  useEffect(() => { setRetiradaPageIndex(0); }, [retiradaTotal]);

  const fetchAll = async () => {
    setLoading(true);

    // Auto-delete demandas concluídas há mais de 48h
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    await supabase.from('demandas').delete().eq('status', 'concluido').lt('concluido_at', cutoff);

    const [dRes, rRes, cRes, sRes, oRes, solRes] = await Promise.all([
      supabase.from('demandas').select('*').order('created_at', { ascending: false }),
      supabase.from('responsaveis').select('*').order('name'),
      supabase.from('clientes').select('*').order('name'),
      supabase.from('servicos').select('id, description').order('description'),
      supabase.from('obras').select('id, name, cliente_id').order('name'),
      supabase.from('solicitantes').select('id, name, cliente_id').order('name'),
    ]);
    if (dRes.data) setDemandas(dRes.data);
    if (rRes.data) setResponsaveis(rRes.data);
    if (cRes.data) setClientes(cRes.data);
    if (sRes.data) setServicos(sRes.data);
    if (oRes.data) setObrasAll(oRes.data);
    if (solRes.data) setSolicitantesAll(solRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setClienteSearch('');
    setSelectedClienteId(null);
    setClienteNome('');
    setTelefone('');
    setEmail('');
    setServico('');
    setDescricao('');
    setPrazo(undefined);
    setPrazoHora('12:00');
    setResponsavelId('');
    setStatus('pendente');
    setPrioridade('media');
    setCanal('');
    setDemandaObraId('');
    setDemandaSolicitanteId('');
  };

  const openAdd = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (d: Demanda) => {
    setEditingId(d.id);
    setSelectedClienteId(d.cliente_id);
    setClienteNome(d.cliente_nome);
    setClienteSearch(d.cliente_nome);
    setTelefone(d.telefone);
    setEmail(d.email);
    setServico(d.servico);
    setDescricao(d.descricao || '');
    if (d.prazo) {
      const dt = new Date(d.prazo);
      setPrazo(dt);
      setPrazoHora(format(dt, 'HH:mm'));
    } else {
      setPrazo(undefined);
      setPrazoHora('12:00');
    }
    setResponsavelId(d.responsavel_id || '');
    setStatus(d.status);
    setPrioridade(d.prioridade || 'media');
    setCanal(d.canal || '');
    setDemandaObraId(d.obra_id || '');
    setDemandaSolicitanteId(d.solicitante_id || '');
    setDialogOpen(true);
  };

  const handleSelectCliente = (c: Cliente) => {
    setSelectedClienteId(c.id);
    setClienteNome(c.name);
    setClienteSearch(c.name);
    setTelefone(c.phone);
    setEmail(c.email);
    setClientDropdownOpen(false);
    setDemandaObraId('');
    setDemandaSolicitanteId('');
  };

  const handleClienteAvulso = () => {
    setSelectedClienteId(null);
    setClienteNome(clienteSearch);
    setClientDropdownOpen(false);
    setDemandaObraId('');
    setDemandaSolicitanteId('');
  };

  const handleSave = async () => {
    const nome = clienteNome || clienteSearch;
    if (!nome.trim()) { toast.error('Informe o cliente'); return; }
    if (!servico) { toast.error('Selecione o serviço'); return; }

    let prazoISO: string | null = null;
    if (prazo) {
      const [hh, mm] = prazoHora.split(':').map(Number);
      const dt = new Date(prazo);
      dt.setHours(hh, mm, 0, 0);
      prazoISO = dt.toISOString();
    }

    const payload = {
      cliente_id: selectedClienteId,
      cliente_nome: nome,
      telefone,
      email,
      servico,
      descricao,
      prazo: prazoISO,
      responsavel_id: responsavelId || null,
      status,
      prioridade,
      canal,
      obra_id: selectedClienteId ? (demandaObraId || null) : null,
      solicitante_id: selectedClienteId ? (demandaSolicitanteId || null) : null,
    };

    if (editingId) {
      const { error } = await supabase.from('demandas').update(payload).eq('id', editingId);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Demanda atualizada');
    } else {
      const { error } = await supabase.from('demandas').insert(payload);
      if (error) { toast.error('Erro ao salvar'); return; }
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('demandas').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Demanda excluída');
    fetchAll();
  };

  const addResponsavel = async () => {
    if (!newResponsavelName.trim()) return;
    const { error } = await supabase.from('responsaveis').insert({ name: newResponsavelName.trim() });
    if (error) { toast.error('Erro ao adicionar responsável'); return; }
    toast.success('Responsável adicionado');
    setNewResponsavelName('');
    setNewResponsavelOpen(false);
    const { data } = await supabase.from('responsaveis').select('*').order('name');
    if (data) setResponsaveis(data);
  };

  const getResponsavelName = (id: string | null) => responsaveis.find(r => r.id === id)?.name || '—';

  // Telefone da demanda, com fallback para o cadastro do cliente
  const getPhone = (d: Demanda) =>
    d.telefone?.trim() || clientes.find(c => c.id === d.cliente_id)?.phone?.trim() || '';

  const PhoneLine = ({ d, className }: { d: Demanda; className?: string }) => {
    const phone = getPhone(d);
    if (!phone) return null;
    return (
      <a
        href={`tel:${phone.replace(/[^\d+]/g, '')}`}
        onClick={e => e.stopPropagation()}
        className={cn('inline-flex items-center gap-1 text-xs text-primary hover:underline', className)}
        title="Ligar para o cliente"
      >
        <Phone className="h-3 w-3 shrink-0" />
        {phone}
      </a>
    );
  };

  const getDeadlineAlert = (prazo: string | null, status: string) => {
    if (!prazo || status === 'concluido') return null;
    const now = new Date();
    const deadline = new Date(prazo);
    const diffMs = deadline.getTime() - now.getTime();
    if (diffMs < 0) return 'overdue';
    if (diffMs <= 60 * 60 * 1000) return 'warning';
    return null;
  };

  const getRowClass = (d: Demanda) => {
    const alert = getDeadlineAlert(d.prazo, d.status);
    if (alert === 'overdue') return 'bg-red-500/10 border-l-4 border-l-red-500';
    if (alert === 'warning') return 'bg-yellow-500/10 border-l-4 border-l-yellow-500';
    return '';
  };

  const handleMarkRetirado = async (id: string) => {
    const { error } = await supabase.from('demandas').update({ retirado: true, retirado_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error('Erro ao marcar como retirado'); return; }
    toast.success('Demanda marcada como retirada!');
    fetchAll();
  };

  const handleConfirmComplete = async () => {
    if (!confirmCompleteId) return;
    const demanda = demandas.find(d => d.id === confirmCompleteId);
    const { error } = await supabase.from('demandas').update({ status: 'concluido', concluido_at: new Date().toISOString() }).eq('id', confirmCompleteId);
    if (error) { toast.error('Erro ao concluir'); return; }
    toast.success('Demanda concluída!');
    setConfirmCompleteOpen(false);
    setConfirmCompleteId(null);
    if (demanda) setCompletedDemandaData({ ...demanda });
    setSelectedSaida(null);
    setShowSaidaDialog(true);
    fetchAll();
  };

  const PaginationControls = ({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-3 py-2">
        <Button variant="ghost" size="icon" disabled={page === 0} onClick={onPrev} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
        <Button variant="ghost" size="icon" disabled={page >= totalPages - 1} onClick={onNext} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="min-h-[44px] min-w-[44px]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">Demandas</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle expanded={false} />
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative min-h-[40px] min-w-[40px]">
                <Filter className="h-4 w-4" />
                {filtersActive && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); clearFilters(); }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 space-y-3" align="end">
              <p className="text-sm font-medium text-foreground">Filtros</p>
              <div>
                <Label className="text-xs">Responsável</Label>
                <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    {responsaveis.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cliente</Label>
                <Input
                  placeholder="Nome do cliente"
                  value={filterCliente}
                  onChange={e => setFilterCliente(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo de Saída</Label>
                <Select value={filterSaida} onValueChange={setFilterSaida}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Entrega">Entrega</SelectItem>
                    <SelectItem value="Retirada Grande">Retirada Grande</SelectItem>
                    <SelectItem value="Retirada Pequena">Retirada Pequena</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="w-full" onClick={applyFilters}>Filtrar</Button>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" className="min-h-[40px] min-w-[40px]" title="Pesquisar cliente">
            <Search className="h-4 w-4" />
          </Button>
          {isMobile ? (
            <Button onClick={openAdd} size="icon" className="min-h-[40px] min-w-[40px]">
              <Plus className="h-5 w-5" />
            </Button>
          ) : (
            <Button onClick={openAdd} className="gap-2 min-h-[44px]">
              <Plus className="h-4 w-4" /> Adicionar Demanda
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden gap-4">

      <ScrollArea className="flex-1">
        {loading ? (
          <p className="text-muted-foreground text-sm p-4">Carregando...</p>
        ) : demandas.length === 0 ? (
          <p className="text-muted-foreground text-sm p-4">Nenhuma demanda cadastrada.</p>
        ) : (
          <div className="space-y-6">
            {/* Active demands */}
            {isMobile ? (
              <div className="space-y-3">
                {activeSlice.map(d => {
                  const es = d._effectiveStatus;
                  return (
                  <div key={d.id} className={cn("border border-border rounded-xl p-3 space-y-2 bg-card", getRowClass(d))}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setConfirmCompleteId(d.id); setConfirmCompleteOpen(true); }} className="text-muted-foreground hover:text-green-600 transition-colors">
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                        <div>
                          <p className="font-medium text-foreground">{d.cliente_nome}</p>
                          <PhoneLine d={d} />
                          <p className="text-xs text-muted-foreground">{d.servico}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <Badge className={cn('text-xs', statusColors[es])}>{statusLabels[es] || es}</Badge>
                        <Badge className={cn('text-xs', prioridadeColors[d.prioridade])}>{prioridadeLabels[d.prioridade] || d.prioridade}</Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {d.descricao && <p>📝 {d.descricao}</p>}
                      {d.email && <p>✉️ {d.email}</p>}
                      {d.prazo && <p>📅 {format(new Date(d.prazo), 'dd/MM/yyyy HH:mm')}</p>}
                      <p>👤 {getResponsavelName(d.responsavel_id)}</p>
                      {d.canal && <p>📢 {d.canal}</p>}
                    </div>
                    <div className="flex gap-1 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  );
                })}
                <PaginationControls page={activePageIndex} totalPages={activeTotalPages} onPrev={() => setActivePageIndex(p => p - 1)} onNext={() => setActivePageIndex(p => p + 1)} />
              </div>
            ) : (
              <div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="border-r border-border">Cliente</TableHead>
                        <TableHead className="border-r border-border">Serviço</TableHead>
                        <TableHead className="border-r border-border cursor-pointer select-none" onClick={() => toggleSort('prazo')}>
                          <div className="flex items-center gap-1">
                            Prazo
                            {sortField === 'prazo' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUp className="h-3.5 w-3.5 text-muted-foreground/40" />}
                          </div>
                        </TableHead>
                        <TableHead className="border-r border-border">Responsável</TableHead>
                        <TableHead className="border-r border-border">Status</TableHead>
                        <TableHead className="border-r border-border cursor-pointer select-none" onClick={() => toggleSort('prioridade')}>
                          <div className="flex items-center gap-1">
                            Prioridade
                            {sortField === 'prioridade' ? (sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />) : <ArrowUp className="h-3.5 w-3.5 text-muted-foreground/40" />}
                          </div>
                        </TableHead>
                        <TableHead className="border-r border-border">Canal</TableHead>
                        <TableHead className="w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeSlice.map(d => {
                        const es = d._effectiveStatus;
                        const alert = getDeadlineAlert(d.prazo, d.status);
                        return (
                        <TableRow key={d.id} className={cn(getRowClass(d))}>
                          <TableCell className="font-medium border-r border-border">
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setConfirmCompleteId(d.id); setConfirmCompleteOpen(true); }} className="text-muted-foreground hover:text-green-600 transition-colors" title="Concluir tarefa">
                                <CheckCircle2 className="h-5 w-5" />
                              </button>
                              <div>
                                <span>{d.cliente_nome}</span>
                                <div><PhoneLine d={d} /></div>
                                {d.descricao && <p className="text-xs text-muted-foreground">{d.descricao}</p>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="border-r border-border">{d.servico}</TableCell>
                          <TableCell className="border-r border-border">
                            <div className="flex items-center gap-1">
                              {alert && <AlertTriangle className={cn("h-4 w-4 shrink-0", alert === 'overdue' ? 'text-red-500' : 'text-yellow-500')} />}
                              {d.prazo ? format(new Date(d.prazo), 'dd/MM/yyyy HH:mm') : '—'}
                            </div>
                          </TableCell>
                          <TableCell className="border-r border-border">{getResponsavelName(d.responsavel_id)}</TableCell>
                          <TableCell className="border-r border-border">
                            <Badge className={cn('text-xs', statusColors[es])}>{statusLabels[es] || es}</Badge>
                          </TableCell>
                          <TableCell className="border-r border-border">
                            <Badge className={cn('text-xs', prioridadeColors[d.prioridade])}>{prioridadeLabels[d.prioridade] || d.prioridade}</Badge>
                          </TableCell>
                          <TableCell className="border-r border-border">{d.canal || '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(d)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <PaginationControls page={activePageIndex} totalPages={activeTotalPages} onPrev={() => setActivePageIndex(p => p - 1)} onNext={() => setActivePageIndex(p => p + 1)} />
              </div>
            )}

            {/* Concluídas (aguardando retirada) */}
            {completedNotRetirada.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" /> Concluídas ({completedNotRetirada.length})
                </h2>
                {isMobile ? (
                  <div className="space-y-2">
                    {completedSlice.map(d => (
                      <div key={d.id} className="border border-border rounded-xl p-3 bg-card space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground text-sm">{d.cliente_nome}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleMarkRetirado(d.id)} title="Marcar como retirado"><PackageCheck className="h-4 w-4 text-primary" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </div>
                        <PhoneLine d={d} />
                        <p className="text-xs text-muted-foreground">{d.servico}</p>
                        <div className="flex flex-wrap gap-1">
                          {d.tipo_saida && <Badge className="text-xs bg-primary/15 text-primary">{d.tipo_saida}</Badge>}
                          {d.valor_recibo != null && <Badge className="text-xs bg-green-500/15 text-green-700 dark:text-green-400">R$ {d.valor_recibo.toFixed(2)}</Badge>}
                        </div>
                        {d.descricao && <p className="text-xs text-muted-foreground">📝 {d.descricao}</p>}
                        <p className="text-xs text-muted-foreground">👤 {getResponsavelName(d.responsavel_id)}</p>
                        {d.concluido_at && <p className="text-xs text-muted-foreground">Concluída em {format(new Date(d.concluido_at), 'dd/MM/yyyy HH:mm')}</p>}
                      </div>
                    ))}
                    <PaginationControls page={completedPageIndex} totalPages={completedTotalPages} onPrev={() => setCompletedPageIndex(p => p - 1)} onNext={() => setCompletedPageIndex(p => p + 1)} />
                  </div>
                ) : (
                  <div>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="border-r border-border">Cliente</TableHead>
                            <TableHead className="border-r border-border">Serviço</TableHead>
                            <TableHead className="border-r border-border">Saída</TableHead>
                            <TableHead className="border-r border-border">Valor Recibo</TableHead>
                            <TableHead className="border-r border-border">Responsável</TableHead>
                            <TableHead className="border-r border-border">Concluída em</TableHead>
                            <TableHead className="w-24">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {completedSlice.map(d => (
                            <TableRow key={d.id}>
                              <TableCell className="border-r border-border">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <div>
                                    <span>{d.cliente_nome}</span>
                                    <div><PhoneLine d={d} /></div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="border-r border-border">{d.servico}</TableCell>
                              <TableCell className="border-r border-border">
                                {d.tipo_saida ? <Badge className="text-xs bg-primary/15 text-primary">{d.tipo_saida}</Badge> : '—'}
                              </TableCell>
                              <TableCell className="border-r border-border">
                                {d.valor_recibo != null ? `R$ ${d.valor_recibo.toFixed(2)}` : '—'}
                              </TableCell>
                              <TableCell className="border-r border-border">{getResponsavelName(d.responsavel_id)}</TableCell>
                              <TableCell className="border-r border-border">{d.concluido_at ? format(new Date(d.concluido_at), 'dd/MM/yyyy HH:mm') : '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleMarkRetirado(d.id)} title="Marcar como retirado"><PackageCheck className="h-4 w-4 text-primary" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <PaginationControls page={completedPageIndex} totalPages={completedTotalPages} onPrev={() => setCompletedPageIndex(p => p - 1)} onNext={() => setCompletedPageIndex(p => p + 1)} />
                  </div>
                )}
              </div>
            )}

            {/* Concluídas e Retiradas */}
            {completedRetirada.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-green-600" /> Concluídas e Retiradas ({completedRetirada.length})
                </h2>
                {isMobile ? (
                  <div className="space-y-2">
                    {retiradaSlice.map(d => (
                      <div key={d.id} className="border border-border rounded-xl p-3 bg-card opacity-50 space-y-1">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <PackageCheck className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-foreground text-sm">{d.cliente_nome}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                        <p className="text-xs text-muted-foreground">{d.servico}</p>
                        <div className="flex flex-wrap gap-1">
                          {d.tipo_saida && <Badge className="text-xs bg-primary/15 text-primary">{d.tipo_saida}</Badge>}
                          {d.valor_recibo != null && <Badge className="text-xs bg-green-500/15 text-green-700 dark:text-green-400">R$ {d.valor_recibo.toFixed(2)}</Badge>}
                        </div>
                        {d.retirado_at && <p className="text-xs text-muted-foreground">Retirada em {format(new Date(d.retirado_at), 'dd/MM/yyyy HH:mm')}</p>}
                      </div>
                    ))}
                    <PaginationControls page={retiradaPageIndex} totalPages={retiradaTotalPages} onPrev={() => setRetiradaPageIndex(p => p - 1)} onNext={() => setRetiradaPageIndex(p => p + 1)} />
                  </div>
                ) : (
                  <div>
                    <div className="rounded-xl border border-border overflow-hidden opacity-50">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="border-r border-border">Cliente</TableHead>
                            <TableHead className="border-r border-border">Serviço</TableHead>
                            <TableHead className="border-r border-border">Saída</TableHead>
                            <TableHead className="border-r border-border">Valor Recibo</TableHead>
                            <TableHead className="border-r border-border">Retirada em</TableHead>
                            <TableHead className="w-20">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {retiradaSlice.map(d => (
                            <TableRow key={d.id}>
                              <TableCell className="border-r border-border">
                                <div className="flex items-center gap-2">
                                  <PackageCheck className="h-4 w-4 text-green-600" />
                                  {d.cliente_nome}
                                </div>
                              </TableCell>
                              <TableCell className="border-r border-border">{d.servico}</TableCell>
                              <TableCell className="border-r border-border">
                                {d.tipo_saida ? <Badge className="text-xs bg-primary/15 text-primary">{d.tipo_saida}</Badge> : '—'}
                              </TableCell>
                              <TableCell className="border-r border-border">
                                {d.valor_recibo != null ? `R$ ${d.valor_recibo.toFixed(2)}` : '—'}
                              </TableCell>
                              <TableCell className="border-r border-border">{d.retirado_at ? format(new Date(d.retirado_at), 'dd/MM/yyyy HH:mm') : '—'}</TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <PaginationControls page={retiradaPageIndex} totalPages={retiradaTotalPages} onPrev={() => setRetiradaPageIndex(p => p - 1)} onNext={() => setRetiradaPageIndex(p => p + 1)} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Demandas concluídas e retiradas são excluídas automaticamente após 48 horas.</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Demanda' : 'Nova Demanda'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cliente search */}
            <div className="space-y-1">
              <Label>Cliente</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou digitar avulso..."
                  value={clienteSearch}
                  onChange={e => {
                    setClienteSearch(e.target.value);
                    setClientDropdownOpen(true);
                    setSelectedClienteId(null);
                    setClienteNome(e.target.value);
                  }}
                  onFocus={() => setClientDropdownOpen(true)}
                  className="pl-9 text-base"
                />
                {clientDropdownOpen && clienteSearch.trim() && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {filteredClientes.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => handleSelectCliente(c)}
                      >
                        {c.name}
                      </button>
                    ))}
                    {filteredClientes.length === 0 && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
                        onClick={handleClienteAvulso}
                      >
                        Usar "{clienteSearch}" como cliente avulso
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} className="text-base" /></div>
              <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} className="text-base" /></div>
            </div>

            {/* Obra e Solicitante - só para clientes cadastrados */}
            {selectedClienteId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Obra</Label>
                  <Select value={demandaObraId} onValueChange={setDemandaObraId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {obrasAll.filter(o => o.cliente_id === selectedClienteId).map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Solicitante</Label>
                  <Select value={demandaSolicitanteId} onValueChange={setDemandaSolicitanteId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {solicitantesAll.filter(s => s.cliente_id === selectedClienteId).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label>Serviço</Label>
              <div className="relative">
                <Input
                  placeholder="Buscar serviço ou digitar avulso..."
                  value={servico}
                  onChange={e => { setServico(e.target.value); setServicoDropdownOpen(true); }}
                  onFocus={() => setServicoDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setServicoDropdownOpen(false), 150)}
                  className="text-base"
                />
                {servicoDropdownOpen && servico.trim() && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {filteredServicos.length > 0 ? filteredServicos.map(s => (
                      <button
                        key={s.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => { setServico(s.description); setServicoDropdownOpen(false); }}
                      >
                        {s.description}
                      </button>
                    )) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Usando "{servico}" como serviço avulso
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição da demanda (opcional)"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="text-base"
              />
            </div>

            <div className="space-y-1">
              <Label>Responsável</Label>
              <div className="flex gap-2">
                <Select value={responsavelId} onValueChange={setResponsavelId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {responsaveis.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={newResponsavelOpen} onOpenChange={setNewResponsavelOpen}>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => setNewResponsavelOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <DialogContent className="sm:max-w-sm" onClick={e => e.stopPropagation()}>
                    <DialogHeader><DialogTitle>Novo Responsável</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Input placeholder="Nome do responsável" value={newResponsavelName} onChange={e => setNewResponsavelName(e.target.value)} className="text-base" />
                      <Button className="w-full" onClick={addResponsavel}>Salvar</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Prazo */}
            <div className="space-y-1">
              <Label>Prazo</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('flex-1 justify-start text-left font-normal', !prazo && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {prazo ? format(prazo, 'dd/MM/yyyy') : 'Data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={prazo} onSelect={setPrazo} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Input type="time" value={prazoHora} onChange={e => setPrazoHora(e.target.value)} className="w-28 text-base" />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Canal */}
            <div className="space-y-1">
              <Label>Canal</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {canalOptions.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full min-h-[44px]" onClick={handleSave}>
              {editingId ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Complete Dialog */}
      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja marcar esta demanda como concluída?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setConfirmCompleteOpen(false); setConfirmCompleteId(null); }}>Não</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmComplete}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Saída dialog */}
      <Dialog open={showSaidaDialog} onOpenChange={setShowSaidaDialog}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Tipo de saída</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Selecione o tipo de saída desta demanda:</p>
          <div className="flex flex-col gap-2">
            {['Entrega', 'Retirada Grande', 'Retirada Pequena'].map(option => (
              <Button
                key={option}
                variant={selectedSaida === option ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setSelectedSaida(option)}
              >
                {option}
              </Button>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <Button
              className="w-full"
              disabled={!selectedSaida}
              onClick={async () => {
                if (completedDemandaData?.id && selectedSaida) {
                  await supabase.from('demandas').update({ tipo_saida: selectedSaida }).eq('id', completedDemandaData.id);
                  fetchAll();
                }
                setShowSaidaDialog(false);
                setShowReciboButton(true);
              }}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Emitir Recibo overlay */}
      <Dialog open={showReciboButton} onOpenChange={setShowReciboButton}>
        <DialogContent className="sm:max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Demanda concluída!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">Deseja emitir um recibo para esta demanda?</p>
          <div className="flex flex-col gap-2">
            <Button className="w-full gap-2" onClick={() => {
              const clienteRegistrado = clientes.find(c => c.name.toLowerCase() === completedDemandaData?.cliente_nome?.toLowerCase());
              setShowReciboButton(false);
              navigate('/recibos', { state: {
                clienteNome: completedDemandaData?.cliente_nome,
                clienteId: clienteRegistrado?.id || completedDemandaData?.cliente_id || null,
                isAvulso: !clienteRegistrado,
                obraId: completedDemandaData?.obra_id || null,
                solicitanteId: completedDemandaData?.solicitante_id || null,
                demandaId: completedDemandaData?.id || null,
              } });
            }}>
              <FileText className="h-4 w-4" /> Emitir Recibo
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowReciboButton(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default DemandasPage;
