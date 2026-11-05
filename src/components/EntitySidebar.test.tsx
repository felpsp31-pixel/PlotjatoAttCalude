import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EntitySidebar from './EntitySidebar';
import type { Entity } from '@/types/finance';

const ENTIDADES: Entity[] = [
  { id: 'cli', name: 'Construtora Alfa', type: 'client', retainsISS: false },
  { id: 'avu', name: 'CORBIS ENGENHARIA', type: 'casual', retainsISS: false },
];

const montar = (props: Partial<React.ComponentProps<typeof EntitySidebar>> = {}) =>
  render(
    <EntitySidebar
      entities={ENTIDADES}
      invoices={[]}
      selectedId={null}
      onSelect={() => {}}
      onOpenResumo={() => {}}
      {...props}
    />,
  );

describe('EntitySidebar — lixeira dos avulsos', () => {
  it('mostra a lixeira ao lado do avulso', () => {
    montar({ activeTab: 'casual', onDeleteCasual: () => {} });
    expect(screen.getByRole('button', { name: 'Apagar CORBIS ENGENHARIA' }))
      .toBeInTheDocument();
  });

  it('chama onDeleteCasual com a entidade certa', () => {
    const aoApagar = vi.fn();
    montar({ activeTab: 'casual', onDeleteCasual: aoApagar });
    fireEvent.click(screen.getByRole('button', { name: 'Apagar CORBIS ENGENHARIA' }));
    expect(aoApagar).toHaveBeenCalledWith(ENTIDADES[1]);
  });

  it('nao mostra lixeira na aba de clientes', () => {
    montar({ activeTab: 'clients', onDeleteCasual: () => {} });
    expect(screen.queryByRole('button', { name: /^Apagar / })).toBeNull();
  });

  it('nao mostra lixeira quando o handler nao foi passado', () => {
    montar({ activeTab: 'casual' });
    expect(screen.queryByRole('button', { name: /^Apagar / })).toBeNull();
  });

  it('clicar na lixeira nao seleciona a entidade', () => {
    const aoSelecionar = vi.fn();
    montar({ activeTab: 'casual', onSelect: aoSelecionar, onDeleteCasual: () => {} });
    fireEvent.click(screen.getByRole('button', { name: 'Apagar CORBIS ENGENHARIA' }));
    expect(aoSelecionar).not.toHaveBeenCalled();
  });

  it('clicar no nome ainda seleciona', () => {
    const aoSelecionar = vi.fn();
    montar({ activeTab: 'casual', onSelect: aoSelecionar, onDeleteCasual: () => {} });
    fireEvent.click(screen.getByText('CORBIS ENGENHARIA'));
    expect(aoSelecionar).toHaveBeenCalledWith('avu');
  });
});
