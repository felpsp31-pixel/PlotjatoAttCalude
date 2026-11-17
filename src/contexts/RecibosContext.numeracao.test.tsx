import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recibo } from '@/types/recibos';

// Banco de mentira com as mesmas regras do SQL (20261117190000_numeracao_sem_buracos):
// sai primeiro o menor número livre, depois o contador; reservas ficam em
// nome do aparelho; recibo salvo tira o número da reserva.
const banco = vi.hoisted(() => {
  const estado = {
    online: true,
    seq: 0,
    recibos: new Map<string, { id: string; number: string }>(),
    livres: new Set<string>(),
    reservados: new Map<string, string>(), // numero -> aparelho
  };
  const fmt = (n: number) => String(n).padStart(4, '0');
  const ocupado = (f: string) => [...estado.recibos.values()].some(r => r.number === f) || estado.reservados.has(f);
  const tirar = () => {
    for (const f of [...estado.livres].sort((a, b) => Number(a) - Number(b))) {
      estado.livres.delete(f);
      if (!ocupado(f)) return f;
    }
    for (;;) {
      const f = fmt(++estado.seq);
      if (!ocupado(f)) return f;
    }
  };
  const semRede = { data: null, error: { message: 'TypeError: Failed to fetch' } };
  const rpcs: Record<string, (a: Record<string, unknown>) => unknown> = {
    next_recibo_number: () => tirar(),
    reservar_numeros_recibo: ({ qtd, aparelho }) => Array.from({ length: Number(qtd) }, () => {
      const f = tirar();
      estado.reservados.set(f, String(aparelho));
      return f;
    }),
    numeros_do_aparelho: ({ aparelho }) => [...estado.reservados].filter(([, a]) => a === aparelho).map(([n]) => n)
      .sort((a, b) => Number(a) - Number(b)),
    liberar_numeros_recibo: ({ aparelho, numeros }) => {
      let qtd = 0;
      for (const n of numeros as string[]) {
        if (estado.reservados.get(n) === aparelho) { estado.reservados.delete(n); estado.livres.add(n); qtd++; }
      }
      return qtd;
    },
    devolver_numero_recibo: ({ numero }) => { if (!ocupado(String(numero))) estado.livres.add(String(numero)); return true; },
  };
  const salvar = (linhas: { id: string; number: string }[], ignorarRepetido = false) => {
    for (const l of linhas) {
      if (estado.recibos.has(l.id) && ignorarRepetido) continue;
      if ([...estado.recibos.values()].some(r => r.number === l.number)) {
        return { data: null, error: { code: '23505', message: 'duplicate key' } };
      }
      estado.recibos.set(l.id, { id: l.id, number: l.number });
      estado.reservados.delete(l.number);
      estado.livres.delete(l.number);
    }
    return { data: null, error: null };
  };
  // Consulta encadeável que sempre devolve lista vazia (carga inicial).
  const consulta = (): unknown => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'order', 'limit', 'eq', 'in', 'gte', 'lte', 'update', 'delete']) q[m] = () => q;
    q.maybeSingle = () => Promise.resolve(estado.online ? { data: null, error: null } : semRede);
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(estado.online ? { data: [], error: null } : semRede).then(ok);
    return q;
  };
  const supabase = {
    rpc: (nome: string, args: Record<string, unknown> = {}) =>
      Promise.resolve(estado.online ? { data: rpcs[nome](args), error: null } : semRede),
    from: (tabela: string) => {
      const q = consulta() as Record<string, unknown>;
      if (tabela === 'recibos') {
        q.insert = (l: { id: string; number: string }[]) => Promise.resolve(estado.online ? salvar(l) : semRede);
        q.upsert = (l: { id: string; number: string }[]) => Promise.resolve(estado.online ? salvar(l, true) : semRede);
      } else {
        q.insert = () => Promise.resolve({ data: null, error: null });
      }
      return q;
    },
  };
  return { estado, supabase };
});

vi.mock('@/integrations/supabase/client', () => ({ supabase: banco.supabase }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ authenticated: true }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { RecibosProvider, useRecibos } from './RecibosContext';
import ModoOfflineAparelho from '@/components/recibos/ModoOfflineAparelho';

type Ctx = ReturnType<typeof useRecibos>;
let ctx: Ctx;
const Espiao = () => { ctx = useRecibos(); return null; };

const novo = (): Omit<Recibo, 'id' | 'number'> => ({
  date: '2026-11-17', clienteId: 'c1', solicitanteId: '', obraId: '',
  lines: [{ serviceCode: '1', description: 'A1', quantity: 1, unitPrice: 10, total: 10 }], total: 10,
});

const ficarOnline = (sim: boolean) => {
  banco.estado.online = sim;
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => sim });
};

const emitir = async () => {
  let r: Recibo | null = null;
  await act(async () => { r = await ctx.addRecibo(novo()); });
  return (r as Recibo | null)?.number ?? null;
};

beforeEach(async () => {
  localStorage.clear();
  Object.assign(banco.estado, { seq: 0, recibos: new Map(), livres: new Set(), reservados: new Map() });
  ficarOnline(true);
  render(<RecibosProvider><Espiao /></RecibosProvider>);
  await waitFor(() => expect(ctx.loading).toBe(false));
});

afterEach(() => ficarOnline(true));

describe('numeração dos recibos', () => {
  it('aparelho comum não reserva números ao abrir, então não abre buraco', async () => {
    expect(await emitir()).toBe('0001');
    await act(async () => { await ctx.sincronizarOffline(); });
    expect(banco.estado.reservados.size).toBe(0);
    expect(await emitir()).toBe('0002');
  });

  it('o bloco antigo, de antes da correção, é descartado', async () => {
    localStorage.setItem('plotjato:numerosOffline', JSON.stringify(['0900']));
    render(<RecibosProvider><Espiao /></RecibosProvider>);
    await waitFor(() => expect(localStorage.getItem('plotjato:numerosOffline')).toBeNull());
  });

  it('aparelho ativado usa o bloco com e sem internet, e a fila sobe ao reconectar', async () => {
    expect(await emitir()).toBe('0001');
    await act(async () => { expect(await ctx.ativarModoOffline()).toBe(true); });
    expect(ctx.numerosReservados).toBe(50); // 0002 a 0051

    // Outro aparelho, online, emite enquanto isso: pula o bloco.
    const doOutro = (await banco.supabase.rpc('next_recibo_number')).data as string;
    expect(doOutro).toBe('0052');
    banco.estado.recibos.set('outro', { id: 'outro', number: doOutro });

    // O balcão, com internet, continua do próprio bloco: sem buraco.
    expect(await emitir()).toBe('0002');

    // Cai a internet: o próximo vem do bloco e vai para a fila.
    ficarOnline(false);
    expect(await emitir()).toBe('0003');
    expect(ctx.pendentesOffline).toBe(1);
    expect(banco.estado.recibos.size).toBe(3);

    // Volta a internet: a fila sobe e o servidor deixa de reservar o 0003.
    ficarOnline(true);
    await act(async () => { await ctx.sincronizarOffline(); });
    expect(ctx.pendentesOffline).toBe(0);
    expect([...banco.estado.recibos.values()].map(r => r.number).sort()).toEqual(['0001', '0002', '0003', '0052']);
    expect(banco.estado.reservados.has('0003')).toBe(false);
  });

  it('repõe o bloco quando está acabando', async () => {
    await act(async () => { await ctx.ativarModoOffline(); });
    for (let i = 0; i < 36; i++) await emitir(); // sobram 14, abaixo de 15
    await waitFor(() => expect(ctx.numerosReservados).toBe(64));
    expect(await emitir()).toBe('0037');
  });

  it('desativar devolve os números, e o próximo recibo usa o menor deles', async () => {
    await act(async () => { await ctx.ativarModoOffline(); });
    expect(await emitir()).toBe('0001');
    await act(async () => { expect(await ctx.desativarModoOffline()).toBe(true); });
    expect(ctx.modoOfflineAtivo).toBe(false);
    expect(banco.estado.reservados.size).toBe(0);
    expect(await emitir()).toBe('0002');
  });

  it('sem internet e sem modo offline, não emite recibo', async () => {
    ficarOnline(false);
    expect(await emitir()).toBeNull();
    expect(ctx.pendentesOffline).toBe(0);
  });

  it('não desativa sem internet (os números precisam voltar)', async () => {
    await act(async () => { await ctx.ativarModoOffline(); });
    ficarOnline(false);
    await act(async () => { expect(await ctx.desativarModoOffline()).toBe(false); });
    expect(ctx.modoOfflineAtivo).toBe(true);
  });

  it('número que o servidor deixou de reservar sai do bloco', async () => {
    await act(async () => { await ctx.ativarModoOffline(); });
    banco.estado.reservados.delete('0001'); // por exemplo, reserva expirada
    await act(async () => { await ctx.sincronizarOffline(); });
    expect(await emitir()).toBe('0002');
  });
});

describe('botão em Configurações', () => {
  it('liga e desliga o modo offline deste aparelho', async () => {
    render(<RecibosProvider><ModoOfflineAparelho /><Espiao /></RecibosProvider>);
    const botao = screen.getByRole('switch', { name: /sem internet neste aparelho/i });
    expect(screen.getByText(/Ative só no aparelho do balcão/)).toBeInTheDocument();
    fireEvent.click(botao);
    await screen.findByText('Ativado · 50 números reservados para este aparelho.');
    fireEvent.click(botao);
    await screen.findByText(/Ative só no aparelho do balcão/);
    expect(banco.estado.reservados.size).toBe(0);
  });
});
