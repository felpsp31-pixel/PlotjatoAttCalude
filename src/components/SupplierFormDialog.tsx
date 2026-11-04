import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Entity } from '@/types/finance';

interface SupplierFormDialogProps {
  onSave: (entity: Omit<Entity, 'id'>) => void;
  defaultValues?: Partial<Entity>;
  trigger?: ReactNode;
}

const maskCNPJ = (value: string) => {
  const nums = value.replace(/\D/g, '').slice(0, 14);
  return nums
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

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

const SupplierFormDialog = ({ onSave, defaultValues, trigger }: SupplierFormDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [cnpj, setCnpj] = useState(defaultValues?.document ?? '');
  const [phone, setPhone] = useState(defaultValues?.phone ?? '');
  const [email, setEmail] = useState(defaultValues?.email ?? '');

  const resetForm = () => {
    setName(defaultValues?.name ?? '');
    setCnpj(defaultValues?.document ?? '');
    setPhone(defaultValues?.phone ?? '');
    setEmail(defaultValues?.email ?? '');
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) resetForm();
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const rawCnpj = cnpj.replace(/\D/g, '');
    if (rawCnpj.length > 0 && !validarCNPJ(rawCnpj)) {
      toast.error('CNPJ inválido');
      return;
    }
    onSave({
      name: name.trim(),
      type: 'supplier',
      document: cnpj || undefined,
      phone: phone || undefined,
      email: email || undefined,
      retainsISS: false,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="outline" size="sm">+ Fornecedor</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultValues ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome / Razão Social *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierFormDialog;
