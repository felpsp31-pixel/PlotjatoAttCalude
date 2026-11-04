import { useState, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { useRecibos } from '@/contexts/RecibosContext';
import RecibosAuthGuard from '@/components/recibos/RecibosAuthGuard';
import Combobox from '@/components/recibos/Combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

type SortKey = 'date-desc' | 'date-asc' | 'value-desc' | 'value-asc';

const formatDate = (date: string) => {
  if (!date) return '—';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
};

const RelatoriosReciboPage = () => {
  const { recibos, clientes, obras, empresaInfo, deleteRecibo, loading } = useRecibos();
  const [clienteFilter, setClienteFilter] = useState('');
  const [obraFilter, setObraFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<SortKey>('date-desc');

  // Quando o cliente muda, reseta a obra (evita filtro inválido entre clientes)
  const handleClienteChange = (value: string) => {
    setClienteFilter(value);
    setObraFilter('');
  };

  const obrasDisponiveis = useMemo(() => {
    if (!clienteFilter) return obras;
    return obras.filter(o => o.clienteId === clienteFilter);
  }, [obras, clienteFilter]);

  const filtered = useMemo(() => {
    return recibos.filter(r => {
      if (clienteFilter && r.clienteId !== clienteFilter) return false;
      if (obraFilter && r.obraId !== obraFilter) return false;
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });
  }, [recibos, clienteFilter, obraFilter, startDate, endDate]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === 'date-desc') return b.date.localeCompare(a.date);
      if (sort === 'date-asc') return a.date.localeCompare(b.date);
      if (sort === 'value-desc') return b.total - a.total;
      return a.total - b.total;
    });
  }, [filtered, sort]);


  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const totalPeriodo = filtered.reduce((s, r) => s + r.total, 0);

  const exportCsv = () => {
    const header = 'Nº,Data,Cliente,Obra,Valor\n';
    const rows = sorted.map(r => {
      const nome = clientes.find(c => c.id === r.clienteId)?.name ?? '';
      const obraNome = obras.find(o => o.id === r.obraId)?.name ?? '';
      return `${r.number},${formatDate(r.date)},"${nome}","${obraNome}",${r.total.toFixed(2)}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'relatorio_recibos.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`${empresaInfo.name} — Relatório de Recibos`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Nº', 'Data', 'Cliente', 'Obra', 'Valor']],
      body: sorted.map(r => [
        r.number,
        formatDate(r.date),
        clientes.find(c => c.id === r.clienteId)?.name ?? '',
        obras.find(o => o.id === r.obraId)?.name ?? '',
        r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      ]),
    });
    const finalY = (doc as any).lastAutoTable?.finalY ?? 50;
    doc.setFontSize(12);
    doc.text(`Total: ${totalPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, 14, finalY + 10);
    doc.save('relatorio_recibos.pdf');
  };

  return (
    <RecibosAuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end flex-wrap">
          <div className="w-full sm:w-56">
            <label className="text-sm font-medium text-foreground">Cliente</label>
            <Combobox
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.name }))]}
              value={clienteFilter}
              onValueChange={handleClienteChange}
              placeholder="Todos os clientes"
            />
          </div>
          <div className="w-full sm:w-56">
            <label className="text-sm font-medium text-foreground">Obra</label>
            <Combobox
              options={[{ value: '', label: 'Todas' }, ...obrasDisponiveis.map(o => ({ value: o.id, label: o.name }))]}
              value={obraFilter}
              onValueChange={setObraFilter}
              placeholder={clienteFilter ? 'Todas as obras' : 'Todas as obras'}
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="text-sm font-medium text-foreground">Data início</label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-base" />
          </div>
          <div className="w-full sm:w-auto">
            <label className="text-sm font-medium text-foreground">Data fim</label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-base" />
          </div>
          <div className="w-full sm:w-52">
            <label className="text-sm font-medium text-foreground">Ordenar por</label>
            <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
              <SelectTrigger className="text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">Mais recente → mais antigo</SelectItem>
                <SelectItem value="date-asc">Mais antigo → mais recente</SelectItem>
                <SelectItem value="value-desc">Maior valor → menor valor</SelectItem>
                <SelectItem value="value-asc">Menor valor → maior valor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nº</TableHead><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Obra</TableHead><TableHead>Valor</TableHead><TableHead className="w-10"></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-foreground">{r.number}</TableCell>
                  <TableCell className="text-foreground">{formatDate(r.date)}</TableCell>
                  <TableCell className="text-foreground">{clientes.find(c => c.id === r.clienteId)?.name ?? '—'}</TableCell>
                  <TableCell className="text-foreground">{obras.find(o => o.id === r.obraId)?.name ?? '—'}</TableCell>
                  <TableCell className="text-foreground">{r.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir recibo?</AlertDialogTitle>
                          <AlertDialogDescription>O recibo Nº {r.number} será removido permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteRecibo(r.id)}>Confirmar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum recibo encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-lg font-bold text-foreground">
            Total: {totalPeriodo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportCsv}>Exportar CSV</Button>
            <Button variant="outline" onClick={exportPdf}>Exportar PDF</Button>
          </div>
        </div>
      </div>
    </RecibosAuthGuard>
  );
};

export default RelatoriosReciboPage;
