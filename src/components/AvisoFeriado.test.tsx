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

  it('"Já coloquei" some com o aviso e não volta', () => {
    const { unmount } = render(<AvisoFeriado agora={dia('2026-12-23')} />);
    fireEvent.click(screen.getByText('Já coloquei'));
    expect(screen.queryByText('Natal')).toBeNull();
    unmount();
    render(<AvisoFeriado agora={dia('2026-12-24')} />);
    expect(screen.queryByText('Natal')).toBeNull();
  });

  it('"Lembrar depois" fecha o pop-up mas mantém o bloco', () => {
    render(<AvisoFeriado agora={dia('2026-12-23')} />);
    fireEvent.click(screen.getByText('Lembrar depois'));
    expect(screen.queryByText('Colocar aviso de funcionamento')).toBeNull();
    expect(screen.getByText('Natal')).toBeInTheDocument();
  });
});
