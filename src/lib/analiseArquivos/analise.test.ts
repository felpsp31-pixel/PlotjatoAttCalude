import { describe, expect, it } from 'vitest';
import { chaveArquivo, deListaDeArquivos, separarPorTipo, tipoDoArquivo, type ArquivoEntrada } from './arquivos';
import { classificarFolha } from './regras';
import { resumir, type ArquivoAnalisado } from './resumo';
import { escalaDesenho, fracaoTinta } from './tinta';

const arq = (caminho: string): ArquivoEntrada => ({ file: new File(['x'], caminho.split('/').pop()!), caminho });

describe('arquivos', () => {
  it('reconhece o tipo pela extensão, sem diferenciar maiúsculas', () => {
    expect(tipoDoArquivo('Planta.PDF')).toBe('pdf');
    expect(tipoDoArquivo('estrutura.dwg')).toBe('dwg');
    expect(tipoDoArquivo('foto.jpg')).toBe('outro');
    expect(tipoDoArquivo('sem-extensao')).toBe('outro');
  });

  it('separa PDFs, DWGs e ignorados, em ordem de caminho', () => {
    const r = separarPorTipo([arq('obra/E-10.pdf'), arq('obra/E-2.pdf'), arq('obra/A.dwg'), arq('obra/leia.txt')]);
    expect(r.pdf.map(a => a.caminho)).toEqual(['obra/E-2.pdf', 'obra/E-10.pdf']);
    expect(r.dwg).toHaveLength(1);
    expect(r.ignorados).toBe(1);
  });

  it('usa o caminho da pasta quando a seleção foi de pasta', () => {
    const f = new File(['x'], 'E-01.pdf');
    Object.defineProperty(f, 'webkitRelativePath', { value: 'Obra/Estrutura/E-01.pdf' });
    const lista = { 0: f, length: 1, item: () => f, [Symbol.iterator]: function* () { yield f; } } as unknown as FileList;
    expect(deListaDeArquivos(lista)[0].caminho).toBe('Obra/Estrutura/E-01.pdf');
  });

  it('a chave muda com o caminho', () => {
    expect(chaveArquivo(arq('a/x.pdf'))).not.toBe(chaveArquivo(arq('b/x.pdf')));
  });
});

describe('tinta', () => {
  it('conta só pixels abaixo do tom 230', () => {
    const px = new Uint8ClampedArray([
      255, 255, 255, 255, // branco
      0, 0, 0, 255, // preto
      229, 229, 229, 255, // cinza bem claro, ainda conta
      230, 230, 230, 255, // no limite, não conta
    ]);
    expect(fracaoTinta(px)).toBe(0.5);
  });

  it('desenha em 72 DPI e só reduz páginas gigantes', () => {
    expect(escalaDesenho(2384, 3370)).toBe(1); // A0
    const s = escalaDesenho(20000, 3000); // faixa de 7 m
    expect(20000 * s * 3000 * s).toBeCloseTo(40_000_000, -3);
  });
});

describe('resumir', () => {
  const folha = (w: number, h: number, p: number, pagina = 1) => ({ pagina, larguraMm: w, alturaMm: h, ...classificarFolha(w, h, p) });

  it('agrupa por nome da tabela e separa os de valor manual', () => {
    const arquivos: ArquivoAnalisado[] = [
      { caminho: 'a.pdf', folhas: [folha(594, 841, 8), folha(594, 841, 9, 2), folha(594, 1180, 10, 3)] },
      { caminho: 'b.pdf', folhas: [folha(841, 1189, 6), folha(594, 1500, 10, 2), folha(594, 841, 60, 3)] },
      { caminho: 'c.pdf', folhas: [], erro: 'PDF protegido por senha.' },
    ];
    const r = resumir(arquivos);
    expect(r.porNome).toEqual([
      { nomeTabela: 'A0', quantidade: 1 },
      { nomeTabela: 'A1', quantidade: 2 },
      { nomeTabela: 'A1 ++', quantidade: 1 },
    ]);
    expect(r.manualTamanho).toBe(1);
    expect(r.manualPreenchimento).toBe(1);
    expect(r.folhas).toBe(6);
    expect(r.arquivos).toBe(2);
    expect(r.comErro).toBe(1);
    expect(r.preenchimentoMedio).toBeCloseTo((8 + 9 + 10 + 6 + 10 + 60) / 6);
  });
});
