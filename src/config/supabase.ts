import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

if (!env.SUPABASE_URL || (!env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_KEY)) {
  console.warn("⚠️ Variáveis do Supabase (URL e Service Role Key) não estão definidas!");
}

export const supabase = createClient(
  env.SUPABASE_URL || "https://placeholder.supabase.co",
  env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || "placeholder_key"
);
