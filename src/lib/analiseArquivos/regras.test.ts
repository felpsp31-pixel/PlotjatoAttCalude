import { describe, expect, it } from 'vitest';
import { classificarFolha, corrigirPreenchimento, rotuloFormato } from './regras';

const nome = (w: number, h: number, p: number | null = 10) => classificarFolha(w, h, p).nomeTabela;

describe('classificarFolha — formato pela largura', () => {
  it('reconhece os formatos A padrão, em pé ou deitados', () => {
    expect(nome(210, 297)).toBe('A4');
    expect(nome(420, 297)).toBe('A3');
    expect(nome(420, 594)).toBe('A2');
    expect(nome(841, 594)).toBe('A1');
    expect(nome(841, 1189)).toBe('A0');
  });

  it('aceita a tolerância de leitura na largura', () => {
    expect(nome(596, 841)).toBe('A1');
    expect(nome(597.5, 841)).toBe('A0'); // passou da tolerância do A1: sobe para o formato seguinte
  });

  it('largura fora do padrão sobe para o formato seguinte', () => {
    expect(nome(450, 1000)).toBe('A1 +'); // 45 cm vira A1; 100 cm no A1 é "+"
    expect(nome(450, 700)).toBe('A1');
    expect(nome(330.1, 483.1)).toBe('A2'); // papel personalizado do teste (SPCI)
  });

  it('mais de 60 cm de largura entra na categoria A0', () => {
    expect(nome(700, 1200)).toBe('A0');
    expect(nome(700, 1400)).toBe('A0 +');
    expect(nome(910, 1189)).toBe('A0');
  });
});

describe('classificarFolha — comprimento e "+"', () => {
  it('o padrão vai até o comprimento original mais 2 cm', () => {
    expect(nome(594, 861)).toBe('A1');
    expect(nome(594, 862)).toBe('A1 +');
    expect(nome(841, 1209)).toBe('A0');
    expect(nome(841, 1210)).toBe('A0 +');
  });

  it('faixas do A1: + até 105 cm, ++ até 120 cm', () => {
    expect(nome(594, 1000)).toBe('A1 +');
    expect(nome(594, 1050)).toBe('A1 +');
    expect(nome(594, 1051)).toBe('A1 ++');
    expect(nome(594, 1180)).toBe('A1 ++'); // PDFs 1108 e 1109 do teste
    expect(nome(594, 1200)).toBe('A1 ++');
  });

  it('faixas do A0 seguem a mesma proporção', () => {
    expect(nome(841, 1480)).toBe('A0 +');
    expect(nome(841, 1490)).toBe('A0 ++');
    expect(nome(841, 1690)).toBe('A0 ++');
  });

  it('passou do ++ fica com valor manual', () => {
    const c = classificarFolha(594.1, 1500, 10); // PDFs 1106 e 1107 do teste
    expect(c.acimaDaTabela).toBe(true);
    expect(c.manual).toBe('tamanho fora da tabela');
    expect(rotuloFormato(c, 1500)).toBe('A1 · 150,0 cm (acima do ++)');
    expect(classificarFolha(420.2, 1180, 10).manual).toBe('tamanho fora da tabela'); // 1104 e 1105
  });
});

describe('classificarFolha — preenchimento', () => {
  it('acima de 45% fica com valor manual', () => {
    expect(classificarFolha(594, 841, 45).manual).toBeNull();
    expect(classificarFolha(594, 841, 45.1).manual).toBe('preenchimento acima de 45%');
  });

  it('tamanho fora da tabela tem prioridade como motivo', () => {
    expect(classificarFolha(594, 1500, 80).manual).toBe('tamanho fora da tabela');
  });

  it('sem medida de preenchimento não marca manual', () => {
    expect(classificarFolha(594, 841, null).manual).toBeNull();
  });

  it('desconta os 2 pontos do navegador sem passar de 0 a 100', () => {
    expect(corrigirPreenchimento(10)).toBe(8);
    expect(corrigirPreenchimento(1)).toBe(0);
    expect(corrigirPreenchimento(100)).toBe(98);
  });
});
