import { useState, useRef } from 'react';
import { Upload, Loader2, FileUp, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mensagemDoErro } from '@/lib/edgeError';
import { casarCliente, soDigitos } from '@/lib/casarCliente';
import { hojeBR, somarDias } from '@/lib/dataLocal';

interface ExtractedNfse {
  valor_liquido: number | null;
  vencimento: string | null;
  issqn_retido: number | null;
  tomador: string | null;
  numero_nfse: string | null;
  cnpj_tomador: string | null;
}

interface ImportNotaFiscalDialogProps {
  onImported?: () => void;
}

const ImportNotaFiscalDialog = ({ onImported }: ImportNotaFiscalDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedNfse | null>(null);
  const [editData, setEditData] = useState<ExtractedNfse>({
    valor_liquido: null,
    vencimento: null,
    issqn_retido: null,
    tomador: null,
    numero_nfse: null,
    cnpj_tomador: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPdfFile(null);
    setExtracted(null);
    setEditData({ valor_liquido: null, vencimento: null, issqn_retido: null, tomador: null, numero_nfse: null, cnpj_tomador: null });
    setLoading(false);
    setSaving(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:application/pdf;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    setPdfFile(file);
    setLoading(true);

    try {
      const base64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke('extrair-nota', {
        body: { pdf_base64: base64 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const result: ExtractedNfse = {
        valor_liquido: data.valor_liquido ?? null,
        vencimento: data.vencimento ?? null,
        issqn_retido: data.issqn_retido ?? null,
        tomador: data.tomador ?? null,
        numero_nfse: data.numero_nfse ?? null,
        cnpj_tomador: data.cnpj_tomador ?? null,
      };

      setExtracted(result);
      setEditData(result);
      toast.success('Dados extraídos com sucesso! Confira e confirme.');
    } catch (err: unknown) {
      console.error('Extraction error:', err);
      const msg = await mensagemDoErro(err, 'Erro ao extrair dados do PDF.');
      // Erro de IA costuma ser longo (modelo, cota, lista de modelos): sem
      // duracao estendida o usuario nao consegue ler nem copiar.
      toast.error(msg, { duration: 15000 });
      setPdfFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  /**
   * Lança a nota no Financeiro. Casa o tomador com um cliente cadastrado;
   * se não achar, registra como cliente avulso para o lançamento ter dono.
   * Devolve um aviso quando algo ficou pendente, ou null se correu tudo bem.
   */
  const criarLancamentoFinanceiro = async (
    pdfUrl: string,
  ): Promise<{ aviso: string | null; destino: string | null }> => {
    const tomador = editData.tomador?.trim();
    const valor = editData.valor_liquido;
    const vencimento = editData.vencimento;

    if (!tomador) return { aviso: 'Sem tomador identificado — não foi lançada no Financeiro.', destino: null };
    if (valor == null) return { aviso: 'Sem valor identificado — não foi lançada no Financeiro.', destino: null };
    if (!vencimento) return { aviso: 'Sem vencimento identificado — não foi lançada no Financeiro.', destino: null };

    try {
      let entityId: string | null = null;
      let entityName = tomador;
      let entityType: 'client' | 'casual' = 'client';

      const { data: clientes, error: erroClientes } = await supabase
        .from('clientes').select('id, name, cnpj');
      if (erroClientes) throw erroClientes;

      const achado = casarCliente(tomador, editData.cnpj_tomador, clientes ?? []);
      if (achado) {
        entityId = achado.id;
        entityName = achado.name;
      } else {
        const { data: avulsos, error: erroAvulsos } = await supabase
          .from('clientes_avulsos' as never).select('id, name');
        if (erroAvulsos) throw erroAvulsos;

        const avulso = casarCliente(
          tomador, null, (avulsos ?? []) as { id: string; name: string }[]);
        if (avulso) {
          // Ja existe como avulso de importacoes antigas: usa esse, para nao
          // criar uma terceira copia do mesmo tomador.
          entityType = 'casual';
          entityId = avulso.id;
          entityName = avulso.name;
        } else {
          // Tomador novo entra em `clientes`, nao em avulsos: e um cliente de
          // verdade, com nota fiscal emitida. Gravar o CNPJ aqui faz a
          // proxima nota da mesma empresa casar direto, sem depender do nome.
          const { data: novo, error: erroNovo } = await supabase
            .from('clientes')
            .insert({ name: tomador, cnpj: soDigitos(editData.cnpj_tomador) })
            .select('id, name').single();
          if (erroNovo) throw erroNovo;
          if (novo) {
            entityId = novo.id;
            entityName = novo.name;
          }
        }
      }

      if (!entityId) return { aviso: 'Não consegui vincular a um cliente — não foi lançada no Financeiro.', destino: null };

      // O status sai do vencimento: vencida aparece como atrasada em "Em aberto".
      const hoje = hojeBR();
      const status = vencimento < hoje ? 'overdue' : 'open';

      const d = new Date(vencimento + 'T00:00:00');
      const referenceMonth = `${MESES[d.getMonth()]}/${d.getFullYear()}`;

      const { error } = await supabase.from('financial_invoices').insert({
        entity_id: entityId,
        entity_name: entityName,
        entity_type: entityType,
        description: editData.numero_nfse ? `NFS-e ${editData.numero_nfse}` : 'NFS-e importada',
        value: valor,
        due_date: vencimento,
        reference_month: referenceMonth,
        status,
        attachments: [{ url: pdfUrl, name: pdfFile?.name ?? 'nota.pdf', date: new Date().toISOString() }],
      });
      if (error) throw error;
      return {
        aviso: null,
        destino: entityType === 'casual'
          ? `${entityName} (avulso)` : `${entityName} (Clientes)`,
      };
    } catch (err) {
      console.error('Erro ao lançar no Financeiro:', err);
      const motivo = err instanceof Error ? err.message : String(err);
      return { aviso: `Falhou ao lançar no Financeiro: ${motivo}`, destino: null };
    }
  };

  const handleSave = async () => {
    if (!pdfFile) return;

    setSaving(true);
    try {
      // Upload PDF to storage
      const filePath = `${Date.now()}-${pdfFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('notas-fiscais')
        .upload(filePath, pdfFile, { upsert: true });

      if (uploadError) {
        // Bucket ausente e erro de configuracao, nao do arquivo: dizer "erro
        // ao salvar" manda a pessoa procurar defeito na nota fiscal.
        if (/bucket/i.test(uploadError.message)) {
          throw new Error(
            'O bucket "notas-fiscais" nao existe no Supabase. Crie-o em ' +
            'Storage (leitura publica) e tente de novo.',
          );
        }
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('notas-fiscais')
        .getPublicUrl(filePath);

      // Save to database
      const { error: insertError } = await supabase
        .from('notas_fiscais')
        .insert({
          numero_nfse: editData.numero_nfse,
          tomador: editData.tomador,
          valor_liquido: editData.valor_liquido,
          issqn_retido: editData.issqn_retido,
          vencimento: editData.vencimento,
          pdf_url: urlData.publicUrl,
        });

      if (insertError) throw insertError;

      // Cria também o lançamento no Financeiro, para a nota aparecer no
      // kanban. Sem isto a nota ficava só no arquivo de notas fiscais.
      const { aviso, destino } = await criarLancamentoFinanceiro(urlData.publicUrl);

      if (aviso) {
        // Antes isto saia como toast verde de sucesso, o que fazia a pessoa
        // procurar na coluna um lancamento que nunca chegou la.
        toast.warning(`Nota arquivada, mas: ${aviso}`, { duration: 15000 });
      } else {
        // Dizer em qual cliente entrou evita a procura no item errado da
        // barra lateral quando a razao social da nota nao bate com o cadastro.
        toast.success(`Nota lançada no Financeiro em "${destino}".`, { duration: 8000 });
      }
      reset();
      setOpen(false);
      onImported?.();
    } catch (err) {
      console.error('Save error:', err);
      const motivo = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao salvar nota fiscal: ${motivo}`, { duration: 15000 });
    } finally {
      setSaving(false);
    }
  };

  const fmtCurrency = (v: number | null) =>
    v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileUp className="h-4 w-4" />
          Importar NFS-e
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Nota Fiscal (NFS-e)</DialogTitle>
        </DialogHeader>

        {!extracted ? (
          <div className="space-y-4 pt-2">
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleChange}
            />
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
              onClick={() => !loading && inputRef.current?.click()}
              className={`w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Extraindo dados do PDF...</span>
                  <span className="text-xs text-muted-foreground/60">Isso pode levar alguns segundos</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    Arraste o PDF aqui ou clique para selecionar
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    Apenas PDF — máximo 10MB
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Confira os dados extraídos e corrija se necessário antes de salvar.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nfse-numero">Nº NFS-e</Label>
                <Input
                  id="nfse-numero"
                  value={editData.numero_nfse ?? ''}
                  onChange={(e) => setEditData((p) => ({ ...p, numero_nfse: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nfse-valor">Valor Líquido (R$)</Label>
                <Input
                  id="nfse-valor"
                  type="number"
                  step="0.01"
                  value={editData.valor_liquido ?? ''}
                  onChange={(e) => setEditData((p) => ({ ...p, valor_liquido: e.target.value ? parseFloat(e.target.value) : null }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nfse-tomador">Tomador do Serviço</Label>
              <Input
                id="nfse-tomador"
                value={editData.tomador ?? ''}
                onChange={(e) => setEditData((p) => ({ ...p, tomador: e.target.value || null }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nfse-vencimento">Vencimento</Label>
                <Input
                  id="nfse-vencimento"
                  type="date"
                  value={editData.vencimento ?? ''}
                  onChange={(e) => setEditData((p) => ({ ...p, vencimento: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nfse-issqn">ISSQN Retido (R$)</Label>
                <Input
                  id="nfse-issqn"
                  type="number"
                  step="0.01"
                  value={editData.issqn_retido ?? ''}
                  onChange={(e) => setEditData((p) => ({ ...p, issqn_retido: e.target.value ? parseFloat(e.target.value) : null }))}
                  placeholder="null se não houver"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { reset(); }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Confirmar e Salvar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportNotaFiscalDialog;
