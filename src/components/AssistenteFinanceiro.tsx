import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, CornerDownLeft } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { mensagemDoErro } from '@/lib/edgeError';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Turno = { pergunta: string; resposta: string | null; erro: string | null };

const SUGESTOES = [
  'Quem está em atraso?',
  'Quanto tenho a receber este mês?',
  'Quais são meus 5 maiores clientes?',
  'O que vence nos próximos 7 dias?',
];

const AssistenteFinanceiro = ({ open, onOpenChange }: Props) => {
  const [pergunta, setPergunta] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Rolar até o fim é conforto, não função: se o ambiente não tiver
    // scrollIntoView, o diálogo continua funcionando.
    const fim = fimDaLista.current;
    if (typeof fim?.scrollIntoView === 'function') {
      fim.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turnos, carregando]);

  const perguntar = async (texto: string) => {
    const q = texto.trim();
    if (q.length < 3 || carregando) return;

    setPergunta('');
    setCarregando(true);
    // O turno entra já na lista, sem resposta: a pergunta não some da tela
    // enquanto a IA pensa.
    setTurnos((t) => [...t, { pergunta: q, resposta: null, erro: null }]);

    try {
      const { data, error } = await supabase.functions.invoke('perguntar-financeiro', {
        body: { pergunta: q },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTurnos((t) => t.map((turno, i) =>
        i === t.length - 1 ? { ...turno, resposta: data.resposta } : turno));
    } catch (err) {
      console.error('Erro no assistente financeiro:', err);
      const msg = await mensagemDoErro(err, 'Não consegui responder agora.');
      setTurnos((t) => t.map((turno, i) =>
        i === t.length - 1 ? { ...turno, erro: msg } : turno));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Perguntar sobre o Financeiro
          </DialogTitle>
          <DialogDescription>
            A IA lê seus lançamentos e responde. Confira os números antes de
            usar em qualquer coisa que importe.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[180px]">
          {turnos.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Por exemplo:</p>
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => perguntar(s)}
                  disabled={carregando}
                  className="block w-full text-left text-sm px-3 py-2 rounded-lg
                    border border-border hover:bg-secondary/60 transition
                    disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {turnos.map((t, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-right">
                <span className="inline-block bg-secondary rounded-2xl px-3 py-2 text-left">
                  {t.pergunta}
                </span>
              </p>
              {t.resposta && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{t.resposta}</p>
              )}
              {t.erro && (
                <p className="text-sm text-destructive whitespace-pre-wrap">{t.erro}</p>
              )}
              {!t.resposta && !t.erro && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> consultando seus lançamentos…
                </p>
              )}
            </div>
          ))}
          <div ref={fimDaLista} />
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') perguntar(pergunta); }}
            placeholder="Pergunte alguma coisa sobre seus lançamentos…"
            maxLength={1000}
            disabled={carregando}
          />
          <Button
            onClick={() => perguntar(pergunta)}
            disabled={carregando || pergunta.trim().length < 3}
            size="icon"
            title="Perguntar"
          >
            {carregando
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CornerDownLeft className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AssistenteFinanceiro;
