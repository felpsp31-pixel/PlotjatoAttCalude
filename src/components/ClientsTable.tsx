import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableFooter } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { Entity, Invoice, InvoiceStatus } from '@/types/finance';

interface ClientsTableProps {
  entities: Entity[];
  invoices: Invoice[];
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  open: { label: 'Em Aberto', color: 'hsl(217, 91%, 60%)' },
  paid: { label: 'Pago', color: 'hsl(142, 71%, 45%)' },
  overdue: { label: 'Atrasado', color: 'hsl(0, 84%, 60%)' },
};

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const ClientsTable = ({ entities, invoices }: ClientsTableProps) => {
  const clients = entities.filter((e) => e.type === 'client');
  const clientInvoices = invoices.filter((inv) =>
    clients.some((c) => c.id === inv.entityId)
  );

  const clientData = clients.map((client) => {
    const invs = clientInvoices.filter((inv) => inv.entityId === client.id);
    const total = invs.reduce((sum, inv) => sum + inv.value, 0);
    return { ...client, total, invoiceCount: invs.length };
  });

  const grandTotal = clientData.reduce((sum, c) => sum + c.total, 0);

  // Chart data by status
  const statusTotals = (['open', 'paid', 'overdue'] as InvoiceStatus[]).map((status) => {
    const value = clientInvoices
      .filter((inv) => inv.status === status)
      .reduce((sum, inv) => sum + inv.value, 0);
    return { status, value, ...STATUS_CONFIG[status] };
  });

  const totalForPercent = statusTotals.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      {/* Chart + Legend */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Resumo por Status — Clientes</h3>
        <div className="flex items-center gap-8">
          <div className="w-48 h-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusTotals}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                >
                  {statusTotals.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-4 min-w-0 overflow-hidden">
            {statusTotals.map((item) => {
              const pct = totalForPercent > 0 ? ((item.value / totalForPercent) * 100).toFixed(1) : '0.0';
              return (
                <div key={item.status} className="bg-secondary/50 rounded-lg p-3 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-medium text-muted-foreground truncate">{item.label}</span>
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{fmt(item.value)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead className="text-center">Títulos</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientData.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium truncate max-w-[150px]">{client.name}</TableCell>
                <TableCell className="text-muted-foreground truncate max-w-[120px]">{client.document ?? '—'}</TableCell>
                <TableCell className="text-center">{client.invoiceCount}</TableCell>
                <TableCell className="text-right font-semibold text-sm whitespace-nowrap">{fmt(client.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-semibold">Montante Total</TableCell>
              <TableCell className="text-right font-bold text-primary text-base">{fmt(grandTotal)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
};

export default ClientsTable;
