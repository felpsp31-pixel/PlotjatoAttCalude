import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssistenteFinanceiro from './AssistenteFinanceiro';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

beforeEach(() => invoke.mockReset());

const montar = () =>
  render(<AssistenteFinanceiro open onOpenChange={() => {}} />);

describe('AssistenteFinanceiro', () => {
  it('mostra sugestoes antes da primeira pergunta', () => {
    montar();
    expect(screen.getByText('Quem está em atraso?')).toBeInTheDocument();
  });

  it('clicar numa sugestao ja pergunta', async () => {
    invoke.mockResolvedValue({ data: { resposta: 'Ninguém está em atraso.' }, error: null });
    montar();
    fireEvent.click(screen.getByText('Quem está em atraso?'));
    await waitFor(() => expect(screen.getByText('Ninguém está em atraso.')).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith('perguntar-financeiro',
      { body: { pergunta: 'Quem está em atraso?' } });
  });

  it('a pergunta fica na tela enquanto a IA responde', async () => {
    let liberar: (v: unknown) => void = () => {};
    invoke.mockReturnValue(new Promise((res) => { liberar = res; }));
    montar();
    const campo = screen.getByPlaceholderText(/Pergunte alguma coisa/);
    fireEvent.change(campo, { target: { value: 'quanto a Corbis me deve?' } });
    fireEvent.keyDown(campo, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByText('quanto a Corbis me deve?')).toBeInTheDocument());
    expect(screen.getByText(/consultando seus lançamentos/)).toBeInTheDocument();

    liberar({ data: { resposta: 'R$ 4.100,00.' }, error: null });
    await waitFor(() => expect(screen.getByText('R$ 4.100,00.')).toBeInTheDocument());
  });

  it('mostra o erro da funcao em vez de sumir com a pergunta', async () => {
    invoke.mockResolvedValue({ data: { error: 'Cota da IA esgotada.' }, error: null });
    montar();
    fireEvent.click(screen.getByText('Quem está em atraso?'));
    await waitFor(() => expect(screen.getByText('Cota da IA esgotada.')).toBeInTheDocument());
    expect(screen.getByText('Quem está em atraso?')).toBeInTheDocument();
  });

  it('nao envia pergunta curta demais', () => {
    montar();
    const campo = screen.getByPlaceholderText(/Pergunte alguma coisa/);
    fireEvent.change(campo, { target: { value: 'oi' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('limpa o campo depois de perguntar', async () => {
    invoke.mockResolvedValue({ data: { resposta: 'ok' }, error: null });
    montar();
    const campo = screen.getByPlaceholderText(/Pergunte alguma coisa/) as HTMLInputElement;
    fireEvent.change(campo, { target: { value: 'quanto recebi?' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(campo.value).toBe(''));
  });
});
