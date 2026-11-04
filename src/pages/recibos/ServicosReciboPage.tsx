import { useState, useMemo, useEffect } from 'react';
import { useRecibos } from '@/contexts/RecibosContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import Combobox from '@/components/recibos/Combobox';
import { Plus, Pencil, Trash2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const PAGE_SIZE = 10;

const DeleteButton = ({ onConfirm }: { onConfirm: () => void }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]"><Trash2 className="h-4 w-4" /></Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancelar</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Confirmar</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// Calcula o próximo código sequencial baseado nos códigos numéricos existentes
const computeNextCode = (codes: string[]): string => {
  const numericCodes = codes
    .map(c => parseInt(String(c).replace(/\D/g, ''), 10))
    .filter(n => !isNaN(n));
  const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;
  return String(max + 1);
};

const ServicosReciboPage = () => {
  const {
    servicos, addServico, updateServico, deleteServico,
    clientes, clientServices, addClientService, updateClientService, deleteClientService,
    loading,
  } = useRecibos();

  // Global services state
  const [form, setForm] = useState({ code: '', description: '', unitPrice: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ code: '', description: '', unitPrice: '' });
  const [globalPage, setGlobalPage] = useState(1);

  // Client services state
  const [csFilterClienteId, setCsFilterClienteId] = useState('');
  const [csForm, setCsForm] = useState({ clienteId: '', code: '', description: '', unitPrice: 0 });
  const [csEdit, setCsEdit] = useState<string | null>(null);
  const [csEditData, setCsEditData] = useState({ code: '', description: '', unitPrice: 0 });
  const [clientPage, setClientPage] = useState(1);

  const clienteOptions = clientes.map(c => ({ value: c.id, label: c.name }));

  // Auto-incremento do código global
  const nextGlobalCode = useMemo(() => computeNextCode(servicos.map(s => s.code)), [servicos]);
  useEffect(() => {
    setForm(p => (p.code === '' ? { ...p, code: nextGlobalCode } : p));
  }, [nextGlobalCode]);

  // Auto-incremento do código por cliente (considera todos os serviços do cliente + globais)
  const nextClientCode = useMemo(() => {
    if (!csForm.clienteId) return '';
    const codesDoCliente = clientServices
      .filter(cs => cs.clienteId === csForm.clienteId)
      .map(cs => cs.code);
    const allCodes = [...servicos.map(s => s.code), ...codesDoCliente];
    return computeNextCode(allCodes);
  }, [csForm.clienteId, clientServices, servicos]);
  useEffect(() => {
    setCsForm(p => ({ ...p, code: nextClientCode }));
  }, [nextClientCode]);

  const filteredClientServices = useMemo(() =>
    csFilterClienteId ? clientServices.filter(cs => cs.clienteId === csFilterClienteId) : clientServices,
    [clientServices, csFilterClienteId]
  );

  // Paginação - serviços globais
  const globalTotalPages = Math.max(1, Math.ceil(servicos.length / PAGE_SIZE));
  const currentGlobalPage = Math.min(globalPage, globalTotalPages);
  const paginatedServicos = useMemo(() => {
    const start = (currentGlobalPage - 1) * PAGE_SIZE;
    return servicos.slice(start, start + PAGE_SIZE);
  }, [servicos, currentGlobalPage]);

  // Paginação - serviços por cliente
  const clientTotalPages = Math.max(1, Math.ceil(filteredClientServices.length / PAGE_SIZE));
  const currentClientPage = Math.min(clientPage, clientTotalPages);
  const paginatedClientServices = useMemo(() => {
    const start = (currentClientPage - 1) * PAGE_SIZE;
    return filteredClientServices.slice(start, start + PAGE_SIZE);
  }, [filteredClientServices, currentClientPage]);

  // Reseta para página 1 ao mudar filtro
  useEffect(() => { setClientPage(1); }, [csFilterClienteId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const PaginationControls = ({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
      <Pagination className="mt-2">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              disabled={page <= 1}
              onClick={() => onChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
          </PaginationItem>
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            return (
              <PaginationItem key={p}>
                <PaginationLink
                  isActive={p === page}
                  onClick={(e) => { e.preventDefault(); onChange(p); }}
                  href="#"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              disabled={page >= totalPages}
              onClick={() => onChange(page + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };

  return (
    <div className="space-y-4 h-full flex flex-col overflow-y-auto pr-1">
      <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
      <Tabs defaultValue="globais" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="globais">Serviços Globais</TabsTrigger>
          <TabsTrigger value="cliente">Serviços por Cliente</TabsTrigger>
        </TabsList>

        {/* SERVIÇOS GLOBAIS */}
        <TabsContent value="globais" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end flex-wrap">
            <Input placeholder="Código" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} className="w-full sm:w-28 text-base" />
            <Input placeholder="Descrição" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="w-full sm:w-60 text-base" />
            <Input placeholder="Valor unitário" type="number" value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))} className="w-full sm:w-36 text-base" />
            <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => {
              if (!form.code || !form.description) { toast.error('Preencha código e descrição'); return; }
              addServico({ code: form.code, description: form.description, unitPrice: Number(form.unitPrice) || 0 });
              setForm({ code: '', description: '', unitPrice: '' });
              toast.success('Serviço adicionado');
              setGlobalPage(Math.ceil((servicos.length + 1) / PAGE_SIZE));
            }}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead>Valor Unitário</TableHead><TableHead className="w-24" /></TableRow>
              </TableHeader>
              <TableBody>
                {paginatedServicos.map(s => (
                  <TableRow key={s.id}>
                    {editId === s.id ? (
                      <>
                        <TableCell><Input value={editData.code} onChange={e => setEditData(p => ({ ...p, code: e.target.value }))} className="text-base" /></TableCell>
                        <TableCell><Input value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} className="text-base" /></TableCell>
                        <TableCell><Input type="number" value={editData.unitPrice} onChange={e => setEditData(p => ({ ...p, unitPrice: e.target.value }))} className="text-base" /></TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { updateServico(s.id, { code: editData.code, description: editData.description, unitPrice: Number(editData.unitPrice) || 0 }); setEditId(null); toast.success('Atualizado'); }}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => setEditId(null)}><X className="h-4 w-4" /></Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-foreground">{s.code}</TableCell>
                        <TableCell className="text-foreground">{s.description}</TableCell>
                        <TableCell className="text-foreground">{s.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { setEditId(s.id); setEditData({ code: s.code, description: s.description, unitPrice: String(s.unitPrice) }); }}><Pencil className="h-4 w-4" /></Button>
                          <DeleteButton onConfirm={() => { deleteServico(s.id); toast.success('Removido'); }} />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {servicos.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum serviço cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {paginatedServicos.length} de {servicos.length} serviços
            </span>
            <PaginationControls page={currentGlobalPage} totalPages={globalTotalPages} onChange={setGlobalPage} />
          </div>
        </TabsContent>

        {/* SERVIÇOS POR CLIENTE */}
        <TabsContent value="cliente" className="space-y-4">
          <p className="text-sm text-muted-foreground">Cadastre serviços com valores específicos para cada cliente. Eles aparecerão na emissão de recibo junto aos serviços globais.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Combobox options={clienteOptions} value={csForm.clienteId} onValueChange={v => setCsForm(p => ({ ...p, clienteId: v }))} placeholder="Cliente" />
            <Input placeholder="Código" value={csForm.code} onChange={e => setCsForm(p => ({ ...p, code: e.target.value }))} className="text-base" />
            <Input placeholder="Descrição" value={csForm.description} onChange={e => setCsForm(p => ({ ...p, description: e.target.value }))} className="text-base" />
            <Input type="number" min={0} step="0.01" placeholder="Valor unitário" value={csForm.unitPrice || ''} onChange={e => setCsForm(p => ({ ...p, unitPrice: Number(e.target.value) || 0 }))} className="text-base" />
          </div>
          <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => {
            if (!csForm.clienteId || !csForm.code || !csForm.description) { toast.error('Preencha cliente, código e descrição'); return; }
            addClientService(csForm);
            setCsForm({ clienteId: '', code: '', description: '', unitPrice: 0 });
            toast.success('Serviço do cliente adicionado');
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtrar por cliente:</span>
            <div className="w-64">
              <Combobox
                options={[{ value: '', label: 'Todos' }, ...clienteOptions]}
                value={csFilterClienteId}
                onValueChange={setCsFilterClienteId}
                placeholder="Todos"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor Unit.</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClientServices.map(cs => {
                  const clienteName = clientes.find(c => c.id === cs.clienteId)?.name ?? '—';
                  return (
                    <TableRow key={cs.id}>
                      {csEdit === cs.id ? (
                        <>
                          <TableCell className="text-foreground">{clienteName}</TableCell>
                          <TableCell><Input value={csEditData.code} onChange={e => setCsEditData(p => ({ ...p, code: e.target.value }))} className="text-base" /></TableCell>
                          <TableCell><Input value={csEditData.description} onChange={e => setCsEditData(p => ({ ...p, description: e.target.value }))} className="text-base" /></TableCell>
                          <TableCell><Input type="number" min={0} step="0.01" value={csEditData.unitPrice || ''} onChange={e => setCsEditData(p => ({ ...p, unitPrice: Number(e.target.value) || 0 }))} className="text-base w-24" /></TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { updateClientService(cs.id, csEditData); setCsEdit(null); toast.success('Atualizado'); }}><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => setCsEdit(null)}><X className="h-4 w-4" /></Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-foreground">{clienteName}</TableCell>
                          <TableCell className="text-foreground">{cs.code}</TableCell>
                          <TableCell className="text-foreground">{cs.description}</TableCell>
                          <TableCell className="text-foreground">{cs.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { setCsEdit(cs.id); setCsEditData({ code: cs.code, description: cs.description, unitPrice: cs.unitPrice }); }}><Pencil className="h-4 w-4" /></Button>
                            <DeleteButton onConfirm={() => { deleteClientService(cs.id); toast.success('Removido'); }} />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
                {filteredClientServices.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum serviço específico cadastrado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {paginatedClientServices.length} de {filteredClientServices.length} serviços
            </span>
            <PaginationControls page={currentClientPage} totalPages={clientTotalPages} onChange={setClientPage} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ServicosReciboPage;
