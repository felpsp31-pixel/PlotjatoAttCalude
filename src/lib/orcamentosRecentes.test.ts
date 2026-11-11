import { beforeEach, describe, expect, it } from 'vitest';
import { guardarOrcamento, listarOrcamentos } from './orcamentosRecentes';
import type { Recibo } from '@/types/recibos';

const doc = (total: number): Recibo => ({
  id: 'orcamento', number: '', date: '2026-11-11', clienteId: '', clienteAvulso: `Cliente ${total}`,
  solicitanteId: '', obraId: '', total,
  lines: [{ serviceCode: '10', description: 'A1 Color', quantity: 1, unitPrice: total, total }],
});

describe('orçamentos recentes', () => {
  beforeEach(() => localStorage.clear());

  it('guarda o mais novo primeiro e mantém só 5', () => {
    for (let i = 1; i <= 7; i++) guardarOrcamento({ doc: doc(i) }, new Date(2026, 10, 11, 10, i));
    const lista = listarOrcamentos();
    expect(lista).toHaveLength(5);
    expect(lista.map(o => o.doc.total)).toEqual([7, 6, 5, 4, 3]);
  });

  it('o mesmo orçamento exportado e impresso entra uma vez', () => {
    guardarOrcamento({ doc: doc(10) }, new Date(2026, 10, 11, 10, 0));
    guardarOrcamento({ doc: doc(10) }, new Date(2026, 10, 11, 10, 1));
    expect(listarOrcamentos()).toHaveLength(1);
  });

  it('dado corrompido não quebra a tela', () => {
    localStorage.setItem('plotjato:orcamentos-recentes:v1', '{isso não é json');
    expect(listarOrcamentos()).toEqual([]);
  });
});
