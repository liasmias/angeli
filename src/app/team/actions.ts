"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emptyCounts, validateFormation } from "@/lib/formation";
import { getTransferBudget } from "@/lib/transfers";
import type { SquadPick } from "./TeamBuilder";

export async function saveSquad(
  squad: SquadPick[]
): Promise<{ error?: string; savedForGameweek?: number } | undefined> {
  const auth = await createClient();

  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  // Nach der Authentifizierung alle Schreib-/Leseoperationen über den
  // Service-Role-Client. Der Zugriff bleibt auf den eingeloggten Nutzer
  // beschränkt, weil der Kader ausschliesslich über `user_id = user.id`
  // gefunden wird. Normale Clients dürfen diese Tabellen per RLS gar nicht
  // mehr schreiben — sonst liesse sich die Validierung hier per Direkt-Request
  // an die REST-API komplett umgehen.
  const supabase = createAdminClient();

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

  // Persönliche Obergrenze: das Basis-Budget ODER der aktuelle Wert des
  // bereits gespeicherten Teams — je nachdem, was höher ist. Steigen Preise
  // gehaltener Spieler, wächst der Spielraum mit; niemand wird durch fremde
  // Preisänderungen handlungsunfähig. Mehr Wert als vorhanden lässt sich so
  // trotzdem nicht einkaufen.
  const budgetCap = Number(settings.budget_cap);
  const { data: gehaltene } = await supabase
    .from("squad_players")
    .select("players(price)")
    .eq("squad_id", squadRow.id);
  const bisherigerWert = (gehaltene ?? []).reduce((sum, r) => {
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    return sum + Number(p?.price ?? 0);
  }, 0);
  const effektiveGrenze = Math.max(budgetCap, bisherigerWert);
  if (totalPrice > effektiveGrenze + 1e-9) {
    return {
      error: `Budget überschritten (${totalPrice.toFixed(1)} / ${effektiveGrenze.toFixed(1)}).`,
    };
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

  // Formation der Startelf prüfen (1 GK, mind. 3 DEF, mind. 3 MID, mind. 1 FWD).
  const startingCounts = emptyCounts();
  for (const s of squad) {
    if (!s.isStarting) continue;
    const pos = positionById.get(s.playerId);
    if (pos) startingCounts[pos]++;
  }
  const formationError = validateFormation(startingCounts, settings.starting_size);
  if (formationError) return { error: formationError };

  // --- Transferkosten ---
  // Die Zahl der Gratis-Transfers wird aus den tatsächlich gebuchten Transfers
  // dieses Spieltags abgeleitet. Früher stand sie in squads.free_transfers_remaining
  // und wurde bei jedem Speichern zurückgesetzt — dadurch war jeder Transfer gratis,
  // solange man einzeln gespeichert hat.
  const { data: existing } = await supabase.from("squad_players").select("player_id").eq("squad_id", squadRow.id);
  const existingIds = new Set((existing ?? []).map((e) => e.player_id));
  const isFirstSquad = existingIds.size === 0;
  const newIds = new Set(playerIds);
  const added = playerIds.filter((id) => !existingIds.has(id));
  const removed = [...existingIds].filter((id) => !newIds.has(id));

  const budget = await getTransferBudget(supabase, squadRow.id, nextGameweek, settings);

  // Wildcard: an diesem Spieltag kosten beliebig viele Transfers nichts.
  const { data: wildcard } = await supabase
    .from("chip_usages")
    .select("id")
    .eq("squad_id", squadRow.id)
    .eq("chip", "wildcard")
    .eq("gameweek_id", nextGameweek.id)
    .maybeSingle();

  const freeLeft = budget.freeAvailable;
  const transfersNow = Math.max(added.length, removed.length);
  // Gratis, wenn: erster Kader überhaupt, Einstiegsrunde oder Wildcard aktiv.
  const costFree = isFirstSquad || budget.unlimited || !!wildcard;

  // Bank-Reihenfolge: Torhüter bekommt fix Platz 0, die Feldspieler
  // 1..3 in der vom Client gelieferten Reihenfolge. Sie bestimmt, wer bei
  // einer automatischen Einwechslung zuerst nachrückt.
  let naechsterBankplatz = 1;
  const benchOrderById = new Map<number, number>();
  for (const s of squad) {
    if (s.isStarting) {
      benchOrderById.set(s.playerId, 0);
    } else if (positionById.get(s.playerId) === "GK") {
      benchOrderById.set(s.playerId, 0);
    } else {
      benchOrderById.set(s.playerId, naechsterBankplatz++);
    }
  }

  // --- persist squad ---
  await supabase.from("squad_players").delete().eq("squad_id", squadRow.id);
  const squadPlayerRows = squad.map((s) => ({
    squad_id: squadRow.id,
    player_id: s.playerId,
    is_starting: s.isStarting,
    is_captain: s.isCaptain,
    is_vice_captain: false,
    purchase_price: priceById.get(s.playerId) ?? 0,
    bench_order: benchOrderById.get(s.playerId) ?? 0,
  }));
  const { error: insertError } = await supabase.from("squad_players").insert(squadPlayerRows);
  if (insertError) return { error: "Speichern fehlgeschlagen: " + insertError.message };

  if (!isFirstSquad && transfersNow > 0) {
    const transferRows = Array.from({ length: transfersNow }).map((_, i) => ({
      squad_id: squadRow.id,
      gameweek_id: nextGameweek.id,
      player_out_id: removed[i] ?? null,
      player_in_id: added[i] ?? null,
      // Die ersten `freeLeft` Transfers dieses Spieltags sind gratis, der Rest kostet.
      points_cost: costFree || i < freeLeft ? 0 : settings.extra_transfer_cost,
    }));
    await supabase.from("transfers").insert(transferRows);
  }

  // Spiegelt nur noch den abgeleiteten Stand für die Anzeige.
  await supabase
    .from("squads")
    .update({
      free_transfers_remaining: Math.max(0, freeLeft - (isFirstSquad ? 0 : transfersNow)),
    })
    .eq("id", squadRow.id);

  // --- snapshot this gameweek's lineup for scoring ---
  await supabase.from("gameweek_squads").delete().eq("squad_id", squadRow.id).eq("gameweek_id", nextGameweek.id);
  const snapshotRows = squad.map((s) => ({
    squad_id: squadRow.id,
    gameweek_id: nextGameweek.id,
    player_id: s.playerId,
    is_starting: s.isStarting,
    is_captain: s.isCaptain,
    bench_order: benchOrderById.get(s.playerId) ?? 0,
    points_earned: null,
  }));
  await supabase.from("gameweek_squads").insert(snapshotRows);

  revalidatePath("/team");
  return { savedForGameweek: nextGameweek.number };
}
