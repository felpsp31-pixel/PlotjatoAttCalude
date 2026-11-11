import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { descricaoComPrazo, generateReciboPdf, textoPrazo } from './reciboPdf';
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
    const pdf = await generateReciboPdf(doc(linhas), { empresaInfo, tipo: 'orcamento' });
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(148, 0);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(210, 0);
    const texto = pdf.output();
    expect(texto.match(/Prazo: 2 dias/g)).toHaveLength(1); // uma via só
    expect(texto).not.toContain('RECIBO N');
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
