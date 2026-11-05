// Prévia do fechamento: quanto cada cliente acumulou no mês corrente, pela
// mesma regra da função generate-monthly-invoices (avulsos não entram).

export interface ReciboPrevia {
  cliente_id: string | null;
  cliente_avulso: string | null;
  total: number;
}

export interface LinhaPrevia {
  clienteId: string;
  nome: string;
  recibos: number;
  total: number;
}

export interface Previa {
  clientes: LinhaPrevia[];
  totalClientes: number;
  avulsos: { nome: string; recibos: number; total: number }[];
  totalAvulsos: number;
}

export function calcularPrevia(recibos: ReciboPrevia[], nomes: Map<string, string>): Previa {
  const porCliente = new Map<string, LinhaPrevia>();
  const porAvulso = new Map<string, { nome: string; recibos: number; total: number }>();

  for (const r of recibos) {
    const v = Number(r.total) || 0;
    if (r.cliente_id) {
      const l = porCliente.get(r.cliente_id) ?? {
        clienteId: r.cliente_id,
        nome: nomes.get(r.cliente_id) ?? "Cliente",
        recibos: 0,
        total: 0,
      };
      l.recibos += 1;
      l.total += v;
      porCliente.set(r.cliente_id, l);
    } else {
      const nome = (r.cliente_avulso ?? "").trim() || "Sem nome";
      const a = porAvulso.get(nome) ?? { nome, recibos: 0, total: 0 };
      a.recibos += 1;
      a.total += v;
      porAvulso.set(nome, a);
    }
  }

  const clientes = [...porCliente.values()].sort((a, b) => b.total - a.total);
  const avulsos = [...porAvulso.values()].sort((a, b) => b.total - a.total);
  return {
    clientes,
    totalClientes: clientes.reduce((s, c) => s + c.total, 0),
    avulsos,
    totalAvulsos: avulsos.reduce((s, a) => s + a.total, 0),
  };
}

// Mês corrente no horário de Brasília, como faz o cron.
export function mesCorrenteBR(agora = new Date()): { inicio: string; fim: string; rotulo: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(agora);
  const ano = Number(partes.find((p) => p.type === "year")!.value);
  const mes = Number(partes.find((p) => p.type === "month")!.value);
  const mm = String(mes).padStart(2, "0");
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${ultimo}`, rotulo: `${meses[mes - 1]}/${ano}` };
}
