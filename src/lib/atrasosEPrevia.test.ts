import { describe, it, expect } from "vitest";
import { calcularAtrasos, corDoResponsavel, SEM_RESPONSAVEL, COR_OUTROS } from "./atrasosDemandas";
import { calcularPrevia, mesCorrenteBR } from "./previaFechamento";

const agora = new Date("2026-11-20T12:00:00-03:00");

describe("calcularAtrasos", () => {
  const nomes = new Map([["r1", "Gabriel"], ["r2", "Felipe"]]);

  it("soma concluidas atrasadas e abertas vencidas por responsavel", () => {
    const r = calcularAtrasos(
      [
        { responsavel_nome: "Gabriel", prazo: "2026-11-10T12:00:00Z", concluido_at: "2026-11-11T12:00:00Z", atrasada: true },
        { responsavel_nome: "Felipe", prazo: "2026-11-10T12:00:00Z", concluido_at: "2026-11-09T12:00:00Z", atrasada: false },
        // fora da janela de 30 dias
        { responsavel_nome: "Felipe", prazo: "2026-09-01T12:00:00Z", concluido_at: "2026-09-05T12:00:00Z", atrasada: true },
      ],
      [
        { responsavel_id: "r2", prazo: "2026-11-19T12:00:00Z", status: "pendente" },
        { responsavel_id: "r2", prazo: "2026-11-25T12:00:00Z", status: "pendente" }, // ainda no prazo
        { responsavel_id: null, prazo: "2026-11-18T12:00:00Z", status: "em_andamento" },
        { responsavel_id: "r1", prazo: "2026-11-01T12:00:00Z", status: "concluido" }, // ignorada aqui
      ],
      nomes,
      agora,
    );
    expect(r.total).toBe(3);
    expect(r.concluidasComAtraso).toBe(1);
    expect(r.abertasAtrasadas).toBe(2);
    expect(r.concluidasNoPeriodo).toBe(2);
    expect(r.fatias.map((f) => f.nome)).toEqual(["Felipe", "Gabriel", SEM_RESPONSAVEL]);
    expect(Math.round(r.fatias[0].percentual)).toBe(33);
  });

  it("cor segue o responsavel, nao o ranking", () => {
    const todos = ["Felipe", "Gabriel"];
    expect(corDoResponsavel("Gabriel", todos)).toBe(corDoResponsavel("Gabriel", todos));
    expect(corDoResponsavel("Felipe", todos)).not.toBe(corDoResponsavel("Gabriel", todos));
    expect(corDoResponsavel(SEM_RESPONSAVEL, todos)).toBe(COR_OUTROS);
  });
});

describe("calcularPrevia", () => {
  it("agrupa por cliente e separa avulsos", () => {
    const p = calcularPrevia(
      [
        { cliente_id: "c1", cliente_avulso: null, total: 100 },
        { cliente_id: "c1", cliente_avulso: null, total: 50 },
        { cliente_id: "c2", cliente_avulso: null, total: 300 },
        { cliente_id: null, cliente_avulso: "João", total: 40 },
      ],
      new Map([["c1", "A"], ["c2", "B"]]),
    );
    expect(p.clientes.map((c) => [c.nome, c.recibos, c.total])).toEqual([["B", 1, 300], ["A", 2, 150]]);
    expect(p.totalClientes).toBe(450);
    expect(p.avulsos).toEqual([{ nome: "João", recibos: 1, total: 40 }]);
  });

  it("usa o mes de Brasilia na virada", () => {
    // 01/12 01:00 UTC ainda e 30/11 no Brasil
    expect(mesCorrenteBR(new Date("2026-12-01T01:00:00Z"))).toEqual({
      inicio: "2026-11-01",
      fim: "2026-11-30",
      rotulo: "Nov/2026",
    });
  });
});
