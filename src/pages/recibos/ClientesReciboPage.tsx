import { useState } from 'react';
import { useRecibos } from '@/contexts/RecibosContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import Combobox from '@/components/recibos/Combobox';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const validarCNPJ = (cnpj: string): boolean => {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14 || /^(\d)\1+$/.test(nums)) return false;
  const calc = (x: number) => {
    const n = nums.slice(0, x);
    const w = n.split('').reduce((acc, v, i) =>
      acc + parseInt(v) * ((x - i - 1) % 8 + 2), 0);
    const r = 11 - (w % 11);
    return r >= 10 ? 0 : r;
  };
  return calc(12) === parseInt(nums[12]) && calc(13) === parseInt(nums[13]);
};

const formatCNPJ = (value: string): string => {
  const nums = value.replace(/\D/g, '').slice(0, 14);
  if (nums.length <= 2) return nums;
  if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
  if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
  if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`;
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
};

const validateCnpjField = (cnpj: string): boolean => {
  if (!cnpj || cnpj.replace(/\D/g, '').length === 0) return true;
  if (!validarCNPJ(cnpj)) {
    toast.error('CNPJ inválido');
    return false;
  }
  return true;
};

const ClientesReciboPage = () => {
  const {
    clientes, addCliente, updateCliente, deleteCliente,
    solicitantes, addSolicitante, updateSolicitante, deleteSolicitante,
    obras, addObra, updateObra, deleteObra,
    loading,
  } = useRecibos();

  const [cForm, setCForm] = useState({ name: '', cnpj: '', phone: '', email: '' });
  const [cEdit, setCEdit] = useState<string | null>(null);
  const [cEditData, setCEditData] = useState({ name: '', cnpj: '', phone: '', email: '' });

  const [sForm, setSForm] = useState({ clienteId: '', name: '', phone: '' });
  const [sEdit, setSEdit] = useState<string | null>(null);
  const [sEditData, setSEditData] = useState({ clienteId: '', name: '', phone: '' });

  const [oForm, setOForm] = useState({ clienteId: '', name: '', hasDelivery: false, deliveryValue: 0, exemptionValue: 0 });
  const [oEdit, setOEdit] = useState<string | null>(null);
  const [oEditData, setOEditData] = useState({ clienteId: '', name: '', hasDelivery: false, deliveryValue: 0, exemptionValue: 0 });

  const clienteOptions = clientes.map(c => ({ value: c.id, label: c.name }));

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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Clientes, Solicitantes e Obras</h1>
      <Tabs defaultValue="clientes">
        <TabsList className="flex-wrap">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="solicitantes">Solicitantes</TabsTrigger>
          <TabsTrigger value="obras">Obras</TabsTrigger>
          
        </TabsList>

        {/* CLIENTES */}
        <TabsContent value="clientes" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input placeholder="Nome" value={cForm.name} onChange={e => setCForm(p => ({ ...p, name: e.target.value }))} className="text-base" />
            <Input placeholder="CNPJ" value={cForm.cnpj} onChange={e => setCForm(p => ({ ...p, cnpj: formatCNPJ(e.target.value) }))} className="text-base" />
            <Input placeholder="Telefone" value={cForm.phone} onChange={e => setCForm(p => ({ ...p, phone: e.target.value }))} className="text-base" />
            <Input placeholder="Email" value={cForm.email} onChange={e => setCForm(p => ({ ...p, email: e.target.value }))} className="text-base" />
          </div>
          <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => {
            if (!cForm.name) { toast.error('Nome obrigatório'); return; }
            if (!validateCnpjField(cForm.cnpj)) return;
            addCliente(cForm); setCForm({ name: '', cnpj: '', phone: '', email: '' }); toast.success('Cliente adicionado');
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Telefone</TableHead><TableHead>Email</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
              <TableBody>
                {clientes.map(c => (
                  <TableRow key={c.id}>
                    {cEdit === c.id ? (
                      <>
                        <TableCell><Input value={cEditData.name} onChange={e => setCEditData(p => ({ ...p, name: e.target.value }))} className="text-base" /></TableCell>
                        <TableCell><Input value={cEditData.cnpj} onChange={e => setCEditData(p => ({ ...p, cnpj: formatCNPJ(e.target.value) }))} className="text-base" /></TableCell>
                        <TableCell><Input value={cEditData.phone} onChange={e => setCEditData(p => ({ ...p, phone: e.target.value }))} className="text-base" /></TableCell>
                        <TableCell><Input value={cEditData.email} onChange={e => setCEditData(p => ({ ...p, email: e.target.value }))} className="text-base" /></TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => {
                            if (!validateCnpjField(cEditData.cnpj)) return;
                            updateCliente(c.id, cEditData); setCEdit(null); toast.success('Atualizado');
                          }}><Check className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => setCEdit(null)}><X className="h-4 w-4" /></Button>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-foreground">{c.name}</TableCell>
                        <TableCell className="text-foreground">{c.cnpj}</TableCell>
                        <TableCell className="text-foreground">{c.phone}</TableCell>
                        <TableCell className="text-foreground">{c.email}</TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { setCEdit(c.id); setCEditData({ name: c.name, cnpj: c.cnpj, phone: c.phone, email: c.email }); }}><Pencil className="h-4 w-4" /></Button>
                          <DeleteButton onConfirm={() => { deleteCliente(c.id); toast.success('Removido'); }} />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* SOLICITANTES */}
        <TabsContent value="solicitantes" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Combobox options={clienteOptions} value={sForm.clienteId} onValueChange={v => setSForm(p => ({ ...p, clienteId: v }))} placeholder="Cliente" />
            <Input placeholder="Nome" value={sForm.name} onChange={e => setSForm(p => ({ ...p, name: e.target.value }))} className="text-base" />
            <Input placeholder="Telefone" value={sForm.phone} onChange={e => setSForm(p => ({ ...p, phone: e.target.value }))} className="text-base" />
          </div>
          <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => { if (!sForm.clienteId || !sForm.name) { toast.error('Preencha cliente e nome'); return; } addSolicitante(sForm); setSForm({ clienteId: '', name: '', phone: '' }); toast.success('Solicitante adicionado'); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
              <TableBody>
                {solicitantes.map(s => {
                  const clienteName = clientes.find(c => c.id === s.clienteId)?.name ?? '—';
                  return (
                    <TableRow key={s.id}>
                      {sEdit === s.id ? (
                        <>
                          <TableCell><Combobox options={clienteOptions} value={sEditData.clienteId} onValueChange={v => setSEditData(p => ({ ...p, clienteId: v }))} placeholder="Cliente" /></TableCell>
                          <TableCell><Input value={sEditData.name} onChange={e => setSEditData(p => ({ ...p, name: e.target.value }))} className="text-base" /></TableCell>
                          <TableCell><Input value={sEditData.phone} onChange={e => setSEditData(p => ({ ...p, phone: e.target.value }))} className="text-base" /></TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { updateSolicitante(s.id, sEditData); setSEdit(null); toast.success('Atualizado'); }}><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => setSEdit(null)}><X className="h-4 w-4" /></Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-foreground">{clienteName}</TableCell>
                          <TableCell className="text-foreground">{s.name}</TableCell>
                          <TableCell className="text-foreground">{s.phone}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { setSEdit(s.id); setSEditData({ clienteId: s.clienteId, name: s.name, phone: s.phone }); }}><Pencil className="h-4 w-4" /></Button>
                            <DeleteButton onConfirm={() => { deleteSolicitante(s.id); toast.success('Removido'); }} />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* OBRAS */}
        <TabsContent value="obras" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Combobox options={clienteOptions} value={oForm.clienteId} onValueChange={v => setOForm(p => ({ ...p, clienteId: v }))} placeholder="Cliente" />
            <Input placeholder="Nome da obra" value={oForm.name} onChange={e => setOForm(p => ({ ...p, name: e.target.value }))} className="text-base" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              Entrega?
              <Switch checked={oForm.hasDelivery} onCheckedChange={v => setOForm(p => ({ ...p, hasDelivery: v, deliveryValue: v ? p.deliveryValue : 0, exemptionValue: v ? p.exemptionValue : 0 }))} />
            </label>
            {oForm.hasDelivery && (
              <>
                <Input type="number" min={0} step="0.01" placeholder="Valor da entrega"
                  value={oForm.deliveryValue || ''} onChange={e => setOForm(p => ({ ...p, deliveryValue: Number(e.target.value) || 0 }))}
                  className="text-base w-40" />
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  Isenção a partir de:
                  <Input type="number" min={0} step="0.01" placeholder="Valor de isenção"
                    value={oForm.exemptionValue || ''} onChange={e => setOForm(p => ({ ...p, exemptionValue: Number(e.target.value) || 0 }))}
                    className="text-base w-40" />
                </label>
              </>
            )}
          </div>
          <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={() => {
            if (!oForm.clienteId || !oForm.name) { toast.error('Preencha cliente e nome'); return; }
            addObra(oForm); setOForm({ clienteId: '', name: '', hasDelivery: false, deliveryValue: 0, exemptionValue: 0 }); toast.success('Obra adicionada');
          }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Obra</TableHead><TableHead>Entrega</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
              <TableBody>
                {obras.map(o => {
                  const clienteName = clientes.find(c => c.id === o.clienteId)?.name ?? '—';
                  return (
                    <TableRow key={o.id}>
                      {oEdit === o.id ? (
                        <>
                          <TableCell><Combobox options={clienteOptions} value={oEditData.clienteId} onValueChange={v => setOEditData(p => ({ ...p, clienteId: v }))} placeholder="Cliente" /></TableCell>
                          <TableCell><Input value={oEditData.name} onChange={e => setOEditData(p => ({ ...p, name: e.target.value }))} className="text-base" /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Switch checked={oEditData.hasDelivery} onCheckedChange={v => setOEditData(p => ({ ...p, hasDelivery: v, deliveryValue: v ? p.deliveryValue : 0, exemptionValue: v ? p.exemptionValue : 0 }))} />
                              {oEditData.hasDelivery && (
                                <>
                                  <Input type="number" min={0} step="0.01" value={oEditData.deliveryValue || ''} placeholder="Entrega"
                                    onChange={e => setOEditData(p => ({ ...p, deliveryValue: Number(e.target.value) || 0 }))} className="text-base w-24" />
                                  <Input type="number" min={0} step="0.01" value={oEditData.exemptionValue || ''} placeholder="Isenção"
                                    onChange={e => setOEditData(p => ({ ...p, exemptionValue: Number(e.target.value) || 0 }))} className="text-base w-24" />
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { updateObra(o.id, oEditData); setOEdit(null); toast.success('Atualizado'); }}><Check className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => setOEdit(null)}><X className="h-4 w-4" /></Button>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-foreground">{clienteName}</TableCell>
                          <TableCell className="text-foreground">{o.name}</TableCell>
                          <TableCell className="text-foreground">
                            {o.hasDelivery ? (
                              <span>
                                {o.deliveryValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                {o.exemptionValue > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">(isento acima de {o.exemptionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>
                                )}
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="icon" variant="ghost" className="min-h-[44px] min-w-[44px]" onClick={() => { setOEdit(o.id); setOEditData({ clienteId: o.clienteId, name: o.name, hasDelivery: o.hasDelivery, deliveryValue: o.deliveryValue, exemptionValue: o.exemptionValue }); }}><Pencil className="h-4 w-4" /></Button>
                            <DeleteButton onConfirm={() => { deleteObra(o.id); toast.success('Removida'); }} />
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientesReciboPage;
