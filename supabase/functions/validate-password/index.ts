import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use Web Crypto API for bcrypt-compatible hashing
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltB64 = btoa(String.fromCharCode(...salt));
  const data = encoder.encode(saltB64 + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashB64 = btoa(String.fromCharCode(...hashArray));
  return `$sha256$${saltB64}$${hashB64}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$sha256$")) {
    const parts = stored.split("$");
    // format: $sha256$salt$hash
    const salt = parts[2];
    const expectedHash = parts[3];
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashB64 = btoa(String.fromCharCode(...hashArray));
    return hashB64 === expectedHash;
  }
  // Legacy bcrypt - can't verify in Deno without workers, fallback to plaintext compare
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    // Can't verify bcrypt here, treat as needing re-hash via env fallback
    return false;
  }
  // Plaintext comparison
  return password === stored;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { password, type, action } = await req.json();

    if (!password || !type) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing password or type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTypes = ["access_password", "financial_password", "reports_password"];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const trimmedPassword = password.trim();

    // Handle password update
    if (action === "update") {
      const hashed = await hashPassword(trimmedPassword);
      const { error } = await supabase
        .from("app_settings")
        .update({ value: hashed })
        .eq("key", type);
      return new Response(
        JSON.stringify({ success: !error, error: error?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", type)
      .single();

    const envMap: Record<string, string> = {
      access_password: "VITE_SYSTEM_PASSWORD",
      financial_password: "VITE_FINANCIAL_PASSWORD",
      reports_password: "VITE_REPORTS_PASSWORD",
    };

    let valid = false;

    if (!error && data) {
      const storedValue = data.value?.trim() ?? "";
      if (storedValue && storedValue !== "PLACEHOLDER") {
        valid = await verifyPassword(trimmedPassword, storedValue);
      }
    }

    // Fallback to env var (covers bcrypt legacy + missing DB entries)
    if (!valid) {
      const envVal = Deno.env.get(envMap[type]) ?? "";
      valid = !!envVal && trimmedPassword === envVal;

      // Auto-hash into DB with new format
      if (valid) {
        const hashed = await hashPassword(trimmedPassword);
        await supabase.from("app_settings").upsert({ key: type, value: hashed });
      }
    }

    return new Response(
      JSON.stringify({ valid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
