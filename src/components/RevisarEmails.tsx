import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Mail, Paperclip, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Fila dos e-mails que o script do Gmail trouxe. Nada foi lançado ainda:
// aqui a pessoa confere o que a IA entendeu, corrige e aprova — ou descarta.
// Em Demandas aparecem os pedidos de serviço; no Financeiro, as cobranças.
// Propaganda fica fora da fila (a IA marca como "ignorar").

interface EmailRecebido {
  id: string;
  recebido_em: string;
  remetente: string;
  remetente_email: string;
  assunto: string;
  resumo: string;
  anexos: { nome?: string }[];
  link: string | null;
  motivo: string | null;
  dados: Record<string, unknown>;
}

interface Props {
  tipo: 'demanda' | 'cobranca';
  onAprovado?: () => void;
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const RevisarEmails = ({ tipo, onAprovado }: Props) => {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<EmailRecebido[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, Record<string, string>>>({});
  const [servicos, setServicos] = useState<string[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; name: string }[]>([]);

  const campos = useCallback((e: EmailRecebido) => form[e.id] ?? {}, [form]);
  const mudar = (id: string, campo: string, valor: string) =>
    setForm((p) => ({ ...p, [id]: { ...p[id], [campo]: valor } }));

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await supabase
      .from('emails_recebidos')
      .select('id, recebido_em, remetente, remetente_email, assunto, resumo, anexos, link, motivo, dados')
      .eq('tipo', tipo)
      .eq('status', 'a_revisar')
      .order('recebido_em', { ascending: false });
    if (error) toast.error('Erro ao carregar os e-mails.');
    const lista = (data ?? []) as unknown as EmailRecebido[];
    setEmails(lista);
    // Preenche os campos com o que a IA extraiu; a pessoa corrige se precisar.
    setForm(Object.fromEntries(lista.map((e) => [e.id, tipo === 'demanda'
      ? {
        cliente: texto(e.dados.cliente), telefone: texto(e.dados.telefone),
        servico: texto(e.dados.servico), descricao: texto(e.dados.descricao),
        prazo: texto(e.dados.prazo), hora: '17:00',
        prioridade: texto(e.dados.prioridade) || 'media',
      }
      : {
        fornecedorId: texto(e.dados.fornecedor_id), descricao: texto(e.dados.descricao),
        valor: numero(e.dados.valor), vencimento: texto(e.dados.vencimento),
      },
    ])));
    setCarregando(false);
  }, [tipo]);

  // Só o número para o botão, sem trazer os e-mails inteiros.
  const [quantos, setQuantos] = useState(0);
  const contar = useCallback(async () => {
    const { count } = await supabase
      .from('emails_recebidos')
      .select('id', { count: 'exact', head: true })
      .eq('tipo', tipo)
      .eq('status', 'a_revisar');
    setQuantos(count ?? 0);
  }, [tipo]);

  useEffect(() => { contar(); }, [contar]);

  const abrir = async () => {
    setOpen(true);
    await carregar();
    if (tipo === 'demanda') {
      const { data } = await supabase.from('servicos').select('description').order('description');
      setServicos((data ?? []).map((s) => s.description));
    } else {
      const { data } = await supabase.from('suppliers').select('id, name').order('name');
      setFornecedores(data ?? []);
    }
  };

  const baixar = async (e: EmailRecebido, resultadoId: string | null) => {
    await supabase
      .from('emails_recebidos')
      .update({ status: 'aprovado', revisado_em: new Date().toISOString(), resultado_id: resultadoId })
      .eq('id', e.id);
    setEmails((p) => p.filter((x) => x.id !== e.id));
    setQuantos((n) => Math.max(0, n - 1));
    onAprovado?.();
  };

  const aprovar = async (e: EmailRecebido) => {
    const c = campos(e);
    setSalvando(e.id);
    try {
      if (tipo === 'demanda') {
        if (!c.cliente?.trim()) { toast.error('Informe o cliente.'); return; }
        if (!c.servico) { toast.error('Escolha o serviço.'); return; }
        let prazo: string | null = null;
        if (c.prazo) {
          const [hh, mm] = (c.hora || '17:00').split(':').map(Number);
          const [a, m, d] = c.prazo.split('-').map(Number);
          prazo = new Date(a, m - 1, d, hh || 0, mm || 0, 0, 0).toISOString();
        }
        const { data, error } = await supabase.from('demandas').insert({
          cliente_id: texto(e.dados.cliente_id) || null,
          cliente_nome: c.cliente.trim(),
          telefone: c.telefone ?? '',
          email: e.remetente_email,
          servico: c.servico,
          descricao: c.descricao ?? '',
          prazo,
          status: 'pendente',
          prioridade: c.prioridade || 'media',
          canal: 'Email',
        }).select('id').single();
        if (error) throw error;
        toast.success('Demanda criada.');
        await baixar(e, data.id);
      } else {
        const valor = Number((c.valor ?? '').replace(',', '.'));
        if (!c.fornecedorId) { toast.error('Escolha o fornecedor.'); return; }
        if (!Number.isFinite(valor) || valor <= 0) { toast.error('Informe o valor.'); return; }
        if (!c.vencimento) { toast.error('Informe o vencimento.'); return; }
        const nome = fornecedores.find((f) => f.id === c.fornecedorId)?.name ?? '';
        const mes = new Date(`${c.vencimento}T12:00:00`);
        const { data, error } = await supabase.from('financial_invoices').insert({
          entity_id: c.fornecedorId,
          entity_name: nome,
          entity_type: 'supplier',
          description: c.descricao || e.assunto,
          value: valor,
          due_date: c.vencimento,
          reference_month: `${['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][mes.getMonth()]}/${mes.getFullYear()}`,
          status: 'open',
          attachments: [],
        }).select('id').single();
        if (error) throw error;
        toast.success('Lançamento criado em Em aberto.');
        await baixar(e, data.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao aprovar.');
    } finally {
      setSalvando(null);
    }
  };

  const descartar = async (e: EmailRecebido) => {
    const { error } = await supabase
      .from('emails_recebidos')
      .update({ status: 'descartado', revisado_em: new Date().toISOString() })
      .eq('id', e.id);
    if (error) { toast.error('Erro ao descartar.'); return; }
    setEmails((p) => p.filter((x) => x.id !== e.id));
    setQuantos((n) => Math.max(0, n - 1));
  };

  const rotulo = tipo === 'demanda' ? 'E-mails com pedidos' : 'E-mails com cobranças';

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        title={`${rotulo} a revisar`}
        onClick={abrir}
        className="relative min-h-[40px] min-w-[40px]"
      >
        <Mail className="h-4 w-4" />
        {quantos > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
            {quantos}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) contar(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{rotulo}</DialogTitle>
            <DialogDescription>
              Vindos da caixa de entrada. Confira o que a IA entendeu antes de lançar no sistema.
            </DialogDescription>
          </DialogHeader>

          {carregando ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : emails.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum e-mail a revisar.</p>
          ) : (
            <div className="space-y-4">
              {emails.map((e) => {
                const c = campos(e);
                return (
                  <article key={e.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{e.assunto || '(sem assunto)'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {e.remetente} {e.remetente_email && `· ${e.remetente_email}`} · {dataHora(e.recebido_em)}
                        </p>
                      </div>
                      {e.link && (
                        <a
                          href={e.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary inline-flex items-center gap-1 shrink-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir no Gmail
                        </a>
                      )}
                    </div>

                    {e.motivo && <p className="text-xs text-muted-foreground italic">{e.motivo}</p>}
                    {e.anexos?.length > 0 && (
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {e.anexos.map((a) => a?.nome).filter(Boolean).join(', ')}
                        {tipo === 'cobranca' && ' — baixe no Gmail e anexe ao lançamento'}
                      </p>
                    )}

                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground min-h-[32px] flex items-center">Ver o e-mail</summary>
                      <pre className="whitespace-pre-wrap font-sans mt-2 text-muted-foreground max-h-40 overflow-y-auto">{e.resumo}</pre>
                    </details>

                    {tipo === 'demanda' ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Cliente</Label>
                          <Input value={c.cliente ?? ''} onChange={(ev) => mudar(e.id, 'cliente', ev.target.value)} className="text-base" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Serviço</Label>
                          <Select value={c.servico ?? ''} onValueChange={(v) => mudar(e.id, 'servico', v)}>
                            <SelectTrigger><SelectValue placeholder="Escolha..." /></SelectTrigger>
                            <SelectContent>
                              {servicos.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Descrição</Label>
                          <Textarea rows={2} value={c.descricao ?? ''} onChange={(ev) => mudar(e.id, 'descricao', ev.target.value)} className="text-base" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prazo</Label>
                          <div className="flex gap-2">
                            <Input type="date" value={c.prazo ?? ''} onChange={(ev) => mudar(e.id, 'prazo', ev.target.value)} className="text-base" />
                            <Input type="time" value={c.hora ?? '17:00'} onChange={(ev) => mudar(e.id, 'hora', ev.target.value)} className="text-base w-28" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prioridade</Label>
                          <Select value={c.prioridade ?? 'media'} onValueChange={(v) => mudar(e.id, 'prioridade', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="baixa">Baixa</SelectItem>
                              <SelectItem value="media">Média</SelectItem>
                              <SelectItem value="alta">Alta</SelectItem>
                              <SelectItem value="urgente">Urgente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Fornecedor</Label>
                          <Select value={c.fornecedorId ?? ''} onValueChange={(v) => mudar(e.id, 'fornecedorId', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder={texto(e.dados.fornecedor) ? `Cadastre ou escolha: ${texto(e.dados.fornecedor)}` : 'Escolha...'} />
                            </SelectTrigger>
                            <SelectContent>
                              {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs">Descrição</Label>
                          <Input value={c.descricao ?? ''} onChange={(ev) => mudar(e.id, 'descricao', ev.target.value)} className="text-base" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Valor (R$)</Label>
                          <Input inputMode="decimal" value={c.valor ?? ''} onChange={(ev) => mudar(e.id, 'valor', ev.target.value)} className="text-base" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Vencimento</Label>
                          <Input type="date" value={c.vencimento ?? ''} onChange={(ev) => mudar(e.id, 'vencimento', ev.target.value)} className="text-base" />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" onClick={() => aprovar(e)} disabled={salvando === e.id} className="gap-1">
                        {salvando === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {tipo === 'demanda' ? 'Criar demanda' : 'Criar lançamento'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => descartar(e)} className="gap-1">
                        <Trash2 className="h-4 w-4" /> Descartar
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RevisarEmails;
