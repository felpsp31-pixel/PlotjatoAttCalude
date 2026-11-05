import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResumoDoDia from './ResumoDoDia';

const demandas: unknown[] = [];
const invoices: unknown[] = [];
let falharDemandas = false;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      if (tabela === 'demandas') {
        return {
          select: async () =>
            falharDemandas
              ? { data: null, error: new Error('rls') }
              : { data: demandas, error: null },
        };
      }
      // financial_invoices: cadeia neq().eq().lt()
      const chain = {
        select: () => chain,
        neq: () => chain,
        eq: () => chain,
        lt: async () => ({ data: invoices, error: null }),
      };
      return chain;
    },
  },
}));

const hoje = new Date();
const em = (dias: number, hora = 12) => {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + dias, hora);
  return d.toISOString();
};

const montar = () => render(<MemoryRouter><ResumoDoDia /></MemoryRouter>);

beforeEach(() => {
  demandas.length = 0;
  invoices.length = 0;
  falharDemandas = false;
  sessionStorage.clear();
});

describe('ResumoDoDia', () => {
  it('conta atrasada, vence hoje e aguardando retirada', async () => {
    demandas.push(
      { prazo: em(-2), status: 'pendente', retirado: false },
      { prazo: em(0, 16), status: 'em_andamento', retirado: false },
      { prazo: em(0, 9), status: 'pendente', retirado: false },
      { prazo: em(5), status: 'pendente', retirado: false },
      { prazo: em(-9), status: 'concluido', retirado: false },
      { prazo: em(-9), status: 'concluido', retirado: true },
    );
    montar();
    await waitFor(() => expect(screen.getByText('demanda atrasada')).toBeInTheDocument());
    expect(screen.getByText('vencem hoje')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();           // duas hoje
    expect(screen.getByText('pronta para retirar')).toBeInTheDocument();
  });

  it('demanda sem prazo nao conta como atrasada', async () => {
    demandas.push({ prazo: null, status: 'pendente', retirado: false });
    montar();
    await waitFor(() => expect(screen.getByText(/Nada vencendo hoje/)).toBeInTheDocument());
  });

  it('concluida e retirada nao aparece', async () => {
    demandas.push({ prazo: em(-3), status: 'concluido', retirado: true });
    montar();
    await waitFor(() => expect(screen.getByText(/Nada vencendo hoje/)).toBeInTheDocument());
  });

  it('esconde o dinheiro com o Financeiro bloqueado', async () => {
    demandas.push({ prazo: em(-1), status: 'pendente', retirado: false });
    invoices.push({ value: 4100, due_date: '2020-01-01', status: 'open', entity_type: 'client' });
    montar();
    await waitFor(() => expect(screen.getByText('demanda atrasada')).toBeInTheDocument());
    expect(screen.queryByText(/em atraso ·/)).toBeNull();
    expect(screen.queryByText(/4\.100/)).toBeNull();
  });

  it('mostra o dinheiro quando o Financeiro foi desbloqueado', async () => {
    sessionStorage.setItem('financial_auth', 'x');
    invoices.push(
      { value: 4100, due_date: '2020-01-01', status: 'open', entity_type: 'client' },
      { value: 900.5, due_date: '2020-01-02', status: 'overdue', entity_type: 'client' },
    );
    montar();
    await waitFor(() => expect(screen.getByText(/em atraso · 2 títulos/)).toBeInTheDocument());
    expect(screen.getByText(/5\.000,50/)).toBeInTheDocument();
  });

  it('some da tela se a consulta falhar, sem derrubar a pagina', async () => {
    falharDemandas = true;
    const { container } = montar();
    await waitFor(() => expect(container.textContent).not.toMatch(/carregando/));
    expect(container.textContent).toBe('');
  });
});
