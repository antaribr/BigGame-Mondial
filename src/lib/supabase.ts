import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dymiiwnnhvgjoipyhrag.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5bWlpd25uaHZnam9pcHlocmFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MzE2OTUsImV4cCI6MjA5OTEwNzY5NX0.p6v5zxpTQ64YWyo_0oPDBdoIAlE13lahPmpdJgxczhE";

/**
 * Browser/anon Supabase client used across the whole app.
 * We fall back to placeholder values so the client never throws at import time
 * (e.g. during build before env vars exist). Once NEXT_PUBLIC_* are set, the
 * real project is used and everything works.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
