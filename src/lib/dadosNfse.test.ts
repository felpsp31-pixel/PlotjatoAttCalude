import { describe, it, expect } from "vitest";
import { montarDadosNfse, intervaloDoMes } from "./dadosNfse";

describe("montarDadosNfse", () => {
  it("agrupa servicos e lista os recibos em ordem", () => {
    const d = montarDadosNfse(
      { name: "Construtora X", cnpj: "12.345.678/0001-90", email: "a@x.com" },
      "Nov/2026",
      350,
      [
        { number: "0012", date: "2026-11-20", total: 150, lines: [{ description: "Plotagem A1", quantity: 3, unitPrice: 50, total: 150 }] },
        { number: "0008", date: "2026-11-10", total: 200, lines: [{ description: "Plotagem A1", quantity: 2, unitPrice: 50, total: 100 }, { description: "Placa de obra", quantity: 1, unitPrice: 100, total: 100 }] },
      ],
    );
    expect(d.tomadorDocumento).toBe("12345678000190");
    expect(d.valor).toBe("350,00");
    expect(d.discriminacao).toContain("- Plotagem A1: 5 un. - R$ 250,00");
    expect(d.discriminacao).toContain("- Placa de obra: 1 un. - R$ 100,00");
    expect(d.discriminacao).toContain("recibos nº 0008, 0012.");
    expect(d.textoCompleto).toContain("E-mail: a@x.com");
  });

  it("avisa quando o cliente nao tem documento", () => {
    const d = montarDadosNfse({ name: "Fulano" }, "Nov/2026", 10, []);
    expect(d.textoCompleto).toContain("(não cadastrado)");
  });
});

describe("intervaloDoMes", () => {
  it("converte o mes de referencia", () => {
    expect(intervaloDoMes("Fev/2028")).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
    expect(intervaloDoMes("xyz")).toBeNull();
  });
});
