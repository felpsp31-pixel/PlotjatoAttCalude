import { describe, it, expect } from 'vitest';
import { computeNextCode, CODIGO_RESERVADO } from './ServicosReciboPage';

describe('computeNextCode', () => {
  it('segue do maior codigo, nao da quantidade', () => {
    expect(computeNextCode(['1', '2', '3'])).toBe('4');
    expect(computeNextCode(['1', '7'])).toBe('8');       // com buraco no meio
    expect(computeNextCode([])).toBe('1');               // primeiro servico
    expect(computeNextCode(['10', '9'])).toBe('11');     // compara numero, nao texto
  });

  it('ignora codigos sem numero e nunca devolve o reservado', () => {
    expect(computeNextCode(['A', 'B'])).toBe('1');
    expect(computeNextCode([CODIGO_RESERVADO])).toBe('1');
  });
});
