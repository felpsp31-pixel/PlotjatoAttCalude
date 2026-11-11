import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { descricaoComPrazo, generateReciboPdf, linhasCliente, rotuloDocumento, textoPrazo } from './reciboPdf';
import type { Recibo } from '@/types/recibos';

const empresaInfo = { name: 'Plotjato', cnpj: '00.000.000/0001-00', address: 'Rua Teste, 1', phone: '(31) 0000-0000', email: 'a@b.c', logo: '' };

const doc = (lines: Recibo['lines']): Recibo => ({
  id: 'x', number: '0042', date: '2026-11-11', clienteId: '', clienteAvulso: 'Cliente Teste',
  solicitanteId: '', obraId: '', lines, total: lines.reduce((s, l) => s + l.total, 0),
});

const linhas: Recibo['lines'] = [
  { serviceCode: '12', description: 'Plotagem A1 Color', quantity: 10, unitPrice: 8, total: 80, prazoDiasUteis: 2 },
  { serviceCode: '15', description: 'Plotagem A0 Color', quantity: 1, unitPrice: 15, total: 15, prazoDiasUteis: 1 },
  { serviceCode: '20', description: 'Encadernação', quantity: 1, unitPrice: 5, total: 5 },
];

describe('prazo do item', () => {
  it('escreve singular e plural', () => {
    expect(textoPrazo(1)).toBe('Prazo: 1 dia útil');
    expect(textoPrazo(5)).toBe('Prazo: 5 dias úteis');
  });

  it('vai numa linha abaixo da descrição só quando há prazo', () => {
    expect(descricaoComPrazo(linhas[0])).toBe('Plotagem A1 Color\nPrazo: 2 dias úteis');
    expect(descricaoComPrazo(linhas[2])).toBe('Encadernação');
    expect(descricaoComPrazo({ description: 'X', prazoDiasUteis: 0 })).toBe('X');
  });
});

describe('generateReciboPdf', () => {
  it('orçamento sai em uma via, A5 retrato, com o prazo abaixo do item', async () => {
    const pdf = await generateReciboPdf(doc(linhas), {
      empresaInfo, tipo: 'orcamento',
      cliente: { id: 'c', name: 'Construtora Teste', cnpj: '12.345.678/0001-90', phone: '(31) 99999-0000', email: 'obra@construtora.com' },
      solicitante: { id: 's', clienteId: 'c', name: 'João', phone: '(31) 98888-1111' },
      obra: { name: 'Edifício Central' },
    });
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(148, 0);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
    const texto = pdf.output();
    expect(texto.match(/Prazo: 2 dias/g)).toHaveLength(1); // uma via só
    expect(texto).not.toContain('RECIBO N');
    expect(texto).toContain('obra@construtora.com');
    if (process.env.SALVAR_PDF_TESTE) writeFileSync(`${process.env.SALVAR_PDF_TESTE}/orcamento.pdf`, Buffer.from(pdf.output('arraybuffer')));
  });

  it('recibo continua em duas vias lado a lado, A5 deitado', async () => {
    const pdf = await generateReciboPdf(doc(linhas.map(({ prazoDiasUteis: _p, ...l }) => l)), { empresaInfo, tipo: 'recibo', isPago: true, formaPagamento: 'PIX' });
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(210, 0);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(148, 0);
    expect(pdf.output().match(/RECIBO N/g)).toHaveLength(2);
    if (process.env.SALVAR_PDF_TESTE) writeFileSync(`${process.env.SALVAR_PDF_TESTE}/recibo.pdf`, Buffer.from(pdf.output('arraybuffer')));
  });
});

describe('dados do cliente', () => {
  const cliente = { cnpj: '12.345.678/0001-90', phone: '(31) 99999-0000', email: 'obra@cliente.com' };

  it('orçamento mostra tudo o que foi preenchido', () => {
    expect(linhasCliente({ cliente, solicitante: { name: 'João', phone: '(31) 98888-1111' }, obra: { name: 'Ed. Central' }, orcamento: true })).toEqual([
      'CNPJ: 12.345.678/0001-90',
      'Telefone: (31) 99999-0000   E-mail: obra@cliente.com',
      'Solicitante: João · (31) 98888-1111',
      'Obra: Ed. Central',
    ]);
  });

  it('campo vazio não aparece', () => {
    expect(linhasCliente({ cliente: { cnpj: '', phone: '(31) 3333-4444', email: '  ' }, solicitante: { name: 'Ana', phone: '' }, orcamento: true }))
      .toEqual(['Telefone: (31) 3333-4444', 'Solicitante: Ana']);
    expect(linhasCliente({ orcamento: true })).toEqual([]);
  });

  it('recibo mantém o resumo, sem telefone e e-mail', () => {
    expect(linhasCliente({ cliente, solicitante: { name: 'João', phone: '(31) 98888-1111' }, orcamento: false }))
      .toEqual(['CNPJ: 12.345.678/0001-90', 'Solicitante: João']);
  });

  it('CPF com 11 dígitos sai como CPF', () => {
    expect(rotuloDocumento('123.456.789-01')).toBe('CPF');
    expect(rotuloDocumento('12.345.678/0001-90')).toBe('CNPJ');
  });
});
