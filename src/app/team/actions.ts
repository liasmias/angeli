"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SquadPick } from "./TeamBuilder";

export async function saveSquad(
  squad: SquadPick[]
): Promise<{ error?: string; savedForGameweek?: number } | undefined> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const { data: settings } = await supabase.from("league_settings").select("*").eq("id", 1).single();
  if (!settings) return { error: "Liga-Einstellungen fehlen." };

  const { data: squadRow } = await supabase
    .from("squads")
    .select("id, free_transfers_remaining")
    .eq("user_id", user.id)
    .single();
  if (!squadRow) return { error: "Kein Kader gefunden." };

  // Serverseitige Deadline-Prüfung: verhindert Änderungen nach Anpfiff auch
  // dann, wenn im Client noch eine alte Seite offen ist.
  const { data: nextGameweek } = await supabase
    .from("gameweeks")
    .select("id, number, is_locked, deadline")
    .eq("is_locked", false)
    .gt("deadline", new Date().toISOString())
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!nextGameweek) return { error: "Kein offener Spieltag verfügbar — die Deadline ist abgelaufen." };

  // --- validation ---
  if (squad.length !== settings.squad_size) {
    return { error: `Kader muss genau ${settings.squad_size} Spieler haben.` };
  }
  const startingCount = squad.filter((s) => s.isStarting).length;
  if (startingCount !== settings.starting_size) {
    return { error: `Startelf muss genau ${settings.starting_size} Spieler haben.` };
  }
  const captains = squad.filter((s) => s.isCaptain);
  if (captains.length !== 1) return { error: "Genau ein Kapitän muss gewählt werden." };
  if (!captains[0].isStarting) return { error: "Der Kapitän muss in der Startelf stehen." };

  const playerIds = squad.map((s) => s.playerId);
  const { data: playerRows } = await supabase.from("players").select("id, position, price").in("id", playerIds);
  if (!playerRows || playerRows.length !== playerIds.length) return { error: "Ungültige Spielerauswahl." };

  const priceById = new Map(playerRows.map((p) => [p.id, Number(p.price)]));
  const positionById = new Map(playerRows.map((p) => [p.id, p.position]));

  const totalPrice = playerIds.reduce((sum, id) => sum + (priceById.get(id) ?? 0), 0);
  const budgetCap = Number(settings.budget_cap);
  if (totalPrice > budgetCap + 1e-9) {
    return { error: `Budget überschritten (${totalPrice.toFixed(1)} / ${budgetCap.toFixed(1)}).` };
  }

  const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const id of playerIds) {
    const pos = positionById.get(id);
    if (pos) counts[pos]++;
  }
  if (counts.GK !== settings.gk_slots) return { error: `Genau ${settings.gk_slots} Torhüter nötig.` };
  if (counts.DEF !== settings.def_slots) return { error: `Genau ${settings.def_slots} Verteidiger nötig.` };
  if (counts.MID !== settings.mid_slots) return { error: `Genau ${settings.mid_slots} Mittelfeldspieler nötig.` };
  if (counts.FWD !== settings.fwd_slots) return { error: `Genau ${settings.fwd_slots} Stürmer nötig.` };

  const startingGk = squad.filter((s) => s.isStarting && positionById.get(s.playerId) === "GK").length;
  if (startingGk !== 1) return { error: "Genau ein Torhüter muss in der Startelf stehen." };

  // --- transfer cost (no rollover: free transfers reset every gameweek) ---
  const { data: existing } = await supabase.from("squad_players").select("player_id").eq("squad_id", squadRow.id);
  const existingIds = new Set((existing ?? []).map((e) => e.player_id));
  const isFirstSquad = existingIds.size === 0;
  const newIds = new Set(playerIds);
  const added = playerIds.filter((id) => !existingIds.has(id));
  const removed = [...existingIds].filter((id) => !newIds.has(id));
  const chargeableTransfers = isFirstSquad ? 0 : Math.max(0, added.length - squadRow.free_transfers_remaining);

  // --- persist squad ---
  await supabase.from("squad_players").delete().eq("squad_id", squadRow.id);
  const squadPlayerRows = squad.map((s) => ({
    squad_id: squadRow.id,
    player_id: s.playerId,
    is_starting: s.isStarting,
    is_captain: s.isCaptain,
    is_vice_captain: false,
    purchase_price: priceById.get(s.playerId) ?? 0,
  }));
  const { error: insertError } = await supabase.from("squad_players").insert(squadPlayerRows);
  if (insertError) return { error: "Speichern fehlgeschlagen: " + insertError.message };

  if (!isFirstSquad && (added.length > 0 || removed.length > 0)) {
    const pairCount = Math.max(added.length, removed.length);
    const transferRows = Array.from({ length: pairCount }).map((_, i) => ({
      squad_id: squadRow.id,
      gameweek_id: nextGameweek.id,
      player_out_id: removed[i] ?? null,
      player_in_id: added[i] ?? null,
      points_cost: i < chargeableTransfers ? settings.extra_transfer_cost : 0,
    }));
    await supabase.from("transfers").insert(transferRows);
  }

  await supabase
    .from("squads")
    .update({ free_transfers_remaining: settings.free_transfers_per_gameweek })
    .eq("id", squadRow.id);

  // --- snapshot this gameweek's lineup for scoring ---
  await supabase.from("gameweek_squads").delete().eq("squad_id", squadRow.id).eq("gameweek_id", nextGameweek.id);
  const snapshotRows = squad.map((s) => ({
    squad_id: squadRow.id,
    gameweek_id: nextGameweek.id,
    player_id: s.playerId,
    is_starting: s.isStarting,
    is_captain: s.isCaptain,
    points_earned: null,
  }));
  await supabase.from("gameweek_squads").insert(snapshotRows);

  revalidatePath("/team");
  return { savedForGameweek: nextGameweek.number };
}
