import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAtualizacaoDisponivel } from '@/hooks/useAtualizacaoDisponivel';

/**
 * Faixa discreta avisando que saiu versão nova enquanto esta janela estava
 * aberta. Não recarrega sozinho: o usuário pode estar no meio de um recibo,
 * e perder o que foi digitado seria pior do que ficar uma hora atrasado.
 */
const AvisoAtualizacao = () => {
  const temNova = useAtualizacaoDisponivel();
  if (!temNova) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100]
        flex items-center gap-3 px-4 py-2.5 rounded-full
        bg-card border border-border shadow-lg
        max-w-[calc(100vw-2rem)]"
    >
      <RefreshCw className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm">Nova versão disponível.</span>
      <Button size="sm" onClick={() => window.location.reload()}>
        Atualizar
      </Button>
    </div>
  );
};

export default AvisoAtualizacao;
