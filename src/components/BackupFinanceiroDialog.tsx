import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { Archive, Download, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { montarBackup, type LancamentoBackup } from '@/lib/backupFinanceiro';
import { caminhoDoArquivo } from '@/lib/arquivoPrivado';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hojeBR, somarDias } from '@/lib/dataLocal';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const CONFIRMACAO = 'LIMPAR';
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface Props {
  onLimpo?: () => void;
}

// Backup do Financeiro em CSV (zip com 4 planilhas) do periodo desde o
// ultimo backup. Depois de baixar, permite apagar os lancamentos PAGOS
// desse periodo para aliviar o banco; os em aberto ficam.
const BackupFinanceiroDialog = ({ onLimpo }: Props) => {
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [inicio, setInicio] = useState<string | null>(null);
  const [lancamentos, setLancamentos] = useState<LancamentoBackup[]>([]);
  const [backupId, setBackupId] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [limpando, setLimpando] = useState(false);

  const pagos = lancamentos.filter((l) => l.status === 'paid').length;

  const abrir = async () => {
    setOpen(true);
    setCarregando(true);
    setBackupId(null);
    setTexto('');
    try {
      const { data: ultimo, error: e1 } = await supabase
        .from('backups_financeiro')
        .select('periodo_fim')
        .order('periodo_fim', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      const desde = ultimo?.periodo_fim ?? null;
      setInicio(desde);

      let q = supabase.from('financial_invoices').select('*').order('created_at');
      if (desde) q = q.gt('created_at', desde);
      const { data, error } = await q;
      if (error) throw error;
      setLancamentos((data ?? []) as LancamentoBackup[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar os lançamentos.');
    } finally {
      setCarregando(false);
    }
  };

  const baixar = async () => {
    setCarregando(true);
    try {
      // O fim do periodo e o lancamento mais recente incluido (ou agora),
      // para o proximo backup nao pular nem repetir nada.
      const fim = lancamentos.length ? lancamentos[lancamentos.length - 1].created_at : new Date().toISOString();
      const { arquivos, faturamento } = montarBackup(lancamentos, { inicio, fim });
      const zip = zipSync(Object.fromEntries(Object.entries(arquivos).map(([n, t]) => [n, strToU8(t)])));

      const nome = `backup-financeiro-${hojeBR()}.zip`;
      const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      const { data, error } = await supabase
        .from('backups_financeiro')
        .insert({ periodo_inicio: inicio, periodo_fim: fim, lancamentos: lancamentos.length, faturamento })
        .select('id')
        .single();
      if (error) throw error;
      setBackupId(data.id);
      toast.success(`Backup baixado: ${nome}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar o backup.');
    } finally {
      setCarregando(false);
    }
  };

  const limpar = async () => {
    if (!backupId || texto.trim().toUpperCase() !== CONFIRMACAO) return;
    setLimpando(true);
    try {
      const { data, error } = await supabase.rpc('limpar_lancamentos_do_backup', { p_backup: backupId });
      if (error) throw error;
      const res = data as { apagados: number; anexos: { url: string }[][] };

      // Apaga do Storage os arquivos dos lancamentos removidos.
      const porBucket = new Map<string, string[]>();
      for (const lista of res.anexos ?? []) {
        for (const anexo of lista ?? []) {
          const alvo = anexo?.url ? caminhoDoArquivo(anexo.url) : null;
          if (alvo) porBucket.set(alvo.bucket, [...(porBucket.get(alvo.bucket) ?? []), alvo.caminho]);
        }
      }
      for (const [bucket, caminhos] of porBucket) {
        await supabase.storage.from(bucket).remove(caminhos);
      }

      toast.success(`${res.apagados} lançamento(s) pago(s) removido(s) do sistema.`);
      setBackupId(null);
      setOpen(false);
      onLimpo?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao limpar os lançamentos.');
    } finally {
      setLimpando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={abrir}>
        <Archive className="h-4 w-4 mr-1" /> Backup
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Backup do Financeiro</DialogTitle>
            <DialogDescription>
              {inicio ? `Desde o último backup (${dataBR(inicio)}) até agora.` : 'Desde o início até agora (primeiro backup).'}
            </DialogDescription>
          </DialogHeader>

          {carregando && !lancamentos.length ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm space-y-1">
                <p><strong>{lancamentos.length}</strong> lançamento(s) no período</p>
                <p>Faturamento (clientes): <strong>{brl(lancamentos.filter((l) => l.entity_type === 'client').reduce((s, l) => s + Number(l.value), 0))}</strong></p>
                <p className="text-muted-foreground text-xs pt-1">
                  O arquivo .zip traz: resumo, faturamento mensal por cliente, total por cliente e todos os lançamentos (CSV, abre no Excel).
                </p>
              </div>

              <Button className="w-full" onClick={baixar} disabled={carregando || !lancamentos.length || !!backupId}>
                {carregando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                {backupId ? 'Backup baixado' : 'Baixar backup'}
              </Button>

              {backupId && (
                <div className="rounded-md border border-destructive/40 p-3 space-y-2">
                  <p className="text-sm font-medium">Limpar lançamentos pagos (opcional)</p>
                  <p className="text-xs text-muted-foreground">
                    Remove do sistema os <strong>{pagos}</strong> lançamento(s) <strong>pagos</strong> deste backup e seus anexos.
                    Os em aberto continuam. Confira o arquivo baixado antes: não dá para desfazer.
                  </p>
                  <Input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    placeholder={`Digite ${CONFIRMACAO} para confirmar`}
                    disabled={!pagos}
                  />
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={limpar}
                    disabled={!pagos || limpando || texto.trim().toUpperCase() !== CONFIRMACAO}
                  >
                    {limpando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                    Limpar {pagos} lançamento(s) pago(s)
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BackupFinanceiroDialog;
