import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import type { Entity, Invoice } from '@/types/finance';

interface Props {
  entities: Entity[];
  invoices: Invoice[];
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH_ORDER = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const parseYM = (ym: string) => {
  const [y, m] = ym.split('-');
  return { year: parseInt(y), month: parseInt(m) };
};

const formatYM = (ym: string) => {
  const { year, month } = parseYM(ym);
  return `${MONTH_ORDER[month - 1]}/${year}`;
};

const sortYM = (a: string, b: string) => {
  const pa = parseYM(a), pb = parseYM(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.month - pb.month;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const EvolucaoFinanceira = ({ entities, invoices }: Props) => {
  const clientIds = useMemo(
    () => new Set(entities.filter(e => e.type === 'client').map(e => e.id)),
    [entities]
  );
  const supplierIds = useMemo(
    () => new Set(entities.filter(e => e.type === 'supplier').map(e => e.id)),
    [entities]
  );

  const clientDataMap = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(inv => {
      if (!clientIds.has(inv.entityId)) return;
      const ref = inv.referenceMonth;
      if (!ref) return;
      const [mon, year] = ref.split('/');
      const monthIdx = MONTH_ORDER.indexOf(mon);
      if (monthIdx === -1 || !year) return;
      const ym = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      map.set(ym, (map.get(ym) ?? 0) + inv.value);
    });
    return map;
  }, [invoices, clientIds]);

  const supplierDataMap = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach(inv => {
      if (!supplierIds.has(inv.entityId) || !inv.dueDate) return;
      const ym = inv.dueDate.slice(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + inv.value);
    });
    return map;
  }, [invoices, supplierIds]);

  const allMonths = useMemo(() => {
    const months = new Set([...clientDataMap.keys(), ...supplierDataMap.keys()]);
    return Array.from(months).sort(sortYM);
  }, [clientDataMap, supplierDataMap]);

  const clientChartData = useMemo(() =>
    allMonths.map(ym => ({ mes: formatYM(ym), Faturado: clientDataMap.get(ym) ?? 0 })),
    [allMonths, clientDataMap]
  );

  const supplierChartData = useMemo(() =>
    allMonths.map(ym => ({ mes: formatYM(ym), Gasto: supplierDataMap.get(ym) ?? 0 })),
    [allMonths, supplierDataMap]
  );

  const totalChartData = useMemo(() =>
    allMonths.map(ym => ({
      mes: formatYM(ym),
      Clientes: clientDataMap.get(ym) ?? 0,
      Fornecedores: supplierDataMap.get(ym) ?? 0,
    })),
    [allMonths, clientDataMap, supplierDataMap]
  );

  const axisStyle = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };

  const renderChart = (data: any[], lines: { key: string; color: string; name: string }[]) => (
    data.length === 0 ? (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Nenhum dado disponível.
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            interval="preserveStartEnd"
            tickLine={false}
          />
          <YAxis
            tick={axisStyle}
            tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          {lines.length > 1 && <Legend />}
          {lines.map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.name}
              stroke={l.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="clients">
        <TabsList className="w-full">
          <TabsTrigger value="clients" className="flex-1">Clientes</TabsTrigger>
          <TabsTrigger value="suppliers" className="flex-1">Fornecedores</TabsTrigger>
          <TabsTrigger value="total" className="flex-1">Total</TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">Montante faturado com clientes por mês de referência do lançamento.</p>
          {renderChart(clientChartData, [{ key: 'Faturado', name: 'Faturado', color: 'hsl(217, 91%, 60%)' }])}
        </TabsContent>
        <TabsContent value="suppliers" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">Montante gasto com fornecedores por mês de vencimento do título.</p>
          {renderChart(supplierChartData, [{ key: 'Gasto', name: 'Gasto', color: 'hsl(0, 84%, 60%)' }])}
        </TabsContent>
        <TabsContent value="total" className="mt-4">
          <p className="text-xs text-muted-foreground mb-3">Comparativo mensal entre faturamento de clientes e gastos com fornecedores.</p>
          {renderChart(totalChartData, [
            { key: 'Clientes', name: 'Clientes', color: 'hsl(217, 91%, 60%)' },
            { key: 'Fornecedores', name: 'Fornecedores', color: 'hsl(0, 84%, 60%)' },
          ])}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EvolucaoFinanceira;
