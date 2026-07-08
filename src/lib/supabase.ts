import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "public-anon-key";

/**
 * Browser/anon Supabase client used across the whole app.
 * We fall back to placeholder values so the client never throws at import time
 * (e.g. during build before env vars exist). Once NEXT_PUBLIC_* are set, the
 * real project is used and everything works.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
