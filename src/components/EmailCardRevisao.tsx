import { Check, ExternalLink, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { EmailRecebido } from './tiposEmail';

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

interface Props {
  e: EmailRecebido;
  c: Record<string, string>;
  tipo: 'demanda' | 'cobranca';
  servicos: string[];
  fornecedores: { id: string; name: string }[];
  salvando: boolean;
  mudar: (id: string, campo: string, valor: string) => void;
  aprovar: (e: EmailRecebido) => void;
  descartar: (e: EmailRecebido) => void;
  cadastrarFornecedor: (e: EmailRecebido) => void;
}

// Um e-mail da fila, com o que a IA extraiu em campos editaveis.
const EmailCardRevisao = ({ e, c, tipo, servicos, fornecedores, salvando, mudar, aprovar, descartar, cadastrarFornecedor }: Props) => (
  <article className="rounded-xl border p-4 space-y-3 overflow-hidden min-w-0">
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
    {e.dados.do_boleto === true && (
      <p className="text-xs text-muted-foreground">
        Valor e vencimento lidos da linha digitável do boleto.
      </p>
    )}
    {e.anexos?.length > 0 && (
      <p className="text-xs text-muted-foreground flex items-start gap-1 break-words">
        <Paperclip className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        {e.anexos.map((a) => a?.nome).filter(Boolean).join(', ')}
        {tipo === 'cobranca' && (Array.isArray(e.dados.anexos_url) && e.dados.anexos_url.length
          ? ' — vai junto com o lançamento'
          : ' — baixe no Gmail e anexe ao lançamento')}
      </p>
    )}

    <details className="text-xs">
      <summary className="cursor-pointer text-muted-foreground min-h-[32px] flex items-center">Ver o e-mail</summary>
      <pre className="whitespace-pre-wrap break-words font-sans mt-2 text-muted-foreground max-h-40 overflow-y-auto">{e.resumo}</pre>
    </details>

    {tipo === 'demanda' ? (
      <div className="grid gap-3 sm:grid-cols-2 [&>div]:min-w-0">
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
          <div className="flex gap-2 min-w-0">
            <Input type="date" value={c.prazo ?? ''} onChange={(ev) => mudar(e.id, 'prazo', ev.target.value)} className="text-base" />
            <Input type="time" value={c.hora ?? '17:00'} onChange={(ev) => mudar(e.id, 'hora', ev.target.value)} className="text-base w-28 shrink-0" />
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
      <div className="grid gap-3 sm:grid-cols-2 [&>div]:min-w-0">
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
          {!c.fornecedorId && texto(e.dados.fornecedor) && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => cadastrarFornecedor(e)}>
              Cadastrar "{texto(e.dados.fornecedor)}" como fornecedor
            </Button>
          )}
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
      <Button size="sm" onClick={() => aprovar(e)} disabled={salvando} className="gap-1">
        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {tipo === 'demanda' ? 'Criar demanda' : 'Criar lançamento'}
      </Button>
      <Button size="sm" variant="outline" onClick={() => descartar(e)} className="gap-1">
        <Trash2 className="h-4 w-4" /> Descartar
      </Button>
    </div>
  </article>
);

export default EmailCardRevisao;
