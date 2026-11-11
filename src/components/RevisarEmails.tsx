import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import EmailCardRevisao from './EmailCardRevisao';
import type { EmailRecebido } from './tiposEmail';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// Fila dos e-mails que o script do Gmail trouxe. Nada foi lançado ainda:
// aqui a pessoa confere o que a IA entendeu, corrige e aprova — ou descarta.
// Em Demandas aparecem os pedidos de serviço; no Financeiro, as cobranças.
// Propaganda fica fora da fila (a IA marca como "ignorar").

interface Props {
  tipo: 'demanda' | 'cobranca';
  onAprovado?: () => void;
  /** 'botao' mostra o rótulo ao lado do ícone, para barras com outros botões. */
  estilo?: 'icone' | 'botao';
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

const RevisarEmails = ({ tipo, onAprovado, estilo = 'icone' }: Props) => {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<EmailRecebido[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, Record<string, string>>>({});
  const [servicos, setServicos] = useState<string[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; name: string }[]>([]);
  const [ignorados, setIgnorados] = useState<EmailRecebido[] | null>(null);

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

  // A IA erra para o lado de ignorar. Esta lista deixa recuperar um pedido
  // que foi parar na propaganda por engano.
  const verIgnorados = async () => {
    const { data } = await supabase
      .from('emails_recebidos')
      .select('id, recebido_em, remetente, remetente_email, assunto, resumo, anexos, link, motivo, dados')
      .eq('tipo', 'ignorar')
      .eq('status', 'a_revisar')
      .order('recebido_em', { ascending: false })
      .limit(50);
    setIgnorados((data ?? []) as unknown as EmailRecebido[]);
  };

  const resgatar = async (e: EmailRecebido) => {
    const { error } = await supabase.from('emails_recebidos').update({ tipo: 'demanda' }).eq('id', e.id);
    if (error) { toast.error('Erro ao mover o e-mail.'); return; }
    setIgnorados((p) => (p ?? []).filter((x) => x.id !== e.id));
    toast.success('Movido para os pedidos a revisar.');
    await carregar();
  };

  // Cadastra na hora o fornecedor que a IA leu do e-mail: sem ele, a cobranca
  // nao tem onde ser lancada.
  const cadastrarFornecedor = async (e: EmailRecebido) => {
    const nome = texto(e.dados.fornecedor).trim();
    if (!nome) return;
    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: nome, email: e.remetente_email || null, retains_iss: false })
      .select('id, name')
      .single();
    if (error) { toast.error('Erro ao cadastrar o fornecedor.'); return; }
    setFornecedores((p) => [...p, data].sort((a, b) => a.name.localeCompare(b.name)));
    mudar(e.id, 'fornecedorId', data.id);
    toast.success(`${data.name} cadastrado.`);
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
          // O boleto que veio no e-mail ja fica anexado ao lancamento.
          attachments: JSON.parse(JSON.stringify(Array.isArray(e.dados.anexos_url) ? e.dados.anexos_url : [])),
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
        variant={estilo === 'botao' ? 'outline' : 'ghost'}
        size={estilo === 'botao' ? 'sm' : 'icon'}
        title={`${rotulo} a revisar`}
        onClick={abrir}
        className={estilo === 'botao' ? 'relative gap-1' : 'relative min-h-[40px] min-w-[40px]'}
      >
        <Mail className="h-4 w-4" />
        {estilo === 'botao' && (
          <>
            <span className="hidden sm:inline">E-mails recebidos</span>
            <span className="sm:hidden">E-mails</span>
          </>
        )}
        {quantos > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
            {quantos}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) contar(); }}>
        <DialogContent className="w-[min(42rem,calc(100vw-2rem))] max-w-none max-h-[85vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
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
            <div className="space-y-4 min-w-0">
              {emails.map((e) => (
                <EmailCardRevisao
                  key={e.id}
                  e={e}
                  c={campos(e)}
                  tipo={tipo}
                  servicos={servicos}
                  fornecedores={fornecedores}
                  salvando={salvando === e.id}
                  mudar={mudar}
                  aprovar={aprovar}
                  descartar={descartar}
                  cadastrarFornecedor={cadastrarFornecedor}
                />
              ))}
            </div>
          )}
          {tipo === 'demanda' && !carregando && (
            <div className="border-t pt-3 mt-2">
              {ignorados === null ? (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={verIgnorados}>
                  Ver e-mails classificados como propaganda
                </Button>
              ) : ignorados.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum e-mail na propaganda.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Descartados pela IA. Se algum for pedido de cliente, traga para a fila.
                  </p>
                  {ignorados.map((e) => (
                    <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate">{e.assunto || '(sem assunto)'}</p>
                        <p className="text-muted-foreground truncate">{e.remetente} · {e.motivo}</p>
                      </div>
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => resgatar(e)}>
                        É um pedido
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RevisarEmails;
