import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PdfUploadButton, { type ExtractedData } from './PdfUploadButton';
import PdfAttachButton from './PdfAttachButton';
import type { Invoice, Attachment } from '@/types/finance';

interface NewInvoiceDialogProps {
  entityId: string;
  onAdd: (invoice: Invoice) => void;
}

const NewInvoiceDialog = ({ entityId, onAdd }: NewInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [referenceMonth, setReferenceMonth] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const tempId = useState(() => `new-${Date.now()}`)[0];

  const resetForm = () => {
    setDescription('');
    setValue('');
    setDueDate('');
    setReferenceMonth('');
    setAttachments([]);
  };

  const handleExtracted = (data: ExtractedData) => {
    if (data.value != null) setValue(data.value.toString());
    if (data.dueDate) {
      setDueDate(data.dueDate);
      const d = new Date(data.dueDate + 'T00:00:00');
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      setReferenceMonth(`${months[d.getMonth()]}/${d.getFullYear()}`);
    }
    if (data.description) setDescription(data.description);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !value || !dueDate) return;

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      entityId,
      description,
      value: parseFloat(value),
      dueDate,
      referenceMonth: referenceMonth || '',
      status: 'open',
      attachments,
    };

    onAdd(invoice);
    resetForm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Lançamento
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Lançamento</DialogTitle>
        </DialogHeader>

        <div className="mb-4">
          <PdfUploadButton onExtracted={handleExtracted} variant="full" className="w-full" />
          <p className="text-xs text-muted-foreground mt-1.5">
            Importe um PDF de boleto ou nota fiscal para preencher automaticamente
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: NF 1234 - Consultoria"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Valor (R$)</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refMonth">Mês de Referência</Label>
            <Input
              id="refMonth"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              placeholder="Ex: Mar/2026"
            />
          </div>

          <div className="space-y-2">
            <Label>Anexos (PDF, imagens)</Label>
            <PdfAttachButton
              invoiceId={tempId}
              attachments={attachments}
              onAttached={(url, name) => setAttachments((prev) => [...prev, { url, name, date: new Date().toISOString() }])}
              variant="full"
            />
            {attachments.length > 0 && (
              <p className="text-xs text-muted-foreground">{attachments.length} arquivo(s) anexado(s)</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewInvoiceDialog;
