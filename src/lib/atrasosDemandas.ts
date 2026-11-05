// Atrasos em demandas nos últimos 30 dias, por responsável.
// Conta dois casos: concluída depois do prazo (do histórico demandas_concluidas,
// que sobrevive à limpeza de 48h) e em aberto com o prazo já vencido.

export interface ConcluidaHist {
  responsavel_nome: string | null;
  prazo: string | null;
  concluido_at: string;
  atrasada: boolean | null;
}

export interface DemandaAberta {
  responsavel_id: string | null;
  prazo: string | null;
  status: string;
}

export interface FatiaAtraso {
  nome: string;
  concluidasComAtraso: number;
  abertasAtrasadas: number;
  total: number;
  percentual: number; // 0-100
}

export interface ResumoAtrasos {
  total: number;
  concluidasComAtraso: number;
  abertasAtrasadas: number;
  concluidasNoPeriodo: number;
  fatias: FatiaAtraso[]; // em ordem alfabética, "Sem responsável" por último
}

export const SEM_RESPONSAVEL = "Sem responsável";
const DIA = 24 * 60 * 60 * 1000;

export function calcularAtrasos(
  concluidas: ConcluidaHist[],
  abertas: DemandaAberta[],
  nomesResponsaveis: Map<string, string>,
  agora = new Date(),
  dias = 30,
): ResumoAtrasos {
  const inicio = agora.getTime() - dias * DIA;
  const fim = agora.getTime();
  const porNome = new Map<string, { c: number; a: number }>();
  const soma = (nome: string, campo: "c" | "a") => {
    const v = porNome.get(nome) ?? { c: 0, a: 0 };
    v[campo] += 1;
    porNome.set(nome, v);
  };

  let concluidasNoPeriodo = 0;
  for (const d of concluidas) {
    const t = new Date(d.concluido_at).getTime();
    if (t < inicio || t > fim) continue;
    concluidasNoPeriodo += 1;
    if (d.atrasada) soma(d.responsavel_nome?.trim() || SEM_RESPONSAVEL, "c");
  }

  for (const d of abertas) {
    if (d.status === "concluido" || !d.prazo) continue;
    const p = new Date(d.prazo).getTime();
    // Venceu dentro da janela; prazos mais antigos ainda em aberto também
    // contam, porque continuam atrasados hoje.
    if (p >= fim) continue;
    const nome = (d.responsavel_id && nomesResponsaveis.get(d.responsavel_id)) || SEM_RESPONSAVEL;
    soma(nome, "a");
  }

  const total = [...porNome.values()].reduce((s, v) => s + v.c + v.a, 0);
  const fatias = [...porNome.entries()]
    .map(([nome, v]) => ({
      nome,
      concluidasComAtraso: v.c,
      abertasAtrasadas: v.a,
      total: v.c + v.a,
      percentual: total ? ((v.c + v.a) / total) * 100 : 0,
    }))
    .sort((x, y) =>
      x.nome === SEM_RESPONSAVEL ? 1 : y.nome === SEM_RESPONSAVEL ? -1 : x.nome.localeCompare(y.nome, "pt-BR"),
    );

  return {
    total,
    concluidasComAtraso: fatias.reduce((s, f) => s + f.concluidasComAtraso, 0),
    abertasAtrasadas: fatias.reduce((s, f) => s + f.abertasAtrasadas, 0),
    concluidasNoPeriodo,
    fatias,
  };
}

// Paleta categórica validada, em ordem fixa. A cor segue o responsável (pela
// posição na lista alfabética de todos os responsáveis), não o ranking.
const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
export const COR_OUTROS = "#8a8a85";

export function corDoResponsavel(nome: string, todosOrdenados: string[]): string {
  if (nome === SEM_RESPONSAVEL) return COR_OUTROS;
  const i = todosOrdenados.indexOf(nome);
  return i >= 0 && i < PALETA.length ? PALETA[i] : COR_OUTROS;
}
