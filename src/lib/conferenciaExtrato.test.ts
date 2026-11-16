import { describe, expect, it } from 'vitest';
import { decodificar, lerCSV, lerData, lerExtrato, lerOFX, lerValor, ExtratoInvalido } from './extratoBancario';
import { conferirExtrato, semelhanca, type EntidadeConf, type LancamentoConf } from './conferenciaExtrato';

describe('lerValor', () => {
  it.each([
    ['1.234,56', 1234.56], ['1234.56', 1234.56], ['-1.234,56', -1234.56], ['R$ 1.234,56', 1234.56],
    ['(10,00)', -10], ['10,00-', -10], ['1.234', 1234], ['12.5', 12.5], ['1,234.56', 1234.56], ['0,99', 0.99],
  ])('%s', (entrada, esperado) => expect(lerValor(entrada)).toBeCloseTo(esperado));
  it('rejeita texto', () => { expect(lerValor('abc')).toBeNull(); expect(lerValor('')).toBeNull(); });
});

describe('lerData', () => {
  it.each([
    ['12/11/2026', '2026-11-12'], ['12/11/26', '2026-11-12'], ['2026-11-12', '2026-11-12'],
    ['20261112120000[-3:BRT]', '2026-11-12'], ['20261112', '2026-11-12'], ['1-2-2026', '2026-02-01'],
  ])('%s', (entrada, esperado) => expect(lerData(entrada)).toBe(esperado));
  it('rejeita data impossível', () => { expect(lerData('32/13/2026')).toBeNull(); expect(lerData('texto')).toBeNull(); });
});

// OFX 1.x de banco brasileiro: SGML sem tags de fechamento, valores com ponto.
const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261110120000[-3:BRT]
<TRNAMT>1500.00
<FITID>2026111001
<MEMO>PIX RECEBIDO CONSTRUTORA ALFA LTDA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261111
<TRNAMT>-320.50
<FITID>2026111102
<MEMO>PAGAMENTO FORNECEDOR XYZ
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261112
<TRNAMT>980,00
<FITID>2026111203
<NAME>TED RECEBIDA
<MEMO>BETA ENGENHARIA E CONSTRUCAO
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

describe('lerOFX', () => {
  it('lê entradas e saídas, com FITID, valor negativo e vírgula decimal', () => {
    const t = lerOFX(OFX);
    expect(t).toHaveLength(3);
    expect(t[0]).toMatchObject({ id: '2026111001', data: '2026-11-10', valor: 1500, descricao: 'PIX RECEBIDO CONSTRUTORA ALFA LTDA' });
    expect(t[1].valor).toBe(-320.5);
    expect(t[2]).toMatchObject({ valor: 980, descricao: 'TED RECEBIDA - BETA ENGENHARIA E CONSTRUCAO' });
  });

  it('decodifica windows-1252 (acentos de banco)', () => {
    const bytes = Uint8Array.from([...'PIX JOS'].map(c => c.charCodeAt(0)).concat([0xc9], [...' LTDA'].map(c => c.charCodeAt(0))));
    expect(decodificar(bytes.buffer)).toBe('PIX JOSÉ LTDA');
    expect(decodificar(new TextEncoder().encode('PIX JOSÉ').buffer)).toBe('PIX JOSÉ');
  });
});

describe('lerCSV', () => {
  it('acha o cabeçalho depois de linhas de título e separa por ponto e vírgula', () => {
    const csv = `Extrato Conta Corrente\nAgência: 0001;Conta: 12345-6\n\nData;Histórico;Valor\n10/11/2026;PIX RECEBIDO CONSTRUTORA ALFA LTDA;"1.500,00"\n11/11/2026;PAG FORNECEDOR;-320,50\n`;
    const t = lerCSV(csv);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ data: '2026-11-10', valor: 1500, descricao: 'PIX RECEBIDO CONSTRUTORA ALFA LTDA' });
    expect(t[1].valor).toBe(-320.5);
  });

  it('colunas separadas de crédito e débito', () => {
    const t = lerCSV('Data,Descrição,Crédito,Débito\n10/11/2026,Depósito,"1.000,00",\n11/11/2026,Tarifa,,"15,90"');
    expect(t.map(x => x.valor)).toEqual([1000, -15.9]);
  });

  it('coluna de tipo D/C inverte o sinal do débito', () => {
    const t = lerCSV('Data;Descrição;Valor;Tipo\n10/11/2026;Depósito;100,00;Crédito\n11/11/2026;Tarifa;15,90;Débito');
    expect(t.map(x => x.valor)).toEqual([100, -15.9]);
  });

  it('sem cabeçalho, identifica data e valor pelo conteúdo', () => {
    const t = lerCSV('10/11/2026;PIX CONSTRUTORA ALFA;1.500,00\n11/11/2026;TARIFA;-15,90');
    expect(t).toHaveLength(2);
    expect(t[0].descricao).toBe('PIX CONSTRUTORA ALFA');
  });

  it('arquivo com BOM do Excel no começo', () => {
    const t = lerCSV('\uFEFFData;Histórico;Valor\n10/11/2026;PIX ALFA;10,00');
    expect(t).toHaveLength(1);
  });

  it('data de lançamento não vira descrição', () => {
    const t = lerCSV('Data Lançamento;Descrição;Valor\n10/11/2026;PIX ALFA;10,00');
    expect(t[0].descricao).toBe('PIX ALFA');
  });
});

describe('lerExtrato', () => {
  it('detecta OFX e CSV, e recusa arquivo sem lançamentos', () => {
    expect(lerExtrato(OFX)).toHaveLength(3);
    expect(lerExtrato('Data;Descricao;Valor\n10/11/2026;X;5,00')).toHaveLength(1);
    expect(() => lerExtrato('qualquer coisa')).toThrow(ExtratoInvalido);
  });
});

// ------------------------------------------------------------ conferência

const entidades: EntidadeConf[] = [
  { id: 'alfa', name: 'Construtora Alfa Ltda', document: '12.345.678/0001-90' },
  { id: 'beta', name: 'Beta Engenharia e Construção', document: '98.765.432/0001-10' },
  { id: 'joao', name: 'João da Silva', document: '123.456.789-09' },
];
const lanc = (id: string, entityId: string, value: number, dueDate = '2026-11-10', status: LancamentoConf['status'] = 'open'): LancamentoConf =>
  ({ id, entityId, entityName: entidades.find(e => e.id === entityId)!.name, description: 'Recibos - Out/2026', value, dueDate, status });
const tx = (id: string, valor: number, descricao: string, data = '2026-11-10') => ({ id, data, valor, descricao });

describe('semelhanca', () => {
  it('CNPJ no texto do banco vale mais que o nome', () => {
    expect(semelhanca('PIX RECEBIDO 12345678000190 X', entidades[0]).nota).toBe(1);
  });
  it('CPF mascarado do PIX bate pelos dígitos do meio', () => {
    expect(semelhanca('PIX JOAO S ***.456.789-**', entidades[2]).nota).toBeGreaterThanOrEqual(0.9);
  });
  it('ignora palavras genéricas e acentos', () => {
    expect(semelhanca('PIX RECEBIDO JOAO SILVA', entidades[2]).nota).toBeGreaterThan(0.5);
    expect(semelhanca('PIX RECEBIDO TRANSFERENCIA LTDA', entidades[0]).nota).toBe(0);
  });
});

describe('conferirExtrato', () => {
  const lancamentos = [
    lanc('a1', 'alfa', 1500),
    lanc('b1', 'beta', 980),
    lanc('b2', 'beta', 450),
    lanc('b3', 'beta', 200, '2026-11-12'),
    lanc('j1', 'joao', 300),
    lanc('x1', 'alfa', 777, '2026-10-01', 'paid'),
  ];

  it('valor igual + nome do cliente = alta, e só entradas são conferidas', () => {
    const { entradas, saidasIgnoradas } = conferirExtrato(lerOFX(OFX), lancamentos, entidades);
    expect(saidasIgnoradas).toBe(1);
    expect(entradas).toHaveLength(2);
    expect(entradas[0].melhor?.lancamentos[0].id).toBe('a1');
    expect(entradas[0].melhor?.confianca).toBe('alta');
    expect(entradas[1].melhor?.lancamentos[0].id).toBe('b1');
    expect(entradas[1].melhor?.confianca).toBe('alta');
  });

  it('só o valor bate (nome desconhecido) = baixa, nunca alta', () => {
    const { entradas } = conferirExtrato([tx('1', 300, 'PIX DE FULANO QUALQUER')], lancamentos, entidades);
    expect(entradas[0].melhor?.lancamentos[0].id).toBe('j1');
    expect(entradas[0].melhor?.confianca).toBe('baixa');
  });

  it('cliente pagou várias faturas de uma vez', () => {
    const { entradas } = conferirExtrato([tx('1', 1430, 'PIX BETA ENGENHARIA E CONSTRUCAO')], lancamentos, entidades);
    const m = entradas[0].melhor!;
    expect(m.lancamentos.map(l => l.id).sort()).toEqual(['b1', 'b2']);
    expect(m.motivos.join()).toContain('soma de 2');
    expect(m.confianca).not.toBe('baixa');
  });

  it('pagou um pouco menos (retenção): sugere, mas avisa e não é alta', () => {
    const { entradas } = conferirExtrato([tx('1', 1425, 'PIX CONSTRUTORA ALFA LTDA')], lancamentos, entidades);
    expect(entradas[0].melhor?.lancamentos[0].id).toBe('a1');
    expect(entradas[0].melhor?.valorMenor).toBe(true);
    expect(entradas[0].melhor?.confianca).toBe('media');
  });

  it('dois lançamentos iguais do mesmo cliente: pede escolha (média)', () => {
    const l = [lanc('a1', 'alfa', 500), lanc('a2', 'alfa', 500, '2026-11-20')];
    const { entradas } = conferirExtrato([tx('1', 500, 'PIX CONSTRUTORA ALFA LTDA')], l, entidades);
    expect(entradas[0].melhor?.confianca).toBe('media');
    expect(entradas[0].alternativas).toHaveLength(1);
  });

  it('um lançamento não é sugerido para dois pagamentos', () => {
    const l = [lanc('a1', 'alfa', 500)];
    const { entradas } = conferirExtrato(
      [tx('1', 500, 'PIX CONSTRUTORA ALFA LTDA', '2026-11-10'), tx('2', 500, 'PIX DESCONHECIDO', '2026-11-11')], l, entidades);
    const comMelhor = entradas.filter(e => e.melhor);
    expect(comMelhor).toHaveLength(1);
    expect(comMelhor[0].transacao.id).toBe('1');
  });

  it('extrato repetido: o que já está pago aparece como já pago', () => {
    const { entradas } = conferirExtrato([tx('1', 777, 'PIX CONSTRUTORA ALFA LTDA')], lancamentos, entidades);
    expect(entradas[0].jaPago).toBe(true);
  });

  it('sem nada parecido, fica sem sugestão', () => {
    const { entradas } = conferirExtrato([tx('1', 12.34, 'RENDIMENTO')], lancamentos, entidades);
    expect(entradas[0].melhor).toBeNull();
  });

  it('valor igual de outro cliente não vence o cliente certo', () => {
    const l = [lanc('a1', 'alfa', 500), lanc('b9', 'beta', 500)];
    const { entradas } = conferirExtrato([tx('1', 500, 'PIX BETA ENGENHARIA E CONSTRUCAO')], l, entidades);
    expect(entradas[0].melhor?.lancamentos[0].id).toBe('b9');
    expect(entradas[0].melhor?.confianca).toBe('alta');
  });
});
