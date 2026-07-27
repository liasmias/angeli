"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sperrt bzw. entsperrt einen Account.
 *
 * Zwei Ebenen, damit eine Sperre wirklich greift:
 *  1. `profiles.is_blocked` → Account verschwindet aus der Rangliste.
 *  2. Supabase-Auth `ban_duration` → Login wird serverseitig verweigert.
 */
export async function setUserBlocked(userId: string, blocked: boolean, _formData: FormData) {
  const { user: actingAdmin } = await requireAdmin();

  // Sich selbst auszusperren wäre eine Sackgasse — die Liga hätte keinen Admin mehr.
  if (userId === actingAdmin.id) {
    throw new Error("Du kannst dich nicht selbst sperren.");
  }

  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (target?.role === "admin") {
    throw new Error("Admins können nicht gesperrt werden — entziehe zuerst die Admin-Rechte.");
  }

  await admin.from("profiles").update({ is_blocked: blocked }).eq("id", userId);

  // 100 Jahre ≈ dauerhaft; "none" hebt die Sperre wieder auf.
  await admin.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? "876000h" : "none",
  });

  revalidatePath("/admin/users");
  revalidatePath("/leaderboard");
}

/**
 * Schreibt eine manuelle Punktekorrektur gut — etwa ein Startguthaben für
 * jemanden, der erst mitten in der Saison dazustösst.
 *
 * Jede Korrektur ist ein eigener Eintrag: nachvollziehbar und einzeln
 * zurücknehmbar, statt einen Gesamtwert zu überschreiben.
 */
export async function addPointAdjustment(userId: string, formData: FormData) {
  const { supabase, user: actingAdmin } = await requireAdmin();

  const points = Number(formData.get("points"));
  if (!Number.isInteger(points) || points === 0) {
    throw new Error("Bitte eine ganze Zahl ungleich 0 eingeben.");
  }

  const { data: squad } = await supabase.from("squads").select("id").eq("user_id", userId).single();
  if (!squad) throw new Error("Kein Kader für diesen Account gefunden.");

  await supabase.from("point_adjustments").insert({
    squad_id: squad.id,
    points,
    reason: String(formData.get("reason") ?? "").trim() || null,
    created_by: actingAdmin.id,
  });

  revalidatePath("/admin/users");
  revalidatePath("/leaderboard");
}

export async function removePointAdjustment(adjustmentId: number, _formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("point_adjustments").delete().eq("id", adjustmentId);
  revalidatePath("/admin/users");
  revalidatePath("/leaderboard");
}
