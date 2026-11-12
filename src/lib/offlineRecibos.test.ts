import { beforeEach, describe, expect, it } from 'vitest';
import {
  guardarNumeros, lerCadastros, lerFila, linhaDoRecibo, marcarErro, numerosDisponiveis,
  porNaFila, salvarCadastros, semInternet, tirarDaFila, tirarNumero,
} from './offlineRecibos';
import type { Recibo } from '@/types/recibos';

const recibo = (id: string, number: string, extra: Partial<Recibo> = {}): Recibo => ({
  id, number, date: '2026-11-12', clienteId: 'c1', solicitanteId: '', obraId: '',
  lines: [{ serviceCode: '1', description: 'A0', quantity: 1, unitPrice: 10, total: 10 }], total: 10, ...extra,
});

beforeEach(() => localStorage.clear());

describe('bloco de números offline', () => {
  it('usa os números em ordem, sem repetir, e avisa quando acaba', () => {
    guardarNumeros(['0201', '0202']);
    expect(tirarNumero()).toBe('0201');
    expect(tirarNumero()).toBe('0202');
    expect(tirarNumero()).toBeNull();
  });

  it('guarda o bloco novo depois do que sobrou, sem duplicar', () => {
    guardarNumeros(['0201', '0202']);
    guardarNumeros(['0202', '0251', '0252']);
    expect(numerosDisponiveis()).toEqual(['0201', '0202', '0251', '0252']);
  });
});

describe('fila de recibos offline', () => {
  it('o mesmo recibo entra uma vez só', () => {
    porNaFila(recibo('a', '0201'));
    porNaFila(recibo('a', '0201'));
    porNaFila(recibo('b', '0202'));
    expect(lerFila().map(p => p.recibo.number)).toEqual(['0201', '0202']);
  });

  it('sai da fila depois de enviado e guarda o erro de recusa', () => {
    porNaFila(recibo('a', '0201'));
    porNaFila(recibo('b', '0202'));
    marcarErro('b', 'recusado');
    tirarDaFila('a');
    expect(lerFila()).toHaveLength(1);
    expect(lerFila()[0].erro).toBe('recusado');
  });

  it('ignora lixo guardado no aparelho', () => {
    localStorage.setItem('plotjato:filaRecibos', '{quebrado');
    expect(lerFila()).toEqual([]);
  });
});

describe('linha enviada ao banco', () => {
  it('faturado leva o cliente, avulso com sinal leva o sinal e a forma', () => {
    expect(linhaDoRecibo(recibo('a', '0201'))).toMatchObject({ id: 'a', number: '0201', cliente_id: 'c1', is_pago: false, valor_sinal: null });
    const avulso = recibo('b', '0202', { clienteId: '', clienteAvulso: 'João', valorSinal: 4, formaPagamento: 'PIX' });
    expect(linhaDoRecibo(avulso)).toMatchObject({ cliente_id: null, cliente_avulso: 'João', valor_sinal: 4, forma_pagamento: 'PIX' });
  });
});

describe('cópia dos cadastros', () => {
  it('guarda e devolve', () => {
    salvarCadastros({ empresa: null, clientes: [], solicitantes: [], obras: [], servicos: [], clientServices: [] });
    expect(lerCadastros()?.clientes).toEqual([]);
  });
});

describe('semInternet', () => {
  it('reconhece erro de rede e não confunde com recusa do banco', () => {
    expect(semInternet({ message: 'TypeError: Failed to fetch' })).toBe(true);
    expect(semInternet({ message: 'duplicate key value violates unique constraint' })).toBe(false);
  });
});
