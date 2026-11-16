export interface GrupoPorCliente<T> {
  clienteId: string;
  clienteNome: string;
  itens: T[];
}

const comparar = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Agrupa itens (solicitantes, obras) por cliente. Grupos em ordem alfabética
 * pelo nome do cliente, itens em ordem alfabética dentro do grupo. Itens de
 * cliente que não existe mais ficam no fim, em "Sem cliente". Com `filtroId`,
 * devolve só o grupo daquele cliente.
 */
export function agruparPorCliente<T extends { clienteId: string; name: string }>(
  itens: T[],
  clientes: { id: string; name: string }[],
  filtroId?: string,
): GrupoPorCliente<T>[] {
  const nomes = new Map(clientes.map(c => [c.id, c.name]));
  const mapa = new Map<string, T[]>();
  for (const it of itens) {
    if (filtroId && it.clienteId !== filtroId) continue;
    const chave = nomes.has(it.clienteId) ? it.clienteId : '';
    mapa.set(chave, [...(mapa.get(chave) ?? []), it]);
  }
  const grupos: GrupoPorCliente<T>[] = [...mapa.entries()].map(([clienteId, lista]) => ({
    clienteId,
    clienteNome: clienteId ? nomes.get(clienteId) ?? '' : 'Sem cliente',
    itens: [...lista].sort((a, b) => comparar(a.name, b.name)),
  }));
  return grupos.sort((a, b) => {
    if (!a.clienteId) return 1;
    if (!b.clienteId) return -1;
    return comparar(a.clienteNome, b.clienteNome);
  });
}
