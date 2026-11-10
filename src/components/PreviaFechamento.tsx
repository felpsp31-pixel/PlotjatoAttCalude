import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calcularPrevia, mesCorrenteBR, type Previa } from "@/lib/previaFechamento";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PreviaFechamento = () => {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const mes = mesCorrenteBR();

  useEffect(() => {
    (async () => {
      try {
        const [{ data: recibos, error: rErr }, { data: clientes, error: cErr }] = await Promise.all([
          supabase
            .from("recibos")
            .select("cliente_id, cliente_avulso, total, is_pago")
            .gte("date", mes.inicio)
            .lte("date", mes.fim),
          supabase.from("clientes").select("id, name"),
        ]);
        if (rErr) throw rErr;
        if (cErr) throw cErr;
        const nomes = new Map((clientes ?? []).map((c) => [c.id, c.name]));
        setPrevia(calcularPrevia((recibos ?? []).map((r) => ({ ...r, total: Number(r.total) })), nomes));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar a prévia.");
      }
    })();
  }, [mes.inicio, mes.fim]);

  if (erro) return <p className="text-sm text-destructive">{erro}</p>;
  if (!previa)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Acumulado de {mes.rotulo} até agora. No dia 1º, cada cliente abaixo vira um lançamento em aberto com
        vencimento no dia 10; o que já foi pago no ato entra direto em Recebido.
      </p>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs text-muted-foreground">Total a faturar</p>
        <p className="text-2xl font-semibold">{brl(previa.totalClientes)}</p>
        <p className="text-xs text-muted-foreground">
          {previa.clientes.length} cliente(s) · {brl(previa.totalPago)} já pago · {brl(previa.totalClientes - previa.totalPago)} em aberto
        </p>
      </div>

      {previa.clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum recibo de cliente cadastrado neste mês ainda.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Cliente</th>
              <th className="py-2 text-right font-medium">Recibos</th>
              <th className="py-2 text-right font-medium">Já pago</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {previa.clientes.map((c) => (
              <tr key={c.clienteId} className="border-b last:border-0">
                <td className="py-2">{c.nome}</td>
                <td className="py-2 text-right tabular-nums">{c.recibos}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">{c.pago ? brl(c.pago) : '—'}</td>
                <td className="py-2 text-right tabular-nums">{brl(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {previa.avulsos.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            Avulsos — não entram no fechamento ({brl(previa.totalAvulsos)})
          </p>
          <p className="text-xs text-muted-foreground">
            Se algum destes é cliente recorrente, cadastre-o e corrija os recibos antes do dia 1º.
          </p>
          <ul className="text-sm space-y-1">
            {previa.avulsos.map((a) => (
              <li key={a.nome} className="flex justify-between">
                <span>{a.nome} <span className="text-muted-foreground">({a.recibos})</span></span>
                <span className="tabular-nums">{brl(a.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PreviaFechamento;
