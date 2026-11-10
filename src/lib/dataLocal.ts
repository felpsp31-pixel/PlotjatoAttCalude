// Data de hoje (YYYY-MM-DD) no horario de Brasilia. new Date().toISOString()
// devolve a data em UTC, que depois das 21h ja e o dia seguinte.
export function hojeBR(agora = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora);
}

// Soma dias a uma data YYYY-MM-DD, sem passar por fuso.
export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
