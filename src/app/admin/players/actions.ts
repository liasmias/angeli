"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import type { Position } from "@/lib/database.types";

const VALID_POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

export async function updatePlayer(formData: FormData) {
  const { supabase } = await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  const price = Number(formData.get("price"));
  const clubId = Number(formData.get("clubId"));
  const isActive = formData.get("isActive") === "on";

  if (!Number.isFinite(playerId) || !Number.isFinite(price) || price < 0) return;
  if (!Number.isFinite(clubId)) return;

  await supabase
    .from("players")
    .update({ price, club_id: clubId, is_active: isActive })
    .eq("id", playerId);
  revalidatePath("/admin/players");
  revalidatePath("/team");
  revalidatePath("/stats");
}

export async function createPlayer(formData: FormData) {
  const { supabase } = await requireAdmin();

  const lastName = String(formData.get("lastName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim() || null;
  const clubId = Number(formData.get("clubId"));
  const position = String(formData.get("position") ?? "") as Position;
  const price = Number(formData.get("price"));
  const apiIdRaw = String(formData.get("apiFootballPlayerId") ?? "").trim();

  if (!lastName || !Number.isFinite(clubId) || !VALID_POSITIONS.includes(position)) return;
  if (!Number.isFinite(price) || price < 0) return;

  await supabase.from("players").insert({
    first_name: firstName,
    last_name: lastName,
    club_id: clubId,
    position,
    price,
    api_football_player_id: apiIdRaw ? Number(apiIdRaw) : null,
    is_active: true,
  });
  revalidatePath("/admin/players");
  revalidatePath("/team");
  revalidatePath("/stats");
}
