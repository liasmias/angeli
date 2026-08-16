"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import type { PlayerFlag, Position } from "@/lib/database.types";

const VALID_POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

/**
 * Ändert Anzeigedaten eines Spielers.
 *
 * Bewusst NICHT änderbar: `id` und `api_football_player_id`. Über die
 * API-ID ordnet der Sync die Statistiken zu — würde sie verstellt, bekäme
 * der Spieler die Punkte eines anderen oder gar keine mehr. Die Felder
 * werden deshalb im Formular gar nicht erst angeboten.
 */
export async function updatePlayer(formData: FormData) {
  const { supabase } = await requireAdmin();
  const playerId = Number(formData.get("playerId"));
  const price = Number(formData.get("price"));
  const clubId = Number(formData.get("clubId"));
  const isActive = formData.get("isActive") === "on";
  const lastName = String(formData.get("lastName") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "").trim() || null;
  // Verfügbarkeit: leer = spielbereit, sonst gelb (fraglich) oder rot (fällt aus).
  const roh = String(formData.get("flag") ?? "");
  const flag: PlayerFlag | null = roh === "yellow" || roh === "red" ? roh : null;
  const flagNote = String(formData.get("flagNote") ?? "").trim() || null;

  if (!Number.isFinite(playerId) || !Number.isFinite(price) || price < 0) return;
  if (!Number.isFinite(clubId) || !lastName) return;

  await supabase
    .from("players")
    .update({
      price,
      club_id: clubId,
      is_active: isActive,
      first_name: firstName,
      last_name: lastName,
      flag,
      flag_note: flag ? flagNote : null,
    })
    .eq("id", playerId);
  revalidatePath("/admin/players");
  revalidatePath("/team");
  revalidatePath("/stats");
  revalidatePath("/fixtures");
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
    // Neue Spieler gelten als spielbereit; markiert wird später bei Bedarf.
    flag: null,
    flag_note: null,
    // Ohne API-ID kann der Sync nichts zuordnen — dann wird von Hand gepflegt.
    manual_stats: !apiIdRaw,
  });
  revalidatePath("/admin/players");
  revalidatePath("/team");
  revalidatePath("/stats");
}
