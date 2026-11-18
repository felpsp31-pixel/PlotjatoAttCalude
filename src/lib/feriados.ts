import { somarDias } from '@/lib/dataLocal';

/**
 * Feriados nacionais e municipais de Belo Horizonte, calculados para qualquer ano.
 *
 * Nacionais (Lei 662/1949, Lei 6.802/1980, Lei 14.759/2023): datas fixas +
 * Sexta-feira da Paixão.
 * Municipais de BH (Lei 1.327/1967, consolidada na Lei 11.397/2022):
 * Corpus Christi, Assunção de Nossa Senhora (15/08) e Imaculada Conceição (08/12).
 * Carnaval não é feriado (é ponto facultativo), mas entra porque quase todo
 * mundo fecha ou muda o horário e o aviso de funcionamento é necessário.
 */

export type Feriado = {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'nacional' | 'municipal' | 'ponto facultativo';
};

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function feriadosDoAno(ano: number): Feriado[] {
  const p = pascoa(ano);
  const fixo = (md: string, nome: string, tipo: Feriado['tipo']): Feriado =>
    ({ data: `${ano}-${md}`, nome, tipo });

  const lista: Feriado[] = [
    fixo('01-01', 'Confraternização Universal', 'nacional'),
    { data: somarDias(p, -48), nome: 'Carnaval', tipo: 'ponto facultativo' },
    { data: somarDias(p, -47), nome: 'Carnaval', tipo: 'ponto facultativo' },
    { data: somarDias(p, -2), nome: 'Sexta-feira da Paixão', tipo: 'nacional' },
    fixo('04-21', 'Tiradentes', 'nacional'),
    fixo('05-01', 'Dia do Trabalho', 'nacional'),
    { data: somarDias(p, 60), nome: 'Corpus Christi', tipo: 'municipal' },
    fixo('08-15', 'Assunção de Nossa Senhora', 'municipal'),
    fixo('09-07', 'Independência do Brasil', 'nacional'),
    fixo('10-12', 'Nossa Senhora Aparecida', 'nacional'),
    fixo('11-02', 'Finados', 'nacional'),
    fixo('11-15', 'Proclamação da República', 'nacional'),
    fixo('11-20', 'Dia da Consciência Negra', 'nacional'),
    fixo('12-08', 'Imaculada Conceição', 'municipal'),
    fixo('12-25', 'Natal', 'nacional'),
  ];
  return lista.sort((x, y) => x.data.localeCompare(y.data));
}

// Dia da semana (0 = domingo) de uma data YYYY-MM-DD, sem passar por fuso.
function diaDaSemana(data: string): number {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * Primeiro dia em que o aviso aparece: 2 dias antes do feriado.
 * Se cair no sábado ou domingo, antecipa para a sexta, senão um feriado
 * na segunda só seria avisado com a loja fechada.
 */
export function inicioDoAviso(feriado: string): string {
  let d = somarDias(feriado, -2);
  const dow = diaDaSemana(d);
  if (dow === 6) d = somarDias(d, -1);
  if (dow === 0) d = somarDias(d, -2);
  return d;
}

/** Feriado que deve ser avisado hoje (do início do aviso até a véspera), ou null. */
export function feriadoParaAvisar(hoje: string): (Feriado & { dias: number }) | null {
  const ano = Number(hoje.slice(0, 4));
  const candidatos = [...feriadosDoAno(ano), ...feriadosDoAno(ano + 1)];
  for (const f of candidatos) {
    if (f.data <= hoje) continue;
    if (inicioDoAviso(f.data) > hoje) return null; // o próximo ainda está longe
    const [a1, m1, d1] = hoje.split('-').map(Number);
    const [a2, m2, d2] = f.data.split('-').map(Number);
    const dias = Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
    return { ...f, dias };
  }
  return null;
}

export function formatarDataFeriado(data: string): string {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC',
  });
}
