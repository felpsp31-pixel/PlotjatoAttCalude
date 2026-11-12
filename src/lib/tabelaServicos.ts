import type { ClientService, Servico } from '@/types/recibos';

export interface ItemTabela {
  /** Código escolhido na linha do recibo. */
  value: string;
  code: string;
  description: string;
  unitPrice: number;
  /** Preço do próprio cliente, não o da tabela geral. */
  especial: boolean;
}

/**
 * A tabela que vale para um cliente. Quem tem preço próprio vê a tabela dele
 * — mais os serviços marcados como universais no cadastro, que aparecem para
 * todo mundo. Quem não tem preço próprio vê a tabela geral inteira.
 */
export function montarTabelaDoCliente(
  servicos: Servico[],
  doCliente: ClientService[],
): ItemTabela[] {
  const universal = (sv: Servico): ItemTabela => ({
    value: sv.code,
    code: sv.code,
    description: sv.description,
    unitPrice: sv.unitPrice,
    especial: false,
  });

  if (doCliente.length === 0) return servicos.map(universal);

  return [
    ...doCliente.map(cs => ({
      value: `CS:${cs.code}`,
      code: cs.code,
      description: cs.description,
      unitPrice: cs.unitPrice,
      especial: true,
    })),
    ...servicos.filter(sv => sv.universal).map(universal),
  ];
}
