import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { hojeBR } from '@/lib/dataLocal';
import { feriadoParaAvisar, formatarDataFeriado } from '@/lib/feriados';

/**
 * Lembrete para colocar o aviso de funcionamento antes de um feriado
 * (nacional ou municipal de BH). Aparece como bloco no resumo do dia e
 * como pop-up toda vez que o sistema abre. O pop-up não fecha (sem X, Esc
 * ou clique fora): só fecha com "Já coloquei", e isso vale só para esta
 * abertura do sistema. Na próxima vez que abrir, aparece de novo, até o feriado.
 */

const chaveOk = (data: string) => `aviso_feriado_visto:${data}`;

const ler = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const gravar = (s: Storage, k: string) => { try { s.setItem(k, '1'); } catch { /* sem storage */ } };

const AvisoFeriado = ({ agora }: { agora?: Date }) => {
  const feriado = useMemo(() => feriadoParaAvisar(hojeBR(agora ?? new Date())), [agora]);
  const [ok, setOk] = useState(() => !!feriado && !!ler(sessionStorage, chaveOk(feriado.data)));
  const [popup, setPopup] = useState(() => !!feriado && !ok);

  if (!feriado || ok) return null;

  const quando = feriado.dias === 1 ? 'amanhã' : `em ${feriado.dias} dias`;
  const tipo = feriado.tipo === 'ponto facultativo' ? 'ponto facultativo' : `feriado ${feriado.tipo}`;

  const confirmar = () => {
    gravar(sessionStorage, chaveOk(feriado.data));
    setPopup(false);
    setOk(true);
  };

  return (
    <>
      <button
        onClick={() => setPopup(true)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border
          bg-card hover:bg-secondary/60 transition text-left min-w-[150px]"
      >
        <span className="text-warning"><CalendarClock className="h-5 w-5" /></span>
        <span>
          <span className="block text-xl font-semibold leading-tight">{feriado.nome}</span>
          <span className="block text-xs text-muted-foreground">
            {quando} · colocar aviso de funcionamento
          </span>
        </span>
      </button>

      {/* Ignora pedidos de fechar: só o "Já coloquei" tira o pop-up. */}
      <Dialog open={popup} onOpenChange={(v) => { if (v) setPopup(true); }}>
        <DialogContent
          className="sm:max-w-sm [&>button.absolute]:hidden"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Colocar aviso de funcionamento</DialogTitle>
            <DialogDescription>
              {feriado.nome} ({tipo}) é {quando}, {formatarDataFeriado(feriado.data)}.
              Avise os clientes sobre o horário de funcionamento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={confirmar}>Já coloquei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvisoFeriado;
