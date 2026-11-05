import { describe, it, expect } from 'vitest';
import { casarCliente, normalizar, soDigitos } from './casarCliente';

const CLIENTES = [
  { id: 'c1', name: 'Construtora Alfa', cnpj: '12.345.678/0001-90' },
  { id: 'c2', name: 'Beta Engenharia LTDA', cnpj: '98765432000111' },
  { id: 'c3', name: 'Gama', cnpj: null },
  { id: 'c4', name: 'Delta Obras', cnpj: '' },
];

describe('normalizar', () => {
  it('tira acento, pontuacao e sufixo societario', () => {
    expect(normalizar('CONSTRUTORA ALFA LTDA')).toBe('construtoraalfa');
    expect(normalizar('Construtora Alfa')).toBe('construtoraalfa');
    expect(normalizar('Beta Engenharia Ltda.')).toBe('betaengenharia');
    expect(normalizar('SERVIÇOS ACME ME')).toBe('servicosacme');
  });
});

describe('soDigitos', () => {
  it('limpa a mascara do CNPJ', () => {
    expect(soDigitos('12.345.678/0001-90')).toBe('12345678000190');
    expect(soDigitos(null)).toBe('');
  });
});

describe('casarCliente', () => {
  it('casa por CNPJ mesmo com a razao social diferente', () => {
    const r = casarCliente('ALFA CONSTRUCOES E EMPREENDIMENTOS SA', '12345678000190', CLIENTES);
    expect(r).toEqual({ id: 'c1', name: 'Construtora Alfa', via: 'cnpj' });
  });

  it('casa a razao social da nota com o nome curto do cadastro', () => {
    // era este o caso que falhava: a nota virava cliente avulso novo
    const r = casarCliente('CONSTRUTORA ALFA LTDA', null, CLIENTES);
    expect(r?.id).toBe('c1');
    expect(r?.via).toBe('nome');
  });

  it('casa com a mascara do CNPJ no cadastro', () => {
    expect(casarCliente('Qualquer Nome', '12.345.678/0001-90', CLIENTES)?.id).toBe('c1');
  });

  it('nao gruda num cliente sem CNPJ quando a nota tambem nao tem', () => {
    // '' === '' casaria com c3/c4 se o codigo nao exigisse 14 digitos
    expect(casarCliente('Empresa Desconhecida', '', CLIENTES)).toBeNull();
    expect(casarCliente('Empresa Desconhecida', null, CLIENTES)).toBeNull();
  });

  it('ignora CNPJ incompleto e cai para o nome', () => {
    expect(casarCliente('Beta Engenharia', '1234', CLIENTES)?.id).toBe('c2');
  });

  it('casa por conteudo quando so um candidato bate', () => {
    const r = casarCliente('DELTA OBRAS E REFORMAS LTDA', null, CLIENTES);
    expect(r?.id).toBe('c4');
    expect(r?.via).toBe('nome-parcial');
  });

  it('nao chuta quando dois candidatos batem parcialmente', () => {
    const ambiguos = [
      { id: 'a', name: 'Alfa Norte', cnpj: null },
      { id: 'b', name: 'Alfa Sul', cnpj: null },
    ];
    expect(casarCliente('ALFA', null, ambiguos)).toBeNull();
  });

  it('nao casa nome curto demais por conteudo', () => {
    // 'abc' esta contido em 'abcdefconstrucoes', mas e curto demais para
    // valer como evidencia: casar aqui penduraria a nota no cliente errado.
    expect(casarCliente('ABC', null, [{ id: 'x', name: 'ABCDEF Construcoes', cnpj: null }]))
      .toBeNull();
  });

  it('casamento exato vale mesmo com o sufixo escondendo a diferenca', () => {
    // 'ABC Participacoes' vira 'abc': e o mesmo nome, nao um palpite
    expect(casarCliente('ABC', null, [{ id: 'x', name: 'ABC Participacoes', cnpj: null }])?.via)
      .toBe('nome');
  });

  it('devolve null sem tomador e sem CNPJ', () => {
    expect(casarCliente(null, null, CLIENTES)).toBeNull();
    expect(casarCliente('   ', null, CLIENTES)).toBeNull();
  });

  it('o CNPJ vence o nome quando os dois apontam para clientes diferentes', () => {
    const r = casarCliente('Beta Engenharia', '12345678000190', CLIENTES);
    expect(r?.id).toBe('c1');
    expect(r?.via).toBe('cnpj');
  });
});
