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
 * (nacional ou municipal de BH). Aparece como bloco no resumo do dia e,
 * uma vez por sessão, como pop-up. Some quando marcado "Já coloquei".
 */

const chaveOk = (data: string) => `aviso_feriado_ok:${data}`;
const chavePopup = (data: string) => `aviso_feriado_popup:${data}`;

const ler = (s: Storage, k: string) => { try { return s.getItem(k); } catch { return null; } };
const gravar = (s: Storage, k: string) => { try { s.setItem(k, '1'); } catch { /* sem storage */ } };

const AvisoFeriado = ({ agora }: { agora?: Date }) => {
  const feriado = useMemo(() => feriadoParaAvisar(hojeBR(agora ?? new Date())), [agora]);
  const [ok, setOk] = useState(() => !!feriado && !!ler(localStorage, chaveOk(feriado.data)));
  const [popup, setPopup] = useState(
    () => !!feriado && !ok && !ler(sessionStorage, chavePopup(feriado.data)));

  if (!feriado || ok) return null;

  const quando = feriado.dias === 1 ? 'amanhã' : `em ${feriado.dias} dias`;
  const tipo = feriado.tipo === 'ponto facultativo' ? 'ponto facultativo' : `feriado ${feriado.tipo}`;

  const fecharPopup = () => {
    gravar(sessionStorage, chavePopup(feriado.data));
    setPopup(false);
  };
  const confirmar = () => {
    gravar(localStorage, chaveOk(feriado.data));
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

      <Dialog open={popup} onOpenChange={(v) => (v ? setPopup(true) : fecharPopup())}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Colocar aviso de funcionamento</DialogTitle>
            <DialogDescription>
              {feriado.nome} ({tipo}) é {quando}, {formatarDataFeriado(feriado.data)}.
              Avise os clientes sobre o horário de funcionamento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fecharPopup}>Lembrar depois</Button>
            <Button onClick={confirmar}>Já coloquei</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvisoFeriado;
