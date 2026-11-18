import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AvisoFeriado from './AvisoFeriado';

const dia = (iso: string) => new Date(`${iso}T12:00:00-03:00`);

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('AvisoFeriado', () => {
  it('mostra bloco e pop-up 2 dias antes', () => {
    render(<AvisoFeriado agora={dia('2026-12-23')} />);
    expect(screen.getByText('Colocar aviso de funcionamento')).toBeInTheDocument();
    expect(screen.getByText('Natal')).toBeInTheDocument();
  });

  it('não mostra nada longe de feriado', () => {
    const { container } = render(<AvisoFeriado agora={dia('2026-12-10')} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('"Já coloquei" fecha nesta abertura do sistema', () => {
    const { unmount } = render(<AvisoFeriado agora={dia('2026-12-23')} />);
    fireEvent.click(screen.getByText('Já coloquei'));
    expect(screen.queryByText('Natal')).toBeNull();
    unmount();
    render(<AvisoFeriado agora={dia('2026-12-23')} />); // mesma janela, volta à tela inicial
    expect(screen.queryByText('Natal')).toBeNull();
  });

  it('abre de novo na próxima abertura do sistema, mesmo depois de marcado', () => {
    const { unmount } = render(<AvisoFeriado agora={dia('2026-12-23')} />);
    fireEvent.click(screen.getByText('Já coloquei'));
    unmount();
    sessionStorage.clear(); // fechar e abrir o sistema
    render(<AvisoFeriado agora={dia('2026-12-24')} />);
    expect(screen.getByText('Colocar aviso de funcionamento')).toBeInTheDocument();
  });

  it('não fecha com Esc nem tem botão X', () => {
    render(<AvisoFeriado agora={dia('2026-12-23')} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.getByText('Colocar aviso de funcionamento')).toBeInTheDocument();
    expect(screen.queryByText('Lembrar depois')).toBeNull();
    expect(screen.getByRole('dialog').querySelector('button.absolute')).toBeTruthy(); // existe no DOM…
    expect(screen.getByRole('dialog').className).toContain('[&>button.absolute]:hidden'); // …mas escondido
  });

  it('volta a abrir toda vez que o sistema abre, até confirmar', () => {
    const { unmount } = render(<AvisoFeriado agora={dia('2026-12-23')} />);
    unmount();
    render(<AvisoFeriado agora={dia('2026-12-23')} />);
    expect(screen.getByText('Colocar aviso de funcionamento')).toBeInTheDocument();
  });
});
