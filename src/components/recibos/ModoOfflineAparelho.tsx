import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRecibos } from '@/contexts/RecibosContext';

/**
 * Liga ou desliga a emissão de recibos sem internet neste aparelho. Só o
 * aparelho ativado reserva números, e ele os usa também com internet, para a
 * sequência dos recibos não ficar com buracos.
 */
const ModoOfflineAparelho = () => {
  const { modoOfflineAtivo, numerosReservados, ativarModoOffline, desativarModoOffline } = useRecibos();
  const [mudando, setMudando] = useState(false);

  const alternar = async (ligar: boolean) => {
    setMudando(true);
    try {
      await (ligar ? ativarModoOffline() : desativarModoOffline());
    } finally {
      setMudando(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-1">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="modo-offline" className="cursor-pointer">Emitir recibos sem internet neste aparelho</Label>
        <Switch id="modo-offline" checked={modoOfflineAtivo} disabled={mudando} onCheckedChange={alternar} />
      </div>
      <p className="text-xs text-muted-foreground">
        {modoOfflineAtivo
          ? `Ativado · ${numerosReservados} números reservados para este aparelho.`
          : 'Ative só no aparelho do balcão. Nos outros, sem internet dá para emitir apenas orçamento.'}
      </p>
    </div>
  );
};

export default ModoOfflineAparelho;
