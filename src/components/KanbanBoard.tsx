import InvoiceCard from './InvoiceCard';
import type { Invoice, InvoiceStatus } from '@/types/finance';

interface KanbanBoardProps {
  invoices: Invoice[];
  onMarkPaid?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: Partial<Invoice>) => void;
}

const columns: { status: InvoiceStatus; label: string }[] = [
  { status: 'open', label: 'Em Aberto' },
  { status: 'paid', label: 'Paga' },
  { status: 'overdue', label: 'Atrasado' },
];

const columnHeaderColors: Record<InvoiceStatus, string> = {
  open: 'text-primary',
  paid: 'text-success',
  overdue: 'text-destructive',
};

const dotColors: Record<InvoiceStatus, string> = {
  open: 'bg-primary',
  paid: 'bg-success',
  overdue: 'bg-destructive',
};

const KanbanBoard = ({ invoices, onMarkPaid, onDelete, onUpdate }: KanbanBoardProps) => {
  return (
    <div className="flex gap-3 h-full overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:pb-0">
      {columns.map((col) => {
        const items = invoices.filter((inv) => inv.status === col.status);
        return (
          <div key={col.status} className="flex flex-col min-h-0 min-w-[260px] sm:min-w-0">
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className={`h-2.5 w-2.5 rounded-full ${dotColors[col.status]}`} />
              <h3 className={`text-sm font-semibold ${columnHeaderColors[col.status]}`}>
                {col.label}
              </h3>
              <span className="ml-auto text-xs font-medium text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
                {items.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto bg-kanban-column rounded-xl p-3 space-y-3">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum título
                </p>
              )}
              {items.map((inv) => (
                <InvoiceCard key={inv.id} invoice={inv} onMarkPaid={onMarkPaid} onDelete={onDelete} onUpdate={onUpdate} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KanbanBoard;
