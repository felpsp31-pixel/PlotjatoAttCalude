import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Dois usuarios fixos, criados no painel (cadastro e login anonimo desligados):
// - "sistema": entra com a senha geral; Recibos, Orcamento, Demandas, Clientes.
// - "financeiro": entra com a senha do Financeiro; tudo do sistema + Financeiro.
// O papel vem de app_metadata.papel, que so o servidor consegue gravar.
export type Papel = "sistema" | "financeiro";

// Devolve null se a chamada for autorizada, ou a Response de erro pronta.
export async function exigirSistema(
  req: Request,
  headers: Record<string, string>,
  opcoes: { aceitarServiceRole?: boolean; papel?: Papel } = {},
): Promise<Response | null> {
  const negar = (msg = "Não autorizado. Entre no sistema novamente.") =>
    new Response(JSON.stringify({ error: msg }), {
      status: 401,
      headers: { ...headers, "Content-Type": "application/json" },
    });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return negar();

  // O cron chama com a service_role key.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (opcoes.aceitarServiceRole && serviceKey && token === serviceKey) return null;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user || data.user.is_anonymous) return negar();

  const papel = data.user.app_metadata?.papel;
  const exigido = opcoes.papel ?? "sistema";
  const ok = exigido === "financeiro" ? papel === "financeiro" : papel === "sistema" || papel === "financeiro";
  if (!ok) return negar("Entre no Financeiro com a senha do Financeiro.");
  return null;
}
