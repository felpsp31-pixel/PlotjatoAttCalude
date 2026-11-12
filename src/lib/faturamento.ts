// Quanto foi faturado (soma dos recibos emitidos) num dia, semana ou mês.
// Datas em YYYY-MM-DD, como ficam nos recibos, sem passar por fuso horário.
import { somarDias } from '@/lib/dataLocal';

export type TipoPeriodo = 'dia' | 'semana' | 'mes';

export interface Periodo {
  tipo: TipoPeriodo;
  inicio: string;
  fim: string;
  rotulo: string;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const diaDaSemana = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay(); // 0 = domingo

/** Dia, semana (segunda a domingo) ou mês que contém a data de referência. */
export function periodo(tipo: TipoPeriodo, ref: string): Periodo {
  if (tipo === 'dia') {
    return { tipo, inicio: ref, fim: ref, rotulo: `${DIAS_SEMANA[diaDaSemana(ref)]}, ${dm(ref)}` };
  }
  if (tipo === 'semana') {
    const voltar = (diaDaSemana(ref) + 6) % 7; // segunda = 0
    const inicio = somarDias(ref, -voltar);
    const fim = somarDias(inicio, 6);
    return { tipo, inicio, fim, rotulo: `${dm(inicio)} a ${dm(fim)}` };
  }
  const [a, m] = ref.split('-').map(Number);
  const inicio = `${ref.slice(0, 7)}-01`;
  const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10); // último dia do mês
  return { tipo, inicio, fim, rotulo: `${MESES[m - 1]} de ${a}` };
}

export interface Faturamento {
  total: number;
  quantidade: number;
  /** Recibos já pagos (entram em Recebido no Financeiro). */
  pago: number;
  /** Recibos faturados ainda não pagos. */
  aReceber: number;
}

export function faturamentoNoPeriodo(
  recibos: ReadonlyArray<{ date: string; total: number; isPago?: boolean }>,
  p: Pick<Periodo, 'inicio' | 'fim'>,
): Faturamento {
  const out: Faturamento = { total: 0, quantidade: 0, pago: 0, aReceber: 0 };
  for (const r of recibos) {
    if (!r.date || r.date < p.inicio || r.date > p.fim) continue;
    out.total += r.total;
    out.quantidade++;
    if (r.isPago) out.pago += r.total;
    else out.aReceber += r.total;
  }
  return out;
}
