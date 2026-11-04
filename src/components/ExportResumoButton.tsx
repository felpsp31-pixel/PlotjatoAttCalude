import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Download, FileSpreadsheet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Entity, Invoice, InvoiceStatus } from '@/types/finance';

type ExportFormat = 'pdf' | 'excel';

interface ExportResumoButtonProps {
  entities: Entity[];
  invoices: Invoice[];
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  open: 'Em Aberto',
  paid: 'Pago',
  overdue: 'Atrasado',
};

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
};

const ExportResumoButton = ({ entities, invoices }: ExportResumoButtonProps) => {
  const [selectedEntityId, setSelectedEntityId] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [open, setOpen] = useState(false);

  const scopeEntities = entities.filter((e) => e.type === 'client');

  const filterInvoices = (invs: Invoice[]) => {
    return invs.filter((inv) => {
      const due = new Date(inv.dueDate + 'T00:00:00');
      if (startDate && due < startDate) return false;
      if (endDate && due > endDate) return false;
      if (selectedEntityId !== 'all' && inv.entityId !== selectedEntityId) return false;
      return true;
    });
  };

  const generatePdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    let yPos = 20;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo de Clientes', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const periodText = startDate && endDate
      ? `Período: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')}`
      : startDate
        ? `A partir de: ${format(startDate, 'dd/MM/yyyy')}`
        : endDate
          ? `Até: ${format(endDate, 'dd/MM/yyyy')}`
          : 'Período: Todos';
    doc.text(periodText, 14, yPos);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 120, yPos);
    yPos += 10;

    if (selectedEntityId !== 'all') {
      const ent = entities.find((e) => e.id === selectedEntityId);
      if (ent) {
        doc.text(`Filtro: ${ent.name}`, 14, yPos);
        yPos += 8;
      }
    }

    const addSection = (type: 'client' | 'supplier', label: string) => {
      const ents = selectedEntityId !== 'all'
        ? entities.filter((e) => e.id === selectedEntityId && e.type === type)
        : entities.filter((e) => e.type === type);
      const invs = filterInvoices(invoices.filter((inv) => ents.some((e) => e.id === inv.entityId)));

      if (ents.length === 0) return;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, yPos);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const total = invs.reduce((s, i) => s + i.value, 0);
      (['open', 'paid', 'overdue'] as InvoiceStatus[]).forEach((status) => {
        const statusTotal = invs.filter((i) => i.status === status).reduce((s, i) => s + i.value, 0);
        const pct = total > 0 ? ((statusTotal / total) * 100).toFixed(1) : '0.0';
        doc.text(`${STATUS_LABELS[status]}: ${fmt(statusTotal)} (${pct}%)`, 14, yPos);
        yPos += 5;
      });
      doc.text(`Total: ${fmt(total)}`, 14, yPos);
      yPos += 8;

      const rows = ents.map((ent) => {
        const entInvs = invs.filter((i) => i.entityId === ent.id);
        const entTotal = entInvs.reduce((s, i) => s + i.value, 0);
        return [ent.name, ent.document ?? '—', String(entInvs.length), fmt(entTotal)];
      });

      autoTable(doc, {
        startY: yPos,
        head: [[type === 'client' ? 'Cliente' : 'Fornecedor', 'CNPJ', 'Títulos', 'Valor Total']],
        body: rows,
        foot: [['Montante Total', '', String(invs.length), fmt(total)]],
        theme: 'grid',
        headStyles: { fillColor: [41, 98, 255], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          2: { halign: 'center' },
          3: { halign: 'right' },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 15;
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
    };

    addSection('client', 'Clientes');

    doc.save(`resumo-financeiro-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    setOpen(false);
  };

  const generateExcel = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const addSheet = (type: 'client' | 'supplier', sheetName: string) => {
      const ents = selectedEntityId !== 'all'
        ? entities.filter((e) => e.id === selectedEntityId && e.type === type)
        : entities.filter((e) => e.type === type);
      const invs = filterInvoices(invoices.filter((inv) => ents.some((e) => e.id === inv.entityId)));

      if (ents.length === 0) return;

      const rows = invs.map((inv) => {
        const ent = ents.find((e) => e.id === inv.entityId);
        return {
          'Nome': ent?.name ?? '',
          'CNPJ': ent?.document ?? '—',
          'Descrição': inv.description,
          'Valor (R$)': inv.value,
          'Vencimento': fmtDate(inv.dueDate),
          'Mês Ref.': inv.referenceMonth,
          'Status': STATUS_LABELS[inv.status],
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    };

    addSheet('client', 'Clientes');

    XLSX.writeFile(wb, `resumo-financeiro-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    setOpen(false);
  };

  const handleExport = async (exportFormat: ExportFormat) => {
    if (exportFormat === 'pdf') await generatePdf();
    else await generateExcel();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 pointer-events-auto" align="end">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-foreground">Exportar Resumo</h4>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Cliente</label>
            <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {scopeEntities.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Início</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !startDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Data Fim</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !endDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy') : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus locale={ptBR} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1" onClick={() => { setStartDate(undefined); setEndDate(undefined); setSelectedEntityId('all'); }}>
              Limpar filtros
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-2" onClick={() => handleExport('pdf')}>
              <Download className="h-4 w-4" />
              PDF
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ExportResumoButton;
