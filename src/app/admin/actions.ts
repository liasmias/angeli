"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { recomputePlayerPoints } from "@/lib/gameweek-scoring";
import type { NullableStatFields } from "@/lib/database.types";

/**
 * Stösst den Sync sofort an, statt auf den 15-Minuten-Cron zu warten.
 * Ruft denselben Endpoint auf wie pg_cron — eine zweite Implementation
 * würde früher oder später vom echten Sync abweichen.
 */
export async function triggerSync(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/cron/sync`, {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: `Sync fehlgeschlagen (${res.status}).` };
    revalidatePath("/admin");
    const teile = [
      body?.gameweek !== undefined ? `Spieltag ${body.gameweek}` : null,
      body?.statsSynced !== undefined ? `${body.statsSynced} Statistiken` : null,
      body?.deadlinesAdjusted ? `${body.deadlinesAdjusted} Deadlines angepasst` : null,
      body?.squadsRolledOver ? `${body.squadsRolledOver} Teams nachgezogen` : null,
    ].filter(Boolean);
    return { ok: true, message: `Sync erfolgreich — ${teile.join(", ") || "keine Änderungen"}.` };
  } catch {
    return { ok: false, message: "Sync nicht erreichbar — Deployment prüfen." };
  }
}

/** Banner-Text für alle Mitglieder; leer speichern blendet ihn aus. */
export async function saveAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const text = String(formData.get("announcement") ?? "").trim();
  await supabase
    .from("league_settings")
    .update({ announcement: text === "" ? null : text })
    .eq("id", 1);
  revalidatePath("/", "layout");
}

export async function toggleGameweekLock(gameweekId: number, lock: boolean, _formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("gameweeks").update({ is_locked: lock }).eq("id", gameweekId);
  revalidatePath("/admin");
}

const STAT_FIELDS = [
  "minutes",
  "goals",
  "assists",
  "goals_conceded",
  "saves",
  "penalties_saved",
  "penalties_conceded",
  "yellow_cards",
  "red_cards",
  "own_goals",
] as const;

export async function saveStatOverride(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  const gameweekId = Number(formData.get("gameweekId"));

  const overridePayload = {} as NullableStatFields;
  for (const field of STAT_FIELDS) {
    const raw = formData.get(field);
    overridePayload[field] = raw === null || raw === "" ? null : Number(raw);
  }
  const note = String(formData.get("note") ?? "") || null;

  await supabase.from("player_stats_overrides").upsert(
    {
      player_id: playerId,
      gameweek_id: gameweekId,
      ...overridePayload,
      note,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,gameweek_id" }
  );

  await recomputePlayerPoints(supabase, playerId, gameweekId);
  revalidatePath(`/admin/gameweeks/${gameweekId}`);
}

export async function recomputeGameweek(gameweekId: number, _formData: FormData) {
  const { supabase } = await requireAdmin();
  const { data: stats } = await supabase.from("player_stats").select("player_id").eq("gameweek_id", gameweekId);
  for (const row of stats ?? []) {
    await recomputePlayerPoints(supabase, row.player_id, gameweekId);
  }
  revalidatePath(`/admin/gameweeks/${gameweekId}`);
}

/**
 * Meldung beantworten.
 *
 * Die Antwort erscheint beim Mitglied im Profil, dort wo es die Meldung
 * abgeschickt hat. Bewusst getrennt vom Erledigt-Haken: Eine Rueckfrage
 * laesst sich beantworten, ohne den Vorgang zu schliessen.
 */
export async function replyToReport(reportId: number, formData: FormData) {
  const { supabase } = await requireAdmin();
  const text = String(formData.get("reply") ?? "").trim();
  const schliessen = formData.get("resolve") === "on";
  if (!text) return;
  await supabase
    .from("reports")
    .update({
      reply: text.slice(0, 2000),
      replied_at: new Date().toISOString(),
      ...(schliessen ? { resolved_at: new Date().toISOString() } : {}),
    })
    .eq("id", reportId);
  revalidatePath("/admin");
  revalidatePath("/profil");
}

/** Meldung als erledigt markieren (bzw. wieder öffnen). */
export async function resolveReport(reportId: number, resolved: boolean, _formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase
    .from("reports")
    .update({ resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", reportId);
  revalidatePath("/admin");
  revalidatePath("/profil");
}
