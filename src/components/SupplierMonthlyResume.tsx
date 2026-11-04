import { useMemo, useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Entity, Invoice, InvoiceStatus } from '@/types/finance';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  open: 'Em Aberto',
  paid: 'Pago',
  overdue: 'Atrasado',
};

const STATUS_COLOR: Record<InvoiceStatus, string> = {
  open: 'text-primary',
  paid: 'text-success',
  overdue: 'text-destructive',
};

interface Props {
  entities: Entity[];
  invoices: Invoice[];
}

const SupplierMonthlyResume = ({ entities, invoices }: Props) => {
  const suppliers = useMemo(() => entities.filter(e => e.type === 'supplier'), [entities]);
  const supplierIds = useMemo(() => new Set(suppliers.map(e => e.id)), [suppliers]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    invoices.forEach(inv => {
      if (!supplierIds.has(inv.entityId) || !inv.dueDate) return;
      months.add(inv.dueDate.slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [invoices, supplierIds]);

  const [selectedMonth, setSelectedMonth] = useState(availableMonths[0] ?? '');

  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const monthInvoices = useMemo(() => {
    if (!selectedMonth) return [];
    return invoices.filter(inv =>
      supplierIds.has(inv.entityId) && inv.dueDate?.startsWith(selectedMonth)
    );
  }, [invoices, supplierIds, selectedMonth]);

  const rows = useMemo(() => {
    return suppliers.map(supplier => {
      const invs = monthInvoices.filter(inv => inv.entityId === supplier.id);
      const total = invs.reduce((s, i) => s + i.value, 0);
      const byStatus = {
        open: invs.filter(i => i.status === 'open').reduce((s, i) => s + i.value, 0),
        paid: invs.filter(i => i.status === 'paid').reduce((s, i) => s + i.value, 0),
        overdue: invs.filter(i => i.status === 'overdue').reduce((s, i) => s + i.value, 0),
      };
      return { supplier, invs, total, byStatus };
    }).filter(r => r.invs.length > 0);
  }, [suppliers, monthInvoices]);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandPaid = rows.reduce((s, r) => s + r.byStatus.paid, 0);
  const grandOpen = rows.reduce((s, r) => s + r.byStatus.open, 0);
  const grandOverdue = rows.reduce((s, r) => s + r.byStatus.overdue, 0);

  const formatMonthLabel = (ym: string) => {
    if (!ym) return '';
    const [y, m] = ym.split('-');
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${months[parseInt(m) - 1]}/${y}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-semibold text-foreground">Resumo Mensal — Fornecedores</h3>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map(m => (
              <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {availableMonths.length === 0
            ? 'Nenhum título de fornecedor cadastrado.'
            : 'Nenhum título com vencimento neste mês.'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(['paid', 'open', 'overdue'] as InvoiceStatus[]).map(status => {
              const val = status === 'paid' ? grandPaid : status === 'open' ? grandOpen : grandOverdue;
              return (
                <div key={status} className="bg-secondary/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
                  <p className={`text-base font-bold ${STATUS_COLOR[status]}`}>{fmt(val)}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-center">Títulos</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Em Aberto</TableHead>
                  <TableHead className="text-right">Atrasado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ supplier, invs, total, byStatus }) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell className="text-center">{invs.length}</TableCell>
                    <TableCell className="text-right">{byStatus.paid > 0 ? fmt(byStatus.paid) : '—'}</TableCell>
                    <TableCell className="text-right">{byStatus.open > 0 ? fmt(byStatus.open) : '—'}</TableCell>
                    <TableCell className="text-right">{byStatus.overdue > 0 ? fmt(byStatus.overdue) : '—'}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">Total do Mês</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(grandPaid)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(grandOpen)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(grandOverdue)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{fmt(grandTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierMonthlyResume;
