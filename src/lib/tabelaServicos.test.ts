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
  it('sem nada especial, vale a tabela geral', () => {
    expect(montarTabelaDoCliente(GERAIS, [])).toEqual([
      { value: '1', code: '1', description: 'Plotagem A0 Color', unitPrice: 22, especial: false },
      { value: '2', code: '2', description: 'Plotagem A1 Color', unitPrice: 18, especial: false },
      { value: '5', code: '5', description: 'Plotagem A0 P&B', unitPrice: 11.5, especial: false },
    ]);
  });

  it('preco especial troca so o preco daquele servico', () => {
    const t = montarTabelaDoCliente(GERAIS, [cs({ servicoId: 'a0', unitPrice: 16.5 })]);
    expect(t.find(i => i.code === '1')).toMatchObject({ unitPrice: 16.5, especial: true, description: 'Plotagem A0 Color' });
    // o que nao tem preco especial continua universal e disponivel
    expect(t.find(i => i.code === '5')).toMatchObject({ unitPrice: 11.5, especial: false });
    expect(t).toHaveLength(3);
  });

  it('servico sem vinculo entra como exclusivo do cliente', () => {
    const t = montarTabelaDoCliente(GERAIS, [cs({ code: '11', description: 'Impressão A4', unitPrice: 2.5 })]);
    expect(t).toHaveLength(4);
    expect(t[3]).toEqual({ value: 'CS:11', code: '11', description: 'Impressão A4', unitPrice: 2.5, especial: true });
  });
});
