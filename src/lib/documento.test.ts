import { describe, it, expect } from 'vitest';
import { formatarDocumento, formatarTelefone } from './documento';

describe('formatarDocumento', () => {
  it('formata CPF e CNPJ conforme o tamanho', () => {
    expect(formatarDocumento('12345678901')).toBe('123.456.789-01');
    expect(formatarDocumento('12345678000190')).toBe('12.345.678/0001-90');
    expect(formatarDocumento('123')).toBe('123');
    expect(formatarDocumento('123456789012345678')).toBe('12.345.678/9012-34');
  });
});

describe('formatarTelefone', () => {
  it('formata fixo e celular', () => {
    expect(formatarTelefone('3133772881')).toBe('(31) 3377-2881');
    expect(formatarTelefone('31998887766')).toBe('(31) 99888-7766');
  });
});
