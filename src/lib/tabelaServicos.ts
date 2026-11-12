import type { ClientService, Servico } from '@/types/recibos';

export interface ItemTabela {
  /** Código escolhido na linha do recibo. */
  value: string;
  code: string;
  description: string;
  unitPrice: number;
  /** Preço diferente do universal, ou serviço que só este cliente tem. */
  especial: boolean;
}

/**
 * A tabela que vale para um cliente: todos os serviços da tabela geral, com
 * o preço especial dele onde houver, mais os serviços que só ele tem. Um
 * preço especial substitui o universal; nunca esconde o resto da tabela.
 */
export function montarTabelaDoCliente(
  servicos: Servico[],
  doCliente: ClientService[],
): ItemTabela[] {
  const especiais = new Map(
    doCliente.filter(cs => cs.servicoId).map(cs => [cs.servicoId as string, cs]),
  );
  const universais = servicos.map(sv => {
    const especial = especiais.get(sv.id);
    return {
      value: sv.code,
      code: sv.code,
      description: sv.description,
      unitPrice: especial ? especial.unitPrice : sv.unitPrice,
      especial: !!especial,
    };
  });
  const soDoCliente = doCliente
    .filter(cs => !cs.servicoId)
    .map(cs => ({
      value: `CS:${cs.code}`,
      code: cs.code,
      description: cs.description,
      unitPrice: cs.unitPrice,
      especial: true,
    }));
  return [...universais, ...soDoCliente];
}
