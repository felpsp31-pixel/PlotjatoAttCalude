import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  calcularAtrasos,
  corDoResponsavel,
  type ConcluidaHist,
  type DemandaAberta,
  type ResumoAtrasos,
} from "@/lib/atrasosDemandas";

interface Props {
  demandas: DemandaAberta[];
  responsaveis: { id: string; name: string }[];
}

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

const AtrasosDemandas = ({ demandas, responsaveis }: Props) => {
  const [historico, setHistorico] = useState<ConcluidaHist[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("demandas_concluidas")
      .select("responsavel_nome, prazo, concluido_at, atrasada")
      .gte("concluido_at", desde)
      .then(({ data, error }) => {
        if (error) setErro(error.message);
        else setHistorico(data ?? []);
      });
  }, []);

  const resumo: ResumoAtrasos | null = useMemo(() => {
    if (!historico) return null;
    const nomes = new Map(responsaveis.map((r) => [r.id, r.name]));
    return calcularAtrasos(historico, demandas, nomes);
  }, [historico, demandas, responsaveis]);

  // Ordem fixa de todos os responsáveis: a cor de cada um não muda
  // quando outro entra ou sai do gráfico.
  const ordemCores = useMemo(() => {
    const nomes = new Set(responsaveis.map((r) => r.name));
    resumo?.fatias.forEach((f) => nomes.add(f.nome));
    return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [responsaveis, resumo]);

  if (erro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!resumo)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  const taxa =
    resumo.concluidasNoPeriodo > 0 ? (resumo.concluidasComAtraso / resumo.concluidasNoPeriodo) * 100 : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Atrasos (30 dias)</p>
          <p className="text-2xl font-semibold tabular-nums">{resumo.total}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Concluídas fora do prazo</p>
          <p className="text-2xl font-semibold tabular-nums">{resumo.concluidasComAtraso}</p>
          {taxa !== null && (
            <p className="text-xs text-muted-foreground">
              {pct(taxa)} de {resumo.concluidasNoPeriodo} concluídas
            </p>
          )}
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Em aberto atrasadas</p>
          <p className="text-2xl font-semibold tabular-nums">{resumo.abertasAtrasadas}</p>
        </div>
      </div>

      {resumo.total === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum atraso nos últimos 30 dias.</p>
      ) : (
        <>
          <p className="text-sm font-medium">Atrasos por responsável</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={resumo.fatias}
                  dataKey="total"
                  nameKey="nome"
                  innerRadius="45%"
                  outerRadius="85%"
                  paddingAngle={resumo.fatias.length > 1 ? 1 : 0}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {resumo.fatias.map((f) => (
                    <Cell key={f.nome} fill={corDoResponsavel(f.nome, ordemCores)} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number, nome: string) => [`${v} (${pct((v / resumo.total) * 100)})`, nome]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Responsável</th>
                <th className="py-2 text-right font-medium">Concluídas</th>
                <th className="py-2 text-right font-medium">Em aberto</th>
                <th className="py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {resumo.fatias.map((f) => (
                <tr key={f.nome} className="border-b last:border-0">
                  <td className="py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: corDoResponsavel(f.nome, ordemCores) }}
                      />
                      {f.nome}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{f.concluidasComAtraso}</td>
                  <td className="py-2 text-right tabular-nums">{f.abertasAtrasadas}</td>
                  <td className="py-2 text-right tabular-nums font-medium">{pct(f.percentual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            Conta demandas concluídas depois do prazo nos últimos 30 dias e as que estão em aberto com o
            prazo vencido. O histórico começou a ser gravado em 05/11/2026.
          </p>
        </>
      )}
    </div>
  );
};

export default AtrasosDemandas;
