import { describe, expect, it } from 'vitest';
import { acharServico, lerDescricao, montarItens, type ServicoDaTabela } from './paraOrcamento';
import { classificarFolha } from './regras';
import type { ArquivoAnalisado } from './resumo';

const tabela: ServicoDaTabela[] = [
  { value: '10', description: 'A1 Color', unitPrice: 8 },
  { value: '11', description: 'A1 + Color', unitPrice: 10 },
  { value: '12', description: 'A1 ++ Color', unitPrice: 12 },
  { value: '13', description: 'A1 PB', unitPrice: 5 },
  { value: '14', description: 'Plotagem A0 Colorido', unitPrice: 15 },
  { value: '15', description: 'A0 P&B', unitPrice: 9 },
  { value: '16', description: 'Encadernação A4', unitPrice: 3 },
  { value: '17', description: 'Placa de obra A10', unitPrice: 50 },
];

describe('lerDescricao', () => {
  it('entende formato, "+" e cor', () => {
    expect(lerDescricao('A1 + Color')).toEqual({ formato: 'A1', plus: 1, cor: 'Color' });
    expect(lerDescricao('A1 + + Color')).toEqual({ formato: 'A1', plus: 2, cor: 'Color' });
    expect(lerDescricao('a0++ colorido')).toEqual({ formato: 'A0', plus: 2, cor: 'Color' });
    expect(lerDescricao('A2 Preto e Branco')).toEqual({ formato: 'A2', plus: 0, cor: 'PB' });
    expect(lerDescricao('A3 P/B')?.cor).toBe('PB');
    expect(lerDescricao('Encadernação A4')).toEqual({ formato: 'A4', plus: 0, cor: null });
  });

  it('não confunde números maiores com formato', () => {
    expect(lerDescricao('Placa de obra A10')).toBeNull();
    expect(lerDescricao('Banner 2x1')).toBeNull();
  });
});

describe('acharServico', () => {
  it('acha pelo formato, "+" e cor', () => {
    expect(acharServico('A1', 'Color', tabela)?.value).toBe('10');
    expect(acharServico('A1 +', 'Color', tabela)?.value).toBe('11');
    expect(acharServico('A1 ++', 'Color', tabela)?.value).toBe('12');
    expect(acharServico('A1', 'PB', tabela)?.value).toBe('13');
    expect(acharServico('A0', 'Color', tabela)?.value).toBe('14');
    expect(acharServico('A0', 'PB', tabela)?.value).toBe('15');
  });

  it('sem serviço igual na tabela devolve null (valor manual)', () => {
    expect(acharServico('A1 +', 'PB', tabela)).toBeNull();
    expect(acharServico('A2', 'Color', tabela)).toBeNull();
    expect(acharServico('A4', 'Color', tabela)).toBeNull(); // "Encadernação A4" não tem cor
  });
});

describe('montarItens', () => {
  const folha = (w: number, h: number, p: number, pagina = 1) => ({ pagina, larguraMm: w, alturaMm: h, ...classificarFolha(w, h, p) });
  const arquivos: ArquivoAnalisado[] = [
    { caminho: 'a.pdf', folhas: [folha(594, 841, 8), folha(594, 841, 9, 2), folha(594, 1180, 10, 3)] },
    { caminho: 'b.pdf', folhas: [folha(594, 1500, 10), folha(594, 1500, 10, 2), folha(594, 841, 62, 3)] },
    { caminho: 'c.pdf', folhas: [], erro: 'PDF protegido por senha.' },
  ];

  it('soma as folhas por nome e multiplica pelas cópias', () => {
    const itens = montarItens(arquivos, 2);
    expect(itens.filter(i => !i.motivoManual).map(i => [i.nomeTabela, i.quantidade])).toEqual([['A1', 4], ['A1 ++', 2]]);
  });

  it('valor manual: mesma medida vira um item; preenchimento alto fica com o %', () => {
    const manuais = montarItens(arquivos, 1).filter(i => i.motivoManual);
    expect(manuais.map(i => [i.nomeTabela, i.quantidade, i.motivoManual])).toEqual([
      ['A1', 2, '150,0 cm, acima do ++'],
      ['A1', 1, '62% de preenchimento'],
    ]);
  });

  it('cópias inválidas contam como 1', () => {
    expect(montarItens(arquivos, 0)[0].quantidade).toBe(2);
  });
});
