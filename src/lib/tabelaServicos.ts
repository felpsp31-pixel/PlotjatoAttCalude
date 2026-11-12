import type { ClientService, FaixaDesconto, LinhaRecibo, Servico } from '@/types/recibos';

export interface ItemTabela {
  /** Código escolhido na linha do recibo. */
  value: string;
  code: string;
  description: string;
  unitPrice: number;
  /** Preço do próprio cliente, não o da tabela geral. */
  especial: boolean;
  /** Faixas de desconto por quantidade (só serviços globais com "Desconto Qtd"). */
  faixas?: FaixaDesconto[];
}

/** Valor unitário para a quantidade: a maior faixa já atingida, ou o preço base. */
export function precoPorQuantidade(base: number, faixas: FaixaDesconto[] | undefined, qtd: number): number {
  let preco = base;
  let melhor = 0;
  for (const f of faixas ?? []) {
    if (f.qtd > 0 && qtd >= f.qtd && f.qtd >= melhor) { melhor = f.qtd; preco = f.valor; }
  }
  return preco;
}

/**
 * Reaplica o desconto por quantidade nas linhas do recibo. A quantidade conta
 * somando as linhas do mesmo serviço. Um valor digitado à mão (diferente do
 * automático de antes) é respeitado.
 */
export function recalcularFaixas(
  antes: LinhaRecibo[],
  depois: LinhaRecibo[],
  tabela: ItemTabela[],
): LinhaRecibo[] {
  const somar = (ls: LinhaRecibo[]) => {
    const m = new Map<string, number>();
    ls.forEach(l => { if (l.serviceCode) m.set(l.serviceCode, (m.get(l.serviceCode) ?? 0) + (l.quantity || 0)); });
    return m;
  };
  const qAntes = somar(antes);
  const qDepois = somar(depois);
  return depois.map((l, i) => {
    const item = tabela.find(t => t.value === l.serviceCode);
    if (!item?.faixas?.length) return l;
    const anterior = antes[i];
    const automaticoAntes = precoPorQuantidade(item.unitPrice, item.faixas, qAntes.get(l.serviceCode) ?? 0);
    const mudouServico = !anterior || anterior.serviceCode !== l.serviceCode;
    if (!mudouServico && l.unitPrice !== automaticoAntes) return l; // digitado à mão
    const unitPrice = precoPorQuantidade(item.unitPrice, item.faixas, qDepois.get(l.serviceCode) ?? 0);
    return { ...l, unitPrice, total: l.quantity * unitPrice };
  });
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
    faixas: sv.descontoQtd ? sv.faixas : undefined,
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
