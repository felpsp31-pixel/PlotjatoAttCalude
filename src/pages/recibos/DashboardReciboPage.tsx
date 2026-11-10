import { useRecibos } from '@/contexts/RecibosContext';
import RecibosAuthGuard from '@/components/recibos/RecibosAuthGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FileText, Users, Download } from 'lucide-react';
import { generateReciboPdf, buildReciboFileName } from '@/lib/reciboPdf';

const formatDate = (date: string) => {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
};

const DashboardReciboPage = () => {
  const { recibos, clientes, solicitantes, obras, empresaInfo, loading } = useRecibos();

  const last10 = [...recibos].sort((a, b) => Number(b.number) - Number(a.number)).slice(0, 10);

  const downloadPdf = async (r: typeof recibos[0]) => {
    const ctx = {
      cliente: clientes.find(c => c.id === r.clienteId),
      solicitante: solicitantes.find(s => s.id === r.solicitanteId),
      obra: obras.find(o => o.id === r.obraId),
      empresaInfo,
      isPago: r.isPago,
      formaPagamento: r.formaPagamento,
    };
    const doc = await generateReciboPdf(r, ctx);
    doc.save(buildReciboFileName(r, ctx));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <RecibosAuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Recibos Emitidos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-foreground">{recibos.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><p className="text-2xl font-bold text-foreground">{clientes.length}</p></CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Últimos Recibos</h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Nº</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Valor</TableHead><TableHead className="w-[60px]"></TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {last10.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-foreground">{r.number}</TableCell>
                    <TableCell className="text-foreground">{formatDate(r.date)}</TableCell>
                    <TableCell className="text-foreground">{clientes.find(c => c.id === r.clienteId)?.name ?? '—'}</TableCell>
                    <TableCell className="text-foreground">{r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => downloadPdf(r)} title="Baixar PDF">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {last10.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum recibo emitido</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </RecibosAuthGuard>
  );
};

export default DashboardReciboPage;
