import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cleanup-secret',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("x-cleanup-secret");
  const expectedSecret = Deno.env.get("CLEANUP_SECRET");

  if (!authHeader || !expectedSecret || authHeader !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from("demandas")
    .delete()
    .eq("status", "concluido")
    .lt("concluido_at", cutoff);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ deleted: count ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
