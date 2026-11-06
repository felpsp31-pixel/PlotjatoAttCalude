import { describe, it, expect } from 'vitest';
import { montarBackup, chaveDoMes, type LancamentoBackup } from './backupFinanceiro';

const l = (p: Partial<LancamentoBackup>): LancamentoBackup => ({
  id: Math.random().toString(36).slice(2), created_at: '2026-11-02T12:00:00Z', description: 'x',
  due_date: '2026-11-10', entity_id: 'a', entity_name: 'Corbis', entity_type: 'client',
  reference_month: 'Out/2026', status: 'open', value: 100, ...p,
});

describe('chaveDoMes', () => {
  it('converte o mes de referencia e cai no vencimento quando nao reconhece', () => {
    expect(chaveDoMes({ reference_month: 'Out/2026', due_date: '2026-11-10' })).toBe('2026-10');
    expect(chaveDoMes({ reference_month: '', due_date: '2026-12-05' })).toBe('2026-12');
  });
});

describe('montarBackup', () => {
  const dados = [
    l({ entity_id: 'a', entity_name: 'Corbis', value: 1000, status: 'paid', reference_month: 'Out/2026' }),
    l({ entity_id: 'a', entity_name: 'Corbis', value: 500.5, reference_month: 'Nov/2026' }),
    l({ entity_id: 'b', entity_name: 'MIP; Construtora', value: 42, reference_month: 'Nov/2026' }),
    l({ entity_type: 'supplier', entity_id: 'f', entity_name: 'Papel SA', value: 300, status: 'paid' }),
  ];
  const { arquivos, faturamento } = montarBackup(dados, { inicio: null, fim: '2026-11-06T13:00:00Z' });

  it('soma so clientes no faturamento', () => {
    expect(faturamento).toBeCloseTo(1542.5);
    expect(arquivos['resumo.csv']).toContain('Faturamento total (clientes);1542,50');
    expect(arquivos['resumo.csv']).toContain('Recebido;1000,00');
    expect(arquivos['resumo.csv']).toContain('Despesas (fornecedores);300,00');
  });

  it('monta a tabela cliente x mes com total', () => {
    const csv = arquivos['faturamento_mensal_por_cliente.csv'];
    expect(csv.startsWith('﻿Cliente;Out/2026;Nov/2026;Total')).toBe(true);
    expect(csv).toContain('Corbis;1000,00;500,50;1500,50');
    expect(csv).toContain('"MIP; Construtora";0,00;42,00;42,00');
    expect(csv).toContain('TOTAL;1000,00;542,50;1542,50');
  });

  it('lista o total por cliente e todos os lancamentos', () => {
    expect(arquivos['total_por_cliente.csv']).toContain('Corbis;1500,50;1000,00;500,50;2;');
    expect(arquivos['lancamentos.csv'].split('\r\n').filter(Boolean)).toHaveLength(5);
  });
});
