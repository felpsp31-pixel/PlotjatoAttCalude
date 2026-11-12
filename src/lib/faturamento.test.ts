import { describe, expect, it } from 'vitest';
import { faturamentoNoPeriodo, periodo } from './faturamento';

describe('periodo', () => {
  it('dia', () => {
    expect(periodo('dia', '2026-11-11')).toEqual({ tipo: 'dia', inicio: '2026-11-11', fim: '2026-11-11', rotulo: 'quarta, 11/11' });
  });

  it('semana vai de segunda a domingo', () => {
    expect(periodo('semana', '2026-11-11')).toMatchObject({ inicio: '2026-11-09', fim: '2026-11-15', rotulo: '09/11 a 15/11' });
    expect(periodo('semana', '2026-11-09')).toMatchObject({ inicio: '2026-11-09', fim: '2026-11-15' }); // segunda
    expect(periodo('semana', '2026-11-15')).toMatchObject({ inicio: '2026-11-09', fim: '2026-11-15' }); // domingo
    expect(periodo('semana', '2026-12-31')).toMatchObject({ inicio: '2026-12-28', fim: '2027-01-03' }); // vira o ano
  });

  it('mês inteiro, inclusive fevereiro de ano bissexto', () => {
    expect(periodo('mes', '2026-11-11')).toMatchObject({ inicio: '2026-11-01', fim: '2026-11-30', rotulo: 'novembro de 2026' });
    expect(periodo('mes', '2028-02-10')).toMatchObject({ inicio: '2028-02-01', fim: '2028-02-29' });
  });
});

describe('faturamentoNoPeriodo', () => {
  const recibos = [
    { date: '2026-11-11', total: 100, isPago: true },
    { date: '2026-11-11', total: 50 },
    { date: '2026-11-09', total: 30, isPago: false },
    { date: '2026-11-16', total: 999 },
    { date: '2026-10-31', total: 999 },
  ];

  it('soma só os recibos do período e separa pago de a receber', () => {
    expect(faturamentoNoPeriodo(recibos, periodo('dia', '2026-11-11'))).toEqual({ total: 150, quantidade: 2, pago: 100, aReceber: 50 });
    expect(faturamentoNoPeriodo(recibos, periodo('semana', '2026-11-11'))).toEqual({ total: 180, quantidade: 3, pago: 100, aReceber: 80 });
    expect(faturamentoNoPeriodo(recibos, periodo('mes', '2026-11-11')).total).toBe(1179);
  });
});

describe('faturamentoNoPeriodo com sinal', () => {
  it('divide o recibo entre recebido e a receber', () => {
    const f = faturamentoNoPeriodo(
      [{ date: '2026-11-10', total: 100, valorSinal: 30 }, { date: '2026-11-10', total: 50, isPago: true }],
      { inicio: '2026-11-01', fim: '2026-11-30' },
    );
    expect(f).toMatchObject({ total: 150, pago: 80, aReceber: 70 });
  });
});
