import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { exigirSistema } from "../_shared/auth.ts";

// Linha legada de monthly_recibo_summaries.
type Resumo = { id: string; cliente_id: string; cliente_name: string; total: number | string };

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const negado = await exigirSistema(req, corsHeaders, { aceitarServiceRole: true, papel: "financeiro" });
  if (negado) return negado;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Allow optional override: { month: "YYYY-MM" }
    let body: { month?: string } = {};
    try { body = await req.json(); } catch { /* no body */ }

    // O servidor roda em UTC, e Sao Paulo esta 3 horas atras. Agendada para
    // a madrugada do dia 1, a funcao via uma data que no Brasil ainda era o
    // ultimo dia do mes anterior -- e fechava um mes que nao tinha acabado,
    // deixando de fora os recibos emitidos naquela ultima noite. Por isso a
    // data de referencia sai do calendario de Sao Paulo, nao do relogio UTC.
    const hojeBR = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const [anoBR, mesBR] = hojeBR.split("-").map(Number);

    let year: number;
    let mes: number; // 1..12
    if (typeof body?.month === "string" && /^\d{4}-\d{2}$/.test(body.month)) {
      [year, mes] = body.month.split("-").map(Number);
    } else {
      // Mes anterior ao de hoje no Brasil, virando o ano em janeiro.
      year = mesBR === 1 ? anoBR - 1 : anoBR;
      mes = mesBR === 1 ? 12 : mesBR - 1;
    }

    const monthIdx = mes - 1;
    const monthStr = `${year}-${String(mes).padStart(2, "0")}`;
    const firstDay = `${monthStr}-01`;
    // Dia 0 do mes seguinte e o ultimo do mes; em UTC para nao escorregar.
    const ultimo = new Date(Date.UTC(year, mes, 0)).getUTCDate();
    const lastDay = `${monthStr}-${String(ultimo).padStart(2, "0")}`;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const referenceMonth = `${monthNames[monthIdx]}/${year}`;

    // Vencimento no dia 10 do mes seguinte ao de referencia.
    const anoVenc = mes === 12 ? year + 1 : year;
    const mesVenc = mes === 12 ? 1 : mes + 1;
    const dueDate = `${anoVenc}-${String(mesVenc).padStart(2, "0")}-10`;

    // 1) Aggregate receipts directly by client for the target month.
    //    Avulsos (cliente_id NULL) are excluded — they don't generate recurring invoices.
    const { data: recibos, error: recErr } = await supabase
      .from("recibos")
      .select("cliente_id, total, date")
      .gte("date", firstDay)
      .lte("date", lastDay)
      .not("cliente_id", "is", null);

    if (recErr) throw recErr;

    const totalsByClient = new Map<string, number>();
    for (const r of recibos ?? []) {
      const cid = r.cliente_id as string;
      if (!cid) continue;
      const v = Number(r.total) || 0;
      totalsByClient.set(cid, (totalsByClient.get(cid) ?? 0) + v);
    }

    // 2) Resolve client names
    const clientIds = Array.from(totalsByClient.keys());
    const namesById = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientes, error: cliErr } = await supabase
        .from("clientes")
        .select("id, name")
        .in("id", clientIds);
      if (cliErr) throw cliErr;
      for (const c of clientes ?? []) namesById.set(c.id as string, c.name as string);
    }

    // 3) Skip clients that already have an invoice for this reference month (idempotency)
    let alreadyExisting = new Set<string>();
    if (clientIds.length > 0) {
      const { data: existing, error: existErr } = await supabase
        .from("financial_invoices")
        .select("entity_id")
        .eq("entity_type", "client")
        .eq("reference_month", referenceMonth)
        .in("entity_id", clientIds);
      if (existErr) throw existErr;
      alreadyExisting = new Set((existing ?? []).map((e: { entity_id: string }) => e.entity_id));
    }

    const invoicesToInsert = clientIds
      .filter((cid) => !alreadyExisting.has(cid) && (totalsByClient.get(cid) ?? 0) > 0)
      .map((cid) => ({
        entity_id: cid,
        entity_name: namesById.get(cid) ?? "Cliente",
        entity_type: "client",
        description: `Recibos - ${referenceMonth}`,
        value: Number((totalsByClient.get(cid) ?? 0).toFixed(2)),
        due_date: dueDate,
        reference_month: referenceMonth,
        status: "open",
        attachments: [],
      }));

    let insertedCount = 0;
    if (invoicesToInsert.length > 0) {
      const { error: insErr } = await supabase
        .from("financial_invoices")
        .insert(invoicesToInsert);
      if (insErr) throw insErr;
      insertedCount = invoicesToInsert.length;
    }

    // 4) Legacy: also process any pending monthly_recibo_summaries for this month
    const { data: summaries } = await supabase
      .from("monthly_recibo_summaries")
      .select("*")
      .eq("month", monthStr)
      .eq("processed", false);

    let legacyInserted = 0;
    if (summaries && summaries.length > 0) {
      const legacyRows = summaries
        .filter((s: Resumo) => Number(s.total) > 0 && !alreadyExisting.has(s.cliente_id))
        .filter((s: Resumo) => !invoicesToInsert.some((i) => i.entity_id === s.cliente_id))
        .map((s: Resumo) => ({
          entity_id: s.cliente_id,
          entity_name: s.cliente_name,
          entity_type: "client",
          description: `Recibos - ${referenceMonth}`,
          value: Number(s.total),
          due_date: dueDate,
          reference_month: referenceMonth,
          status: "open",
          attachments: [],
        }));
      if (legacyRows.length > 0) {
        const { error: legErr } = await supabase.from("financial_invoices").insert(legacyRows);
        if (legErr) throw legErr;
        legacyInserted = legacyRows.length;
      }
      const ids = summaries.map((s: Resumo) => s.id);
      await supabase.from("monthly_recibo_summaries").update({ processed: true }).in("id", ids);
    }

    return new Response(
      JSON.stringify({
        message: `${insertedCount + legacyInserted} lançamento(s) criado(s) para ${referenceMonth}`,
        month: monthStr,
        referenceMonth,
        firstDay,
        lastDay,
        dueDate,
        clientesAgrupados: clientIds.length,
        inseridos: insertedCount,
        legacyInseridos: legacyInserted,
        jaExistiam: alreadyExisting.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
