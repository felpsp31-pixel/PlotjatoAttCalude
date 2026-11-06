import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// bcryptjs e JavaScript puro (sem WASM nem binario nativo), entao roda no
// Edge Runtime. A lib bcrypt do deno.land nao verifica hash neste ambiente.
import bcrypt from "npm:bcryptjs@3.0.3";
import { exigirSistema } from "../_shared/auth.ts";

// Esta funcao e a unica porta de entrada do sistema:
// - senha de acesso certa -> devolve uma sessao do usuario "sistema", que e o
//   unico que o banco (RLS) deixa ler e gravar;
// - senhas do Financeiro e de Relatorios -> so conferem, e exigem ja estar
//   logado no sistema;
// - trocar senha -> exige estar logado e informar a senha atual.
// Erros seguidos de um mesmo IP sao bloqueados por 15 minutos.

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TIPOS = ["access_password", "financial_password", "reports_password"];
const MAX_ERROS = 8;
const JANELA_MIN = 15;

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$sha256$")) {
    const [, , salt, expected] = stored.split("$");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + password));
    return btoa(String.fromCharCode(...new Uint8Array(digest))) === expected;
  }
  if (/^\$2[aby]\$/.test(stored)) {
    try {
      return await bcrypt.compare(password, stored);
    } catch (e) {
      console.error("bcrypt compare falhou:", e);
      return false;
    }
  }
  return password === stored;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { password, type, action, currentPassword } = await req.json();
    if (!password || !type || !TIPOS.includes(type)) {
      return json({ valid: false, error: "Senha ou tipo ausente." }, 400);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";

    // Limite de tentativas por IP.
    const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
    const { count } = await admin
      .from("tentativas_senha")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("criado_em", desde);
    if ((count ?? 0) >= MAX_ERROS) {
      return json({ valid: false, error: `Muitas tentativas. Aguarde ${JANELA_MIN} minutos.` }, 429);
    }

    // Senhas do Financeiro/Relatorios e troca de senha: so para quem ja entrou.
    if (type !== "access_password" || action === "update") {
      const negado = await exigirSistema(req, corsHeaders);
      if (negado) return negado;
    }

    const conferir = async (tipo: string, senha: string) => {
      const { data } = await admin.from("app_settings").select("value").eq("key", tipo).maybeSingle();
      const guardada = (data?.value ?? "").trim();
      let ok = !!guardada && guardada !== "PLACEHOLDER" && (await verifyPassword(senha, guardada));
      if (ok && !guardada.startsWith("$2")) {
        // Formato antigo: regrava em bcrypt.
        await admin.from("app_settings").update({ value: await hashPassword(senha) }).eq("key", tipo);
      }
      if (!ok && !guardada) {
        // Banco sem senha cadastrada: aceita a do secret e grava o hash.
        const envMap: Record<string, string> = {
          access_password: "VITE_SYSTEM_PASSWORD",
          financial_password: "VITE_FINANCIAL_PASSWORD",
          reports_password: "VITE_REPORTS_PASSWORD",
        };
        const env = Deno.env.get(envMap[tipo]) ?? "";
        ok = !!env && senha === env;
        if (ok) await admin.from("app_settings").upsert({ key: tipo, value: await hashPassword(senha) });
      }
      return ok;
    };

    const registrarErro = () => admin.from("tentativas_senha").insert({ ip });

    if (action === "update") {
      if (!currentPassword || !(await conferir(type, String(currentPassword).trim()))) {
        await registrarErro();
        return json({ success: false, error: "Senha atual incorreta." }, 403);
      }
      const nova = String(password).trim();
      if (nova.length < 8) return json({ success: false, error: "A nova senha precisa ter ao menos 8 caracteres." }, 400);
      const { error } = await admin.from("app_settings").update({ value: await hashPassword(nova) }).eq("key", type);
      return json({ success: !error, error: error?.message });
    }

    const valid = await conferir(type, String(password).trim());
    if (!valid) {
      await registrarErro();
      return json({ valid: false });
    }

    if (type !== "access_password") return json({ valid: true });

    // Senha de acesso certa: entra como o usuario do sistema e devolve a sessao.
    const publico = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
    });
    const { data: login, error: loginErr } = await publico.auth.signInWithPassword({
      email: Deno.env.get("SISTEMA_EMAIL")!,
      password: Deno.env.get("SISTEMA_SENHA")!,
    });
    if (loginErr || !login.session) {
      console.error("login do usuario sistema falhou:", loginErr);
      return json({ valid: false, error: "Falha ao abrir a sessão." }, 500);
    }
    return json({
      valid: true,
      session: { access_token: login.session.access_token, refresh_token: login.session.refresh_token },
    });
  } catch (err) {
    console.error(err);
    return json({ valid: false, error: "Erro interno." }, 500);
  }
});
