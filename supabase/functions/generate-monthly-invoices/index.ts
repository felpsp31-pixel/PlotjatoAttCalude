import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Allow optional override: { month: "YYYY-MM" }
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    const now = new Date();
    let target: Date;
    if (typeof body?.month === "string" && /^\d{4}-\d{2}$/.test(body.month)) {
      const [y, m] = body.month.split("-").map(Number);
      target = new Date(y, m - 1, 1);
    } else {
      // previous month relative to now
      target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }

    const year = target.getFullYear();
    const monthIdx = target.getMonth();
    const monthStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    const firstDay = `${monthStr}-01`;
    const lastDayDate = new Date(year, monthIdx + 1, 0);
    const lastDay = `${monthStr}-${String(lastDayDate.getDate()).padStart(2, "0")}`;

    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const referenceMonth = `${monthNames[monthIdx]}/${year}`;

    // Due date: 10th of the month AFTER the reference month
    const dueMonth = new Date(year, monthIdx + 1, 10);
    const dueDate = `${dueMonth.getFullYear()}-${String(dueMonth.getMonth() + 1).padStart(2, "0")}-10`;

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
      alreadyExisting = new Set((existing ?? []).map((e: any) => e.entity_id as string));
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
        .filter((s: any) => Number(s.total) > 0 && !alreadyExisting.has(s.cliente_id))
        .filter((s: any) => !invoicesToInsert.some((i) => i.entity_id === s.cliente_id))
        .map((s: any) => ({
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
      const ids = summaries.map((s: any) => s.id);
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
