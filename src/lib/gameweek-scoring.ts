import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFantasyPoints, applyOverride } from "@/lib/scoring";
import { BONUS_AB_SPIELTAG, BONUS_FINALE_STATUS, computeBonus } from "@/lib/bonus";
import type { Database, StatFields } from "@/lib/database.types";

/**
 * Bonuspunkte des Spielers für seine Partie — 0, solange die Partie läuft
 * (sonst wechselte der Bonus live laufend den Besitzer), vor BONUS_AB_SPIELTAG
 * oder wenn keine Partie/Bewertung vorliegt. Ratings anderer Spieler werden
 * inklusive Admin-Korrekturen gelesen, damit eine Rating-Korrektur auch die
 * Bonusverteilung der Partie korrigiert.
 */
async function computeBonusForPlayer(
  supabase: SupabaseClient<Database>,
  playerId: number,
  gameweekId: number,
  fixtureId: number | null
): Promise<number> {
  if (!fixtureId) return 0;

  const [{ data: gw }, { data: fixture }] = await Promise.all([
    supabase.from("gameweeks").select("number").eq("id", gameweekId).single(),
    supabase.from("fixtures").select("status").eq("id", fixtureId).single(),
  ]);
  if (!gw || gw.number < BONUS_AB_SPIELTAG) return 0;
  if (!fixture || !BONUS_FINALE_STATUS.has(fixture.status ?? "")) return 0;

  // Das Rating ist nicht admin-korrigierbar (bewusst: es ist die einzige
  // nicht nachzählbare Grösse) — Minuten-Korrekturen fliessen aber ein,
  // damit ein nachgetragener Einsatz bonusberechtigt wird.
  const [{ data: stats }, { data: overrides }] = await Promise.all([
    supabase
      .from("player_stats")
      .select("player_id, rating, minutes")
      .eq("gameweek_id", gameweekId)
      .eq("fixture_id", fixtureId),
    supabase
      .from("player_stats_overrides")
      .select("player_id, minutes")
      .eq("gameweek_id", gameweekId),
  ]);
  const minutenOverride = new Map((overrides ?? []).map((o) => [o.player_id, o.minutes]));
  const bonus = computeBonus(
    (stats ?? []).map((s) => ({
      playerId: s.player_id,
      rating: s.rating === null ? null : Number(s.rating),
      minutes: minutenOverride.get(s.player_id) ?? s.minutes,
    }))
  );
  return bonus.get(playerId) ?? 0;
}

/** Recomputes fantasy_points and the locked-in gameweek_squads snapshot for one player. */
export async function recomputePlayerPoints(
  supabase: SupabaseClient<Database>,
  playerId: number,
  gameweekId: number
) {
  const { data: player } = await supabase.from("players").select("position").eq("id", playerId).single();
  if (!player) return;

  const { data: synced } = await supabase
    .from("player_stats")
    .select("*")
    .eq("player_id", playerId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();
  const { data: override } = await supabase
    .from("player_stats_overrides")
    .select("*")
    .eq("player_id", playerId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();

  const base: StatFields = synced
    ? {
        minutes: synced.minutes,
        goals: synced.goals,
        assists: synced.assists,
        goals_conceded: synced.goals_conceded,
        saves: synced.saves,
        penalties_saved: synced.penalties_saved,
        penalties_conceded: synced.penalties_conceded,
        yellow_cards: synced.yellow_cards,
        red_cards: synced.red_cards,
        own_goals: synced.own_goals,
      }
    : {
        minutes: 0,
        goals: 0,
        assists: 0,
        goals_conceded: 0,
        saves: 0,
        penalties_saved: 0,
        penalties_conceded: 0,
        yellow_cards: 0,
        red_cards: 0,
        own_goals: 0,
      };

  const merged = applyOverride(base, override ?? null);
  const { points: basisPunkte, breakdown } = computeFantasyPoints(player.position, merged);

  // Bonus (3/2/1 an die Bestbewerteten der Partie) — hier in der zentralen
  // Berechnung, damit Sync und Admin-Neuberechnung nie auseinanderlaufen.
  const bonus = await computeBonusForPlayer(supabase, playerId, gameweekId, synced?.fixture_id ?? null);
  const points = basisPunkte + bonus;
  const breakdownMitBonus = { ...breakdown, ...(bonus > 0 ? { bonus } : {}) };

  await supabase
    .from("fantasy_points")
    .upsert(
      {
        player_id: playerId,
        gameweek_id: gameweekId,
        points,
        breakdown: breakdownMitBonus as unknown as Record<string, number>,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "player_id,gameweek_id" }
    );

  await supabase
    .from("gameweek_squads")
    .update({ points_earned: points })
    .eq("player_id", playerId)
    .eq("gameweek_id", gameweekId);
}
