import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { mensagemDoErro } from '@/lib/edgeError';

/** O que a IA conseguiu tirar da mensagem. Tudo pode vir nulo. */
export interface DemandaInterpretada {
  cliente: string | null;
  telefone: string | null;
  email: string | null;
  servico: string | null;
  descricao: string | null;
  prazo: string | null;
  responsavel: string | null;
  prioridade: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nomes exatos dos serviços cadastrados, para a IA escolher da lista. */
  servicos: string[];
  responsaveis: string[];
  /** Recebe o resultado para preencher o formulário normal de demanda. */
  onInterpretado: (d: DemandaInterpretada, textoOriginal: string) => void;
}

const EXEMPLO =
  'Ex.: "Oi, aqui é o Rafael da Corbis. Preciso de 4 plantas A1 coloridas ' +
  'do projeto da obra do Buritis até sexta, pode ser? Meu zap é 31 98888-7777"';

const DemandaIADialog = ({
  open, onOpenChange, servicos, responsaveis, onInterpretado,
}: Props) => {
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);

  const interpretar = async () => {
    if (texto.trim().length < 5) {
      toast.warning('Cole a mensagem do cliente.');
      return;
    }
    setCarregando(true);
    try {
      // A data de hoje vai daqui, não do servidor: é ela que resolve
      // "sexta" ou "semana que vem", e o fuso que importa é o seu.
      const hoje = new Date();
      const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase.functions.invoke('interpretar-demanda', {
        body: { texto: texto.trim(), servicos, responsaveis, hoje: hojeISO },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onInterpretado(data as DemandaInterpretada, texto.trim());
      setTexto('');
      onOpenChange(false);
    } catch (err) {
      console.error('Erro ao interpretar demanda:', err);
      toast.error(await mensagemDoErro(err, 'Não consegui interpretar a mensagem.'),
        { duration: 15000 });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!carregando) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Criar demanda a partir de uma mensagem
          </DialogTitle>
          <DialogDescription>
            Cole o que o cliente mandou. A IA preenche o formulário e você
            confere antes de salvar — nada é gravado direto.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={EXEMPLO}
          rows={8}
          maxLength={8000}
          disabled={carregando}
          className="resize-none"
          // Ctrl+Enter porque Enter sozinho precisa quebrar linha num texto colado.
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') interpretar();
          }}
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {texto.length > 0 && `${texto.length} caracteres · Ctrl+Enter para interpretar`}
          </span>
          <Button onClick={interpretar} disabled={carregando} className="gap-2">
            {carregando
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Interpretando…</>
              : <><Sparkles className="h-4 w-4" /> Interpretar</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemandaIADialog;
