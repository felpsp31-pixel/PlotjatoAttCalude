import { describe, expect, it } from 'vitest';
import { agruparPorCliente } from './agruparPorCliente';

const clientes = [{ id: 'c2', name: 'Zeta Engenharia' }, { id: 'c1', name: 'álamo Construtora' }, { id: 'c3', name: 'Beta' }];
const itens = [
  { id: '1', clienteId: 'c2', name: 'Marcos' },
  { id: '2', clienteId: 'c1', name: 'Zélia' },
  { id: '3', clienteId: 'c1', name: 'ana' },
  { id: '4', clienteId: 'xx', name: 'Órfão' },
];

describe('agruparPorCliente', () => {
  it('agrupa por cliente em ordem alfabética, itens ordenados, órfãos no fim', () => {
    const g = agruparPorCliente(itens, clientes);
    expect(g.map(x => x.clienteNome)).toEqual(['álamo Construtora', 'Zeta Engenharia', 'Sem cliente']);
    expect(g[0].itens.map(i => i.name)).toEqual(['ana', 'Zélia']);
  });

  it('clientes sem itens não aparecem', () => {
    expect(agruparPorCliente(itens, clientes).some(g => g.clienteId === 'c3')).toBe(false);
  });

  it('filtra por cliente', () => {
    const g = agruparPorCliente(itens, clientes, 'c2');
    expect(g).toHaveLength(1);
    expect(g[0].itens.map(i => i.name)).toEqual(['Marcos']);
    expect(agruparPorCliente(itens, clientes, 'c3')).toEqual([]);
  });
});
