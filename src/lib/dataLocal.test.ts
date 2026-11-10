import { describe, it, expect } from 'vitest';
import { hojeBR, somarDias } from './dataLocal';

describe('hojeBR', () => {
  it('usa o dia de Brasilia mesmo quando em UTC ja virou', () => {
    // 30/11 22:30 em Brasilia = 01/12 01:30 UTC
    expect(hojeBR(new Date('2026-12-01T01:30:00Z'))).toBe('2026-11-30');
    expect(hojeBR(new Date('2026-12-01T03:30:00Z'))).toBe('2026-12-01');
  });
  it('soma dias virando o mes', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01');
  });
});
