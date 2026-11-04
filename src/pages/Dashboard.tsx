import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LogOut, Receipt, PanelLeftClose, PanelLeftOpen, CalendarClock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ImportNotaFiscalDialog from '@/components/ImportNotaFiscalDialog';
import { useRecibos } from '@/contexts/RecibosContext';
import { useAuth } from '@/contexts/AuthContext';
import EntitySidebar, { type SidebarTab } from '@/components/EntitySidebar';
import EntityHeader from '@/components/EntityHeader';
import KanbanBoard from '@/components/KanbanBoard';
import StatusSummaryCards from '@/components/StatusSummaryCards';
import ClientsTable from '@/components/ClientsTable';
import ExportResumoButton from '@/components/ExportResumoButton';
import SupplierMonthlyResume from '@/components/SupplierMonthlyResume';
import EvolucaoFinanceira from '@/components/EvolucaoFinanceira';
import NewInvoiceDialog from '@/components/NewInvoiceDialog';
import type { Entity } from '@/types/finance';
import { useFinancialInvoices } from '@/hooks/useFinancialInvoices';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MIN_SIDEBAR = 260;
const MAX_SIDEBAR = 450;

const Dashboard = () => {
  const { signOut } = useAuth();
  const { montantePorCliente, clientes } = useRecibos();
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const isMobile = useIsMobile();
  const totalOperacional = montantePorCliente.reduce((s, m) => s + m.total, 0);

  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', document: '', phone: '', email: '' });

  // "Gerar lançamentos do mês" dialog
  const defaultMonth = (() => {
    const d = new Date();
    const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  })();
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(defaultMonth);
  const [generating, setGenerating] = useState(false);

  const [casualClients, setCasualClients] = useState<Entity[]>([]);

  useEffect(() => {
    const fetchCasual = async () => {
      const { data } = await supabase.from('clientes_avulsos' as any).select('*').order('created_at', { ascending: false });
      if (data) {
        setCasualClients((data as any[]).map(c => ({
          id: c.id,
          name: c.name,
          type: 'casual' as const,
          phone: c.phone || undefined,
          email: c.email || undefined,
          retainsISS: false,
        })));
      }
    };
    fetchCasual();
  }, []);

  const allEntities = useMemo<Entity[]>(() => {
    const merged = [...suppliers];
    const existingDocs = new Set(suppliers.map(e => e.document).filter(Boolean));
    for (const c of clientes) {
      if (!existingDocs.has(c.cnpj)) {
        merged.push({
          id: c.id,
          name: c.name,
          type: 'client' as const,
          phone: c.phone || undefined,
          email: c.email || undefined,
          document: c.cnpj,
          retainsISS: false,
        });
      }
    }
    // Add casual clients
    merged.push(...casualClients);
    return merged;
  }, [suppliers, clientes, casualClients]);

  const { invoices, handleMarkPaid, handleDelete, handleUpdate, handleAdd, refetch } = useFinancialInvoices();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => isMobile);
  const [resumoOpen, setResumoOpen] = useState(false);
  const [evolucaoOpen, setEvolucaoOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('clients');
  const dragging = useRef(false);

  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  const selectedEntity = allEntities.find((e) => e.id === selectedId) ?? null;
  const entityInvoices = selectedId
    ? invoices.filter((inv) => inv.entityId === selectedId)
    : [];

  const handleAddSupplier = async () => {
    if (!supplierForm.name.trim()) { toast.warning('Nome obrigatório'); return; }
    const newEntity = await addSupplier({
      name: supplierForm.name.trim(),
      type: 'supplier',
      document: supplierForm.document.trim() || undefined,
      phone: supplierForm.phone.trim() || undefined,
      email: supplierForm.email.trim() || undefined,
      retainsISS: false,
    });
    if (newEntity) {
      setSelectedId(newEntity.id);
      setSupplierForm({ name: '', document: '', phone: '', email: '' });
      setSupplierDialogOpen(false);
      toast.success('Fornecedor cadastrado com sucesso!');
    }
  };

  const handleGenerateMonth = async () => {
    if (!/^\d{4}-\d{2}$/.test(generateMonth)) {
      toast.error('Selecione um mês válido.');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-monthly-invoices', {
        body: { month: generateMonth },
      });
      if (error) throw error;
      const inseridos = (data?.inseridos ?? 0) + (data?.legacyInseridos ?? 0);
      const ja = data?.jaExistiam ?? 0;
      if (inseridos > 0) {
        toast.success(`${inseridos} lançamento(s) gerado(s) para ${data?.referenceMonth ?? generateMonth}.`);
      } else if (ja > 0) {
        toast.info(`Nenhum novo lançamento — ${ja} cliente(s) já possuíam fatura para este mês.`);
      } else {
        toast.info('Nenhum recibo encontrado para este mês.');
      }
      await refetch();
      setGenerateOpen(false);
    } catch (e: any) {
      toast.error(`Falha ao gerar lançamentos: ${e?.message ?? 'erro desconhecido'}`);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (invoices.length === 0) return;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const overdueToday = invoices.filter((inv) => inv.dueDate === todayStr && inv.status !== 'paid');
    overdueToday.forEach((inv) => {
      const entity = allEntities.find((e) => e.id === inv.entityId);
      if (entity) {
        toast.warning(`Atenção: Nota de ${entity.name} vence hoje!`, { duration: 5000, closeButton: true });
      }
    });

    const overdue = invoices.filter((inv) => inv.status === 'overdue');
    if (overdue.length > 0) {
      toast.warning(`${overdue.length} título(s) em atraso detectado(s).`, { duration: 5000, closeButton: true });
    }

    const supplierEntities = allEntities.filter((e) => e.type === 'supplier');
    const supplierIds = new Set(supplierEntities.map((e) => e.id));
    const dueTomorrow = invoices.filter(
      (inv) => inv.dueDate === tomorrowStr && inv.status !== 'paid' && supplierIds.has(inv.entityId)
    );
    dueTomorrow.forEach((inv) => {
      const entity = supplierEntities.find((e) => e.id === inv.entityId);
      if (entity) {
        const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.value);
        toast.warning(
          `Fornecedor "${entity.name}" tem título de ${formatted} vencendo amanhã!`,
          { duration: 8000, closeButton: true }
        );
      }
    });
  }, [invoices, allEntities]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, e.clientX));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {!sidebarCollapsed && !isMobile && (
        <>
          <div style={{ width: sidebarWidth, minWidth: MIN_SIDEBAR, maxWidth: MAX_SIDEBAR }} className="shrink-0">
            <EntitySidebar
              entities={allEntities}
              invoices={invoices}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpenResumo={() => setResumoOpen(true)}
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
            />
          </div>
          <div
            onMouseDown={startDrag}
            className="w-1 hover:w-1.5 bg-border hover:bg-primary/30 cursor-col-resize transition-all duration-150 shrink-0"
          />
        </>
      )}

      {isMobile && !sidebarCollapsed && (
        <Sheet open={!sidebarCollapsed} onOpenChange={(open) => setSidebarCollapsed(!open)}>
          <SheetContent side="left" className="w-full max-w-[300px] p-0">
            <EntitySidebar
              entities={allEntities}
              invoices={invoices}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setSidebarCollapsed(true); }}
              onOpenResumo={() => setResumoOpen(true)}
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-4">
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            className="p-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={sidebarCollapsed ? 'Mostrar painel' : 'Ocultar painel'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <div className="flex-1" />
          <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <CalendarClock className="h-4 w-4" />
                <span className="hidden sm:inline">Gerar lançamentos do mês</span>
                <span className="sm:hidden">Gerar mês</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Gerar lançamentos do mês</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Mês de referência</Label>
                  <Input
                    type="month"
                    value={generateMonth}
                    onChange={e => setGenerateMonth(e.target.value)}
                    className="text-base mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cria um lançamento por cliente no Financeiro com a soma dos recibos do mês selecionado. Clientes que já possuírem fatura para este mês são ignorados.
                  </p>
                </div>
                <Button className="w-full min-h-[44px]" onClick={handleGenerateMonth} disabled={generating}>
                  {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando…</> : 'Gerar lançamentos'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          {sidebarTab === 'suppliers' && (
            <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">+ Fornecedor</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Cadastrar Fornecedor</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Nome / Razão Social *</Label>
                    <Input placeholder="Nome do fornecedor" value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))} className="text-base mt-1" />
                  </div>
                  <div>
                    <Label>CNPJ</Label>
                    <Input placeholder="00.000.000/0000-00" value={supplierForm.document} onChange={e => setSupplierForm(p => ({ ...p, document: e.target.value }))} className="text-base mt-1" />
                  </div>
                  <div>
                    <Label>Telefone</Label>
                    <Input placeholder="(00) 00000-0000" value={supplierForm.phone} onChange={e => setSupplierForm(p => ({ ...p, phone: e.target.value }))} className="text-base mt-1" />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input placeholder="email@fornecedor.com" value={supplierForm.email} onChange={e => setSupplierForm(p => ({ ...p, email: e.target.value }))} className="text-base mt-1" />
                  </div>
                  <Button className="w-full min-h-[44px]" onClick={handleAddSupplier}>
                    Cadastrar Fornecedor
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0 p-4 sm:p-6 pt-2 overflow-hidden">
        {selectedEntity ? (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2 sm:gap-4">
              <EntityHeader
                entity={selectedEntity}
                onUpdate={selectedEntity?.type === 'supplier' ? (data) => {
                  updateSupplier(selectedEntity.id, data);
                } : undefined}
                onDelete={selectedEntity?.type === 'supplier' ? () => {
                  deleteSupplier(selectedEntity.id);
                  setSelectedId(null);
                  toast.success('Fornecedor removido.');
                } : undefined}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <ImportNotaFiscalDialog />
                <NewInvoiceDialog entityId={selectedEntity.id} onAdd={handleAdd} />
                <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" onClick={signOut} title="Sair">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <StatusSummaryCards invoices={entityInvoices} />
            
            <div className="flex-1 min-h-0">
              <KanbanBoard invoices={entityInvoices} onMarkPaid={handleMarkPaid} onDelete={handleDelete} onUpdate={handleUpdate} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            Selecione um cliente ou fornecedor
          </div>
        )}
        </div>
      </div>

      <Sheet open={resumoOpen} onOpenChange={setResumoOpen}>
        <SheetContent side="left" className="w-full sm:w-[600px] sm:max-w-none overflow-y-auto">
          <SheetHeader className="flex flex-row items-center justify-between pr-8">
            <SheetTitle>Resumo Financeiro</SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setResumoOpen(false); setEvolucaoOpen(true); }}
              >
                Evolução
              </Button>
              <ExportResumoButton entities={allEntities} invoices={invoices} />
            </div>
          </SheetHeader>
          <div className="mt-4 space-y-6">
            <ClientsTable entities={allEntities} invoices={invoices} />
            <SupplierMonthlyResume entities={allEntities} invoices={invoices} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={evolucaoOpen} onOpenChange={setEvolucaoOpen}>
        <SheetContent side="left" className="w-full sm:w-[600px] sm:max-w-none overflow-y-auto">
          <SheetHeader className="flex flex-row items-center justify-between pr-8 flex-wrap gap-2 mb-4">
            <SheetTitle>Evolução Financeira</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEvolucaoOpen(false); setResumoOpen(true); }}
            >
              ← Resumo
            </Button>
          </SheetHeader>
          <div className="mt-4">
            <EvolucaoFinanceira entities={allEntities} invoices={invoices} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Dashboard;
