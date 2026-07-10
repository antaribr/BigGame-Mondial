"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

/**
 * Create the QR Quiz station automatically
 * Run this once from the admin panel or via API
 */
export async function createQRStation(): Promise<{ ok: boolean; code?: string; error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { ok: false, error: "Missing Supabase configuration" };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Check if station already exists
  const { data: existing } = await supabase
    .from("stations")
    .select("code")
    .eq("code", "QRQUIZ")
    .maybeSingle();

  if (existing) {
    return { ok: true, code: existing.code };
  }

  // Create the station
  const { data, error } = await supabase
    .from("stations")
    .insert({
      name: "Find and Scan the QR code",
      description: "Scan the QR code at the station to answer quiz questions",
      code: "QRQUIZ",
      sort_order: 999,
      max_score: 10, // 20 questions x 0.5 pts = 10 max
    })
    .select("code")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin");
  return { ok: true, code: data.code };
}
