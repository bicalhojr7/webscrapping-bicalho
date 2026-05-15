import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.warn("⚠️ Variáveis SUPABASE_URL ou SUPABASE_KEY não estão definidas!");
}

export const supabase = createClient(
  process.env.SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_KEY || "placeholder_key"
);
