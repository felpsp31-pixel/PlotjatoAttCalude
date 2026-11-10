import InvoiceCard from './InvoiceCard';
import type { Invoice } from '@/types/finance';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface KanbanBoardProps {
  invoices: Invoice[];
  onMarkPaid?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: Partial<Invoice>) => void;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const soma = (l: Invoice[]) => l.reduce((s, i) => s + (Number(i.value) || 0), 0);

// Duas abas: "Em aberto" (tudo que foi faturado e ainda nao foi pago, com os
// atrasados primeiro) e "Recebido". Marcar como pago move de uma para a outra.
const KanbanBoard = ({ invoices, onMarkPaid, onDelete, onUpdate }: KanbanBoardProps) => {
  const abertos = invoices
    .filter((i) => i.status !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const recebidos = invoices
    .filter((i) => i.status === 'paid')
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const atrasados = abertos.filter((i) => i.status === 'overdue').length;

  const lista = (itens: Invoice[], vazio: string) => (
    <div className="h-full overflow-y-auto bg-kanban-column rounded-xl p-3">
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{vazio}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {itens.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} onMarkPaid={onMarkPaid} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Tabs defaultValue="aberto" className="flex flex-col h-full min-h-0">
      <TabsList className="self-start mb-3">
        <TabsTrigger value="aberto" className="gap-2">
          Em aberto
          <span className="text-xs text-muted-foreground">{abertos.length} · {brl(soma(abertos))}</span>
          {atrasados > 0 && (
            <span className="text-xs font-medium text-destructive">{atrasados} atrasado{atrasados > 1 ? 's' : ''}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="recebido" className="gap-2">
          Recebido
          <span className="text-xs text-muted-foreground">{recebidos.length} · {brl(soma(recebidos))}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="aberto" className="flex-1 min-h-0 mt-0">
        {lista(abertos, 'Nada em aberto.')}
      </TabsContent>
      <TabsContent value="recebido" className="flex-1 min-h-0 mt-0">
        {lista(recebidos, 'Nenhum recebimento ainda.')}
      </TabsContent>
    </Tabs>
  );
};

export default KanbanBoard;
