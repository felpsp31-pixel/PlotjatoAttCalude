import { CloudOff, CloudUpload, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecibos } from '@/contexts/RecibosContext';
import { numerosDisponiveis } from '@/lib/offlineRecibos';
import { useConectado } from '@/hooks/useConectado';

/**
 * Faixa no canto da tela: sem internet, ou com recibos emitidos offline que
 * ainda não subiram. Some quando está tudo enviado.
 */
const AvisoOffline = () => {
  const conectado = useConectado();
  const { pendentesOffline, pendentesComErro, sincronizarOffline } = useRecibos();

  if (conectado && pendentesOffline === 0) return null;

  const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);
  const base = 'fixed top-3 right-4 z-[90] flex items-center gap-2 rounded-xl border px-3 py-2 shadow-lg text-xs sm:text-sm max-w-[min(560px,calc(100vw-2rem))]';

  if (pendentesComErro > 0 && conectado) {
    return (
      <div role="alert" className={`${base} bg-card border-destructive text-foreground`}>
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span>
          {plural(pendentesComErro, 'recibo emitido sem internet foi recusado', 'recibos emitidos sem internet foram recusados')} pelo servidor e continua guardado neste aparelho. Não limpe os dados do navegador.
        </span>
      </div>
    );
  }

  if (!conectado) {
    return (
      <div role="status" className={`${base} bg-card border-amber-500/60 text-foreground`}>
        <CloudOff className="h-4 w-4 text-amber-500 shrink-0" />
        <span>
          <strong>Sem internet.</strong> Recibos ficam guardados e sobem quando a conexão voltar
          {pendentesOffline > 0 && <> · {plural(pendentesOffline, 'aguardando', 'aguardando')}</>}
          {' · '}{plural(numerosDisponiveis().length, 'número livre', 'números livres')}
        </span>
      </div>
    );
  }

  return (
    <div role="status" className={`${base} bg-card border-border text-foreground`}>
      <CloudUpload className="h-4 w-4 text-primary shrink-0" />
      <span>{plural(pendentesOffline, 'recibo aguardando envio', 'recibos aguardando envio')}</span>
      <Button size="sm" variant="secondary" onClick={() => sincronizarOffline()}>Enviar agora</Button>
    </div>
  );
};

export default AvisoOffline;
