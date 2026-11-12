import { describe, it, expect } from 'vitest';
import { montarTabelaDoCliente } from './tabelaServicos';
import type { ClientService, Servico } from '@/types/recibos';

const GERAIS: Servico[] = [
  { id: 'a0', code: '1', description: 'Plotagem A0 Color', unitPrice: 22 },
  { id: 'a1', code: '2', description: 'Plotagem A1 Color', unitPrice: 18 },
  { id: 'pb', code: '5', description: 'Plotagem A0 P&B', unitPrice: 11.5 },
];
const cs = (o: Partial<ClientService>): ClientService =>
  ({ id: 'x', clienteId: 'c', code: '8', description: 'Especial', unitPrice: 1, ...o });

describe('montarTabelaDoCliente', () => {
  it('sem preco proprio, vale a tabela geral inteira', () => {
    expect(montarTabelaDoCliente(GERAIS, []).map(i => i.code)).toEqual(['1', '2', '5']);
  });

  it('com preco proprio, ve a tabela dele mais os universais', () => {
    const geraisComUniversal = GERAIS.map(sv => sv.id === 'pb' ? { ...sv, universal: true } : sv);
    const t = montarTabelaDoCliente(geraisComUniversal, [cs({ code: '8', description: 'Plotagem A0 Corbis', unitPrice: 16.5 })]);
    expect(t).toEqual([
      { value: 'CS:8', code: '8', description: 'Plotagem A0 Corbis', unitPrice: 16.5, especial: true },
      { value: '5', code: '5', description: 'Plotagem A0 P&B', unitPrice: 11.5, especial: false },
    ]);
  });

  it('sem nenhum universal, quem tem preco proprio ve so o dele', () => {
    const t = montarTabelaDoCliente(GERAIS, [cs({ code: '8' })]);
    expect(t.map(i => i.value)).toEqual(['CS:8']);
  });
});

import { precoPorQuantidade, recalcularFaixas } from './tabelaServicos';
import type { LinhaRecibo } from '@/types/recibos';

describe('desconto por quantidade', () => {
  const faixas = [{ qtd: 10, valor: 0.8 }, { qtd: 50, valor: 0.6 }];
  const tabela = [{ value: 'A', code: 'A', description: 'Copia', unitPrice: 1, especial: false, faixas }];
  const linha = (q: number, p = 0, code = 'A'): LinhaRecibo => ({ serviceCode: code, description: '', quantity: q, unitPrice: p, total: q * p });

  it('escolhe a maior faixa atingida', () => {
    expect(precoPorQuantidade(1, faixas, 9)).toBe(1);
    expect(precoPorQuantidade(1, faixas, 10)).toBe(0.8);
    expect(precoPorQuantidade(1, faixas, 49)).toBe(0.8);
    expect(precoPorQuantidade(1, faixas, 50)).toBe(0.6);
    expect(precoPorQuantidade(1, undefined, 500)).toBe(1);
  });

  it('o valor cai quando a quantidade bate a faixa, em todas as unidades', () => {
    const antes = [linha(9, 1)];
    const depois = recalcularFaixas(antes, [linha(10, 1)], tabela);
    expect(depois[0].unitPrice).toBe(0.8);
    expect(depois[0].total).toBeCloseTo(8);
  });

  it('soma as linhas do mesmo servico', () => {
    const antes = [linha(6, 1), linha(0, 0)];
    const depois = recalcularFaixas(antes, [linha(6, 1), linha(5, 0)], tabela);
    expect(depois[0].unitPrice).toBe(0.8);
  });

  it('respeita valor digitado a mao', () => {
    const antes = [linha(9, 0.95)];
    expect(recalcularFaixas(antes, [linha(10, 0.95)], tabela)[0].unitPrice).toBe(0.95);
  });
});
