import { useState } from "react";
import { Copy, FileText, Loader2, ExternalLink, CheckCircle2, Upload, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Invoice } from "@/types/finance";
import { montarDadosNfse, intervaloDoMes, type DadosNfse, type ReciboDoMes } from "@/lib/dadosNfse";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EMISSOR_URL = "https://www.nfse.gov.br/EmissorNacional/";

async function copiar(texto: string, rotulo: string) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(`${rotulo} copiado`);
  } catch {
    toast.error("Não foi possível copiar. Selecione o texto e use Ctrl+C.");
  }
}

function Campo({ rotulo, valor, multilinha }: { rotulo: string; valor: string; multilinha?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
        <button
          onClick={() => copiar(valor, rotulo)}
          disabled={!valor}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
      </div>
      {multilinha ? (
        <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-sm font-sans">{valor}</pre>
      ) : (
        <p className="rounded-md border bg-muted/40 px-2 py-1.5 text-sm">{valor || "—"}</p>
      )}
    </div>
  );
}

// Botao do card de lancamento. So aparece nos lancamentos do fechamento
// mensal ("Recibos - Mmm/AAAA"), que sao os que viram NFS-e.
interface Props {
  invoice: Invoice;
  onUpdate?: (id: string, data: Partial<Invoice>) => void;
}

const NfseCopiarDialog = ({ invoice, onUpdate }: Props) => {
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const emitida = !!invoice.nfseEmitidaAt;

  const registrarEmissao = async () => {
    if (!onUpdate) return;
    if (!numero.trim()) {
      toast.error("Informe o número da NFS-e.");
      return;
    }
    setSalvando(true);
    try {
      const anexos = [...invoice.attachments];
      if (arquivo) {
        if (arquivo.size > 10 * 1024 * 1024) throw new Error("PDF muito grande. Máximo 10MB.");
        const caminho = `${invoice.id}/${Date.now()}-${arquivo.name}`;
        const { error } = await supabase.storage.from("notas-fiscais").upload(caminho, arquivo);
        if (error) throw error;
        const { data } = supabase.storage.from("notas-fiscais").getPublicUrl(caminho);
        anexos.push({ url: data.publicUrl, name: `NFS-e ${numero.trim()}.pdf`, date: new Date().toISOString() });
      }
      onUpdate(invoice.id, {
        nfseNumero: numero.trim(),
        nfseEmitidaAt: new Date().toISOString(),
        attachments: anexos,
      });
      setOpen(false);
      setNumero("");
      setArquivo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar a NFS-e.");
    } finally {
      setSalvando(false);
    }
  };

  const desfazerEmissao = () => {
    onUpdate?.(invoice.id, { nfseNumero: null, nfseEmitidaAt: null });
  };
  const [carregando, setCarregando] = useState(false);
  const [dados, setDados] = useState<DadosNfse | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (!invoice.description.startsWith("Recibos - ")) return null;

  const abrir = async () => {
    setOpen(true);
    setCarregando(true);
    setErro(null);
    try {
      const { data: cliente, error: cErr } = await supabase
        .from("clientes")
        .select("name, cnpj, email")
        .eq("id", invoice.entityId)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!cliente) throw new Error("Cliente deste lançamento não foi encontrado.");

      let recibos: ReciboDoMes[] = [];
      const intervalo = intervaloDoMes(invoice.referenceMonth);
      if (intervalo) {
        const { data, error } = await supabase
          .from("recibos")
.select('number, date, total, lines')
          .eq('is_pago', invoice.description.includes('(pagos no ato)'))
          .eq("cliente_id", invoice.entityId)
          .gte("date", intervalo.inicio)
          .lte("date", intervalo.fim);
        if (error) throw error;
        recibos = (data ?? []).map((r) => ({
          number: r.number,
          date: r.date,
          total: Number(r.total),
          lines: (r.lines as unknown as ReciboDoMes["lines"]) ?? [],
        }));
      }

      setDados(montarDadosNfse(cliente, invoice.referenceMonth, invoice.value, recibos));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao montar os dados da nota.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <button
        onClick={abrir}
        title="Dados para emitir a NFS-e"
        className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
      >
        {emitida ? (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            NFS-e {invoice.nfseNumero}
          </span>
        ) : (
          <>
            <FileText className="h-3.5 w-3.5" />
            NFS-e
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados para a NFS-e</DialogTitle>
            <DialogDescription>
              {invoice.referenceMonth} — copie cada campo e cole no Emissor Nacional.
            </DialogDescription>
          </DialogHeader>

          {carregando && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {erro && <p className="text-sm text-destructive">{erro}</p>}

          {dados && !carregando && (
            <div className="space-y-3">
              {!dados.tomadorDocumento && (
                <p className="rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  Este cliente está sem CNPJ/CPF cadastrado. Preencha em Clientes antes de emitir.
                </p>
              )}
              <Campo rotulo="CPF/CNPJ do tomador" valor={dados.tomadorDocumento} />
              <Campo rotulo="Nome do tomador" valor={dados.tomadorNome} />
              {dados.tomadorEmail && <Campo rotulo="E-mail" valor={dados.tomadorEmail} />}
              <Campo rotulo="Valor do serviço" valor={dados.valor} />
              <Campo rotulo="Discriminação" valor={dados.discriminacao} multilinha />

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => copiar(dados.textoCompleto, "Resumo")}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar tudo
                </Button>
                <Button size="sm" asChild>
                  <a href={EMISSOR_URL} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" /> Abrir Emissor Nacional
                  </a>
                </Button>
              </div>

              {onUpdate && (
                <div className="mt-2 space-y-2 border-t pt-3">
                  {emitida ? (
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-success">
                        NFS-e nº {invoice.nfseNumero} emitida em{" "}
                        {new Date(invoice.nfseEmitidaAt!).toLocaleDateString("pt-BR")}.
                      </p>
                      <Button variant="ghost" size="sm" onClick={desfazerEmissao}>
                        <Undo2 className="h-4 w-4 mr-1" /> Desfazer
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-medium text-muted-foreground">Depois de emitir no portal</p>
                      <Input
                        placeholder="Número da NFS-e"
                        value={numero}
                        onChange={(e) => setNumero(e.target.value)}
                      />
                      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted/40">
                        <Upload className="h-4 w-4" />
                        <span className="truncate">{arquivo ? arquivo.name : "Anexar PDF da nota (opcional)"}</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                        />
                      </label>
                      <Button size="sm" className="w-full" onClick={registrarEmissao} disabled={salvando}>
                        {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                        Marcar como emitida
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NfseCopiarDialog;
