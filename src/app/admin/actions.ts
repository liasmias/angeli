"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { recomputePlayerPoints } from "@/lib/gameweek-scoring";
import type { NullableStatFields } from "@/lib/database.types";

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
