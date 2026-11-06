import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Quem pode chamar as funcoes: so o usuario do sistema (criado no painel,
// com app_metadata.papel = "sistema"), que o app recebe ao digitar a senha
// de acesso. Login anonimo e cadastro estao desligados no Supabase.
//
// Devolve null se a chamada for autorizada, ou a Response de erro pronta.
export async function exigirSistema(
  req: Request,
  headers: Record<string, string>,
  opcoes: { aceitarServiceRole?: boolean } = {},
): Promise<Response | null> {
  const negar = () =>
    new Response(JSON.stringify({ error: "Não autorizado. Entre no sistema novamente." }), {
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
  if (error || !data.user) return negar();
  if (data.user.is_anonymous || data.user.app_metadata?.papel !== "sistema") return negar();
  return null;
}
