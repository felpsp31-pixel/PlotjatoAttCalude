// Monta os dados que se digitam no Emissor Nacional da NFS-e a partir do
// fechamento mensal de um cliente. Funcao pura: sem Supabase, para testar.

export interface LinhaRecibo {
  serviceCode?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReciboDoMes {
  number: string;
  date: string; // YYYY-MM-DD
  total: number;
  lines: LinhaRecibo[];
}

export interface DadosNfse {
  tomadorNome: string;
  tomadorDocumento: string; // so digitos
  tomadorEmail: string;
  valor: string; // "1.234,56"
  discriminacao: string;
  textoCompleto: string;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function montarDadosNfse(
  cliente: { name: string; cnpj?: string | null; email?: string | null },
  referenceMonth: string,
  valorLancamento: number,
  recibos: ReciboDoMes[],
): DadosNfse {
  // Agrupa servicos iguais de recibos diferentes numa linha so.
  const porServico = new Map<string, { qtd: number; total: number }>();
  for (const r of recibos) {
    for (const l of r.lines ?? []) {
      const nome = (l.description || "Serviço").trim();
      const atual = porServico.get(nome) ?? { qtd: 0, total: 0 };
      atual.qtd += Number(l.quantity) || 0;
      atual.total += Number(l.total) || 0;
      porServico.set(nome, atual);
    }
  }

  const numeros = [...recibos]
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
    .map((r) => r.number);

  const linhas: string[] = [`Serviços prestados em ${referenceMonth}:`];
  for (const [nome, { qtd, total }] of porServico) {
    linhas.push(`- ${nome}: ${qtd.toLocaleString("pt-BR")} un. - R$ ${brl(total)}`);
  }
  if (numeros.length) {
    linhas.push(`Referente aos recibos nº ${numeros.join(", ")}.`);
  }
  linhas.push(`Valor total: R$ ${brl(valorLancamento)}`);

  const discriminacao = linhas.join("\n");
  const doc = (cliente.cnpj ?? "").replace(/\D/g, "");
  const valor = brl(valorLancamento);

  const textoCompleto = [
    `Tomador: ${cliente.name}`,
    `CPF/CNPJ: ${doc || "(não cadastrado)"}`,
    cliente.email ? `E-mail: ${cliente.email}` : null,
    `Valor do serviço: R$ ${valor}`,
    "",
    "Discriminação:",
    discriminacao,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return {
    tomadorNome: cliente.name,
    tomadorDocumento: doc,
    tomadorEmail: cliente.email ?? "",
    valor,
    discriminacao,
    textoCompleto,
  };
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// "Out/2026" -> { inicio: "2026-10-01", fim: "2026-10-31" }
export function intervaloDoMes(referenceMonth: string): { inicio: string; fim: string } | null {
  const m = /^(\w{3})\/(\d{4})$/.exec(referenceMonth.trim());
  if (!m) return null;
  const idx = MESES.indexOf(m[1]);
  if (idx < 0) return null;
  const ano = Number(m[2]);
  const mm = String(idx + 1).padStart(2, "0");
  const ultimo = new Date(Date.UTC(ano, idx + 1, 0)).getUTCDate();
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimo).padStart(2, "0")}` };
}
