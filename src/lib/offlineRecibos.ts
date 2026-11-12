import type { Recibo } from '@/types/recibos';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

// Emissão de recibo sem internet.
//
// Enquanto há internet, o aparelho reserva um bloco de números no servidor
// (o contador de lá já pula esses números, então nenhum outro aparelho os
// recebe). Sem internet, cada recibo usa o próximo número do bloco e vai
// para uma fila guardada no aparelho. Ao reconectar, a fila sobe sozinha.
// Cada recibo leva a sua identidade (id) desde a emissão, então reenviar o
// mesmo recibo não cria uma segunda cópia no banco.

export const TAMANHO_BLOCO = 50;
/** Abaixo disso, com internet, o aparelho reserva mais um bloco. */
export const REPOR_ABAIXO_DE = 15;

const CHAVE_NUMEROS = 'plotjato:numerosOffline';
const CHAVE_FILA = 'plotjato:filaRecibos';
const CHAVE_CADASTROS = 'plotjato:cadastrosOffline';

export interface ReciboPendente {
  recibo: Recibo;
  criadoEm: string;
  /** Recusado pelo banco por outro motivo que não a falta de internet. */
  erro?: string;
}

/** Cópia crua das tabelas usadas na emissão, para abrir sem internet. */
export interface CadastrosOffline {
  empresa: Tables<'empresa_info'> | null;
  clientes: Tables<'clientes'>[];
  solicitantes: Tables<'solicitantes'>[];
  obras: Tables<'obras'>[];
  servicos: Tables<'servicos'>[];
  clientServices: Tables<'client_services'>[];
}

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  localStorage.setItem(chave, JSON.stringify(valor));
}

// ---------- Bloco de números ----------

export function numerosDisponiveis(): string[] {
  const n = ler<unknown>(CHAVE_NUMEROS, []);
  return Array.isArray(n) ? n.filter((x): x is string => typeof x === 'string') : [];
}

export function guardarNumeros(novos: string[]) {
  const atuais = numerosDisponiveis();
  const vistos = new Set(atuais);
  gravar(CHAVE_NUMEROS, [...atuais, ...novos.filter(n => !vistos.has(n))]);
}

/** Tira o próximo número do bloco; null se acabou. */
export function tirarNumero(): string | null {
  const [primeiro, ...resto] = numerosDisponiveis();
  if (!primeiro) return null;
  gravar(CHAVE_NUMEROS, resto);
  return primeiro;
}

// ---------- Fila de recibos ----------

export function lerFila(): ReciboPendente[] {
  const f = ler<unknown>(CHAVE_FILA, []);
  return Array.isArray(f) ? (f as ReciboPendente[]).filter(p => p?.recibo?.id && p.recibo.number) : [];
}

export function porNaFila(recibo: Recibo) {
  const fila = lerFila().filter(p => p.recibo.id !== recibo.id);
  gravar(CHAVE_FILA, [...fila, { recibo, criadoEm: new Date().toISOString() }]);
}

export function tirarDaFila(id: string) {
  gravar(CHAVE_FILA, lerFila().filter(p => p.recibo.id !== id));
}

export function marcarErro(id: string, erro: string) {
  gravar(CHAVE_FILA, lerFila().map(p => (p.recibo.id === id ? { ...p, erro } : p)));
}

// ---------- Cópia dos cadastros ----------

export function salvarCadastros(c: CadastrosOffline) {
  try {
    gravar(CHAVE_CADASTROS, c);
  } catch {
    // Aparelho sem espaço: a emissão online segue funcionando, só não haverá cópia.
  }
}

export function lerCadastros(): CadastrosOffline | null {
  const c = ler<CadastrosOffline | null>(CHAVE_CADASTROS, null);
  return c && Array.isArray(c.clientes) && Array.isArray(c.servicos) ? c : null;
}

// ---------- Utilitários ----------

/** Erro de rede (sem internet), e não uma recusa do banco. */
export function semInternet(erro?: { message?: string } | null): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = erro?.message ?? '';
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(msg);
}

/**
 * Executa com exclusividade entre as abas abertas do mesmo navegador, para
 * duas abas não tirarem o mesmo número nem enviarem a fila ao mesmo tempo.
 */
export async function comTrava<T>(nome: string, fn: () => Promise<T> | T): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks?.request) return locks.request(nome, async () => fn());
  return fn();
}

/** Linha da tabela recibos, igual para o envio online e para a fila. */
export function linhaDoRecibo(r: Recibo): TablesInsert<'recibos'> {
  return {
    id: r.id,
    number: r.number,
    date: r.date,
    cliente_id: r.clienteId || null,
    cliente_avulso: r.clienteAvulso || null,
    cliente_avulso_telefone: r.clienteAvulsoTelefone || null,
    cliente_avulso_documento: r.clienteAvulsoDocumento || null,
    solicitante_id: r.solicitanteId || null,
    obra_id: r.obraId || null,
    obra_avulsa: r.obraId ? null : r.obraAvulsa || null,
    lines: JSON.parse(JSON.stringify(r.lines)),
    total: r.total,
    is_pago: !!r.isPago,
    forma_pagamento: r.isPago || r.valorSinal ? r.formaPagamento ?? null : null,
    valor_sinal: r.isPago ? null : r.valorSinal ?? null,
  };
}
