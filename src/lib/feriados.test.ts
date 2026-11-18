import { describe, it, expect } from 'vitest';
import { pascoa, feriadosDoAno, inicioDoAviso, feriadoParaAvisar } from './feriados';

describe('feriados de BH', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2025)).toBe('2025-04-20');
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
  });

  it('feriados móveis de 2026 batem com o calendário oficial', () => {
    const f = Object.fromEntries(feriadosDoAno(2026).map((x) => [x.nome + x.data, x]));
    expect(f['Sexta-feira da Paixão2026-04-03']).toBeTruthy();
    expect(f['Corpus Christi2026-06-04']).toBeTruthy(); // TJMG/TRT3 2026
    expect(f['Carnaval2026-02-16']).toBeTruthy();
    expect(f['Carnaval2026-02-17']).toBeTruthy();
  });

  it('inclui os municipais de BH e a Consciência Negra', () => {
    const datas = feriadosDoAno(2026).map((x) => x.data);
    for (const d of ['2026-08-15', '2026-12-08', '2026-11-20', '2026-12-25'])
      expect(datas).toContain(d);
  });

  it('avisa 2 dias antes e na véspera', () => {
    // Natal 2026 é sexta (25/12)
    expect(feriadoParaAvisar('2026-12-22')).toBeNull();
    expect(feriadoParaAvisar('2026-12-23')?.nome).toBe('Natal');
    expect(feriadoParaAvisar('2026-12-24')?.dias).toBe(1);
    expect(feriadoParaAvisar('2026-12-25')).toBeNull();
  });

  it('feriado na segunda é avisado na sexta anterior', () => {
    // Imaculada Conceição 2025 foi segunda (08/12) → 2 dias antes = sábado → sexta 05/12
    expect(inicioDoAviso('2025-12-08')).toBe('2025-12-05');
    expect(feriadoParaAvisar('2025-12-05')?.nome).toBe('Imaculada Conceição');
    // terça → 2 dias antes = domingo → sexta
    expect(inicioDoAviso('2026-02-17')).toBe('2026-02-13');
  });

  it('virada de ano: avisa o 1º de janeiro', () => {
    expect(feriadoParaAvisar('2026-12-30')?.data).toBe('2027-01-01');
  });

  it('hoje (18/11/2026) avisa a Consciência Negra de sexta 20/11', () => {
    expect(feriadoParaAvisar('2026-11-18')).toMatchObject({ nome: 'Dia da Consciência Negra', dias: 2 });
  });
});
