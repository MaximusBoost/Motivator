import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

let client: SupabaseClient<Database> | undefined;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase не настроен. Добавь VITE_SUPABASE_URL и " +
        "VITE_SUPABASE_PUBLISHABLE_KEY в .env.local.",
    );
  }

  client ??= createClient<Database>(supabaseUrl, supabasePublishableKey);
  return client;
}
