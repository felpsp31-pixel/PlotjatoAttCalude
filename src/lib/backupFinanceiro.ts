// Monta as planilhas do backup do Financeiro. Funcao pura: recebe os
// lancamentos do periodo e devolve o texto de cada CSV. Os CSVs usam ";" e
// virgula decimal, com BOM, para abrir certo no Excel em portugues.

export interface LancamentoBackup {
  id: string;
  created_at: string;
  description: string;
  due_date: string;
  entity_id: string;
  entity_name: string;
  entity_type: string; // 'client' | 'supplier'
  reference_month: string;
  status: string; // 'open' | 'overdue' | 'paid'
  value: number;
  nfse_numero?: string | null;
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const BOM = '﻿';

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });

const celula = (v: string | number) => {
  const s = typeof v === 'number' ? brl(v) : String(v ?? '');
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csv = (linhas: (string | number)[][]) =>
  BOM + linhas.map((l) => l.map(celula).join(';')).join('\r\n') + '\r\n';

const dataBR = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

// "Out/2026" -> "2026-10". Se nao reconhecer, usa o mes do vencimento.
export function chaveDoMes(l: Pick<LancamentoBackup, 'reference_month' | 'due_date'>): string {
  const m = /^(\w{3})\/(\d{4})$/.exec((l.reference_month ?? '').trim());
  if (m) {
    const i = MESES.indexOf(m[1]);
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}$/.test(l.reference_month ?? '')) return l.reference_month;
  return (l.due_date ?? '').slice(0, 7);
}

const rotuloDoMes = (chave: string) => {
  const [ano, mes] = chave.split('-');
  return `${MESES[Number(mes) - 1] ?? mes}/${ano}`;
};

const nomeStatus: Record<string, string> = { paid: 'Pago', open: 'Em aberto', overdue: 'Vencido' };

export interface ArquivosBackup {
  'resumo.csv': string;
  'faturamento_mensal_por_cliente.csv': string;
  'total_por_cliente.csv': string;
  'lancamentos.csv': string;
}

export function montarBackup(
  lancamentos: LancamentoBackup[],
  periodo: { inicio: string | null; fim: string },
): { arquivos: ArquivosBackup; faturamento: number } {
  const clientes = lancamentos.filter((l) => l.entity_type === 'client');
  const fornecedores = lancamentos.filter((l) => l.entity_type === 'supplier');
  const soma = (ls: LancamentoBackup[]) => ls.reduce((s, l) => s + (Number(l.value) || 0), 0);

  const faturamento = soma(clientes);
  const recebido = soma(clientes.filter((l) => l.status === 'paid'));
  const despesas = soma(fornecedores);

  // Resumo
  const resumo = csv([
    ['Backup do Financeiro - Plotjato'],
    ['Período', periodo.inicio ? `${dataBR(periodo.inicio)} até ${dataBR(periodo.fim)}` : `Início até ${dataBR(periodo.fim)}`],
    [],
    ['Indicador', 'Valor (R$)'],
    ['Faturamento total (clientes)', faturamento],
    ['Recebido', recebido],
    ['Em aberto', faturamento - recebido],
    ['Despesas (fornecedores)', despesas],
    ['Resultado (faturamento - despesas)', faturamento - despesas],
    [],
    ['Lançamentos de clientes', String(clientes.length)],
    ['Lançamentos de fornecedores', String(fornecedores.length)],
  ]);

  // Faturamento mensal por cliente (tabela cliente x mes)
  const meses = [...new Set(clientes.map(chaveDoMes))].filter(Boolean).sort();
  const porCliente = new Map<string, { nome: string; meses: Map<string, number>; pago: number; aberto: number; qtd: number }>();
  for (const l of clientes) {
    const chave = l.entity_id || l.entity_name;
    const c = porCliente.get(chave) ?? { nome: l.entity_name || '(sem nome)', meses: new Map(), pago: 0, aberto: 0, qtd: 0 };
    const mes = chaveDoMes(l);
    const v = Number(l.value) || 0;
    c.meses.set(mes, (c.meses.get(mes) ?? 0) + v);
    if (l.status === 'paid') c.pago += v; else c.aberto += v;
    c.qtd++;
    porCliente.set(chave, c);
  }
  const ordenados = [...porCliente.values()].sort((a, b) => (b.pago + b.aberto) - (a.pago + a.aberto));

  const mensal: (string | number)[][] = [['Cliente', ...meses.map(rotuloDoMes), 'Total']];
  for (const c of ordenados) {
    mensal.push([c.nome, ...meses.map((m) => c.meses.get(m) ?? 0), c.pago + c.aberto]);
  }
  mensal.push(['TOTAL', ...meses.map((m) => ordenados.reduce((s, c) => s + (c.meses.get(m) ?? 0), 0)), faturamento]);

  // Total de cada cliente no periodo
  const totais: (string | number)[][] = [['Cliente', 'Total no período', 'Pago', 'Em aberto', 'Lançamentos', '% do faturamento']];
  for (const c of ordenados) {
    const total = c.pago + c.aberto;
    totais.push([c.nome, total, c.pago, c.aberto, String(c.qtd), faturamento ? `${brl((total / faturamento) * 100)}%` : '0%']);
  }
  totais.push(['TOTAL', faturamento, recebido, faturamento - recebido, String(clientes.length), '100%']);

  // Todos os lancamentos, linha a linha
  const todos: (string | number)[][] = [[
    'Tipo', 'Empresa', 'Descrição', 'Mês de referência', 'Vencimento', 'Valor', 'Situação', 'NFS-e', 'Criado em', 'ID',
  ]];
  for (const l of [...lancamentos].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    todos.push([
      l.entity_type === 'client' ? 'Cliente' : 'Fornecedor',
      l.entity_name, l.description, l.reference_month,
      l.due_date ? l.due_date.split('-').reverse().join('/') : '',
      Number(l.value) || 0,
      nomeStatus[l.status] ?? l.status,
      l.nfse_numero ?? '',
      dataBR(l.created_at),
      l.id,
    ]);
  }

  return {
    faturamento,
    arquivos: {
      'resumo.csv': resumo,
      'faturamento_mensal_por_cliente.csv': csv(mensal),
      'total_por_cliente.csv': csv(totais),
      'lancamentos.csv': csv(todos),
    },
  };
}
