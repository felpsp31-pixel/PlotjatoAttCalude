import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { caminhoDoArquivo } from './arquivoPrivado';

describe('caminhoDoArquivo', () => {
  it('extrai bucket e caminho do link publico antigo', () => {
    expect(
      caminhoDoArquivo('https://x.supabase.co/storage/v1/object/public/notas-fiscais/abc/123-Nota%20A.pdf'),
    ).toEqual({ bucket: 'notas-fiscais', caminho: 'abc/123-Nota A.pdf' });
  });

  it('ignora links externos', () => {
    expect(caminhoDoArquivo('https://exemplo.com/a.pdf')).toBeNull();
  });
});
