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
