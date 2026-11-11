import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import Combobox from './Combobox';

const OPCOES = [{ value: 'o1', label: 'Obra Centro' }, { value: 'o2', label: 'Obra Savassi' }];

// Reproduz o uso real: o mesmo par de estados do campo Obra, onde escolher
// da lista limpa o texto livre e digitar um nome limpa a selecao.
const CampoObra = () => {
  const [id, setId] = useState('');
  const [livre, setLivre] = useState('');
  return (
    <>
      <span data-testid="estado">{`id=${id}|livre=${livre}`}</span>
      <Combobox
        options={OPCOES}
        value={id}
        onValueChange={(v) => { setId(v); setLivre(''); }}
        textoLivre={livre}
        onTextoLivre={(t) => { setLivre(t); setId(''); }}
        placeholder="Selecione ou digite"
      />
    </>
  );
};

describe('Combobox com texto livre', () => {
  it('mantem a opcao escolhida da lista', async () => {
    render(<CampoObra />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Obra Savassi'));
    expect(screen.getByTestId('estado').textContent).toBe('id=o2|livre=');
  });

  it('aceita um nome que nao esta na lista', async () => {
    render(<CampoObra />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'Casa do Lago' } });
    fireEvent.click(await screen.findByText(/Usar "Casa do Lago"/));
    expect(screen.getByTestId('estado').textContent).toBe('id=|livre=Casa do Lago');
  });

  it('sem texto livre, nao oferece a opcao de usar o digitado', async () => {
    const onValueChange = vi.fn();
    render(<Combobox options={OPCOES} value="" onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.change(screen.getByPlaceholderText('Buscar...'), { target: { value: 'Casa do Lago' } });
    expect(screen.queryByText(/Usar "/)).toBeNull();
  });
});
