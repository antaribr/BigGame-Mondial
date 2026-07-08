"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const ADMIN_COOKIE = "bg_admin";

type Result = { ok: boolean; error?: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  return createClient(url, key, { auth: { persistSession: false } });
}

function genCode(len = 5) {
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(len));
  let s = "";
  for (let i = 0; i < len; i++) s += A[bytes[i] % A.length];
  return s;
}

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return c.get(ADMIN_COOKIE)?.value === "1";
}

export async function loginAdmin(code: string): Promise<Result> {
  const expected = process.env.ADMIN_CODE;
  if (!expected)
    return { ok: false, error: "Admin not configured (set ADMIN_CODE)." };
  if (code.trim().toUpperCase() !== expected.trim().toUpperCase())
    return { ok: false, error: "Wrong admin code." };

  const c = await cookies();
  c.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return { ok: true };
}

export async function logoutAdmin(): Promise<void> {
  const c = await cookies();
  c.delete(ADMIN_COOKIE);
}

export async function createStation(input: {
  name: string;
  description?: string;
  code?: string;
  sort_order?: number;
}): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };
  try {
    const supa = adminClient();
    const code = (input.code?.trim() || genCode(5)).toUpperCase();
    const { error } = await supa.from("stations").insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      code,
      sort_order: input.sort_order ?? 0,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteStation(id: string): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };
  try {
    const supa = adminClient();
    const { error } = await supa.from("stations").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function resetGameData(): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };
  try {
    const supa = adminClient();
    // delete in FK-safe order (cascades help, but be explicit)
    await supa.from("completions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supa.from("members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supa.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* --------------------- Member management (admin) -------------------- */

export async function addTeamMember(
  teamId: string,
  name: string,
): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };
  if (!name.trim()) return { ok: false, error: "Name is required." };
  try {
    const supa = adminClient();
    const { error } = await supa
      .from("members")
      .insert({ team_id: teamId, name: name.trim() });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function removeTeamMember(memberId: string): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };
  try {
    const supa = adminClient();
    const { error } = await supa.from("members").delete().eq("id", memberId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

/* --------------- Leaderboard visibility toggle (admin) --------------- */

export async function setLeaderboardPublic(value: boolean): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Unauthorized" };
  try {
    const supa = adminClient();
    const { error } = await supa
      .from("settings")
      .update({ leaderboard_public: value })
      .eq("id", 1);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}
