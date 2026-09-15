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
    // Minuten-Korrekturen dieser Partie (oder rundenweite ohne Partie) —
    // damit ein nachgetragener Einsatz bonusberechtigt wird.
    supabase
      .from("player_stats_overrides")
      .select("player_id, minutes, fixture_id")
      .eq("gameweek_id", gameweekId)
      .or(`fixture_id.eq.${fixtureId},fixture_id.is.null`),
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

/**
 * Rechnet fantasy_points und den festgeschriebenen Schnappschuss in
 * gameweek_squads für einen Spieler neu.
 *
 * Gerechnet wird je PARTIE und dann summiert, nicht einmal je Spieltag. In
 * einer Double Gameweek hat ein Spieler zwei Einsätze, und alles, was pro
 * Spiel anfällt, fällt zweimal an: Antrittspunkte, Zu-null, Karten — und der
 * Bonus, der ohnehin je Partie vergeben wird. Genau so hält es FPL.
 *
 * Für die bisherigen Runden mit einer Partie je Verein ändert sich dadurch
 * nichts: Eine Zeile ergibt dieselbe Summe wie vorher.
 */
export async function recomputePlayerPoints(
  supabase: SupabaseClient<Database>,
  playerId: number,
  gameweekId: number
) {
  const { data: player } = await supabase.from("players").select("position").eq("id", playerId).single();
  if (!player) return;

  const [{ data: zeilen }, { data: korrekturen }] = await Promise.all([
    supabase
      .from("player_stats")
      .select("*")
      .eq("player_id", playerId)
      .eq("gameweek_id", gameweekId),
    supabase
      .from("player_stats_overrides")
      .select("*")
      .eq("player_id", playerId)
      .eq("gameweek_id", gameweekId),
  ]);

  const LEER: StatFields = {
    minutes: 0, goals: 0, assists: 0, goals_conceded: 0, saves: 0,
    penalties_saved: 0, penalties_conceded: 0, yellow_cards: 0, red_cards: 0, own_goals: 0,
  };

  // Eine Korrektur mit Partie gilt nur für diese. Eine ohne Partie gilt für
  // die Runde — und darf deshalb nur EINMAL einfliessen: applyOverride ersetzt
  // Werte, statt sie zu addieren, und 90 korrigierte Minuten würden bei zwei
  // Partien sonst zu 180. Sie greift daher nur bei der ersten Partie.
  const rundenweit = (korrekturen ?? []).find((k) => k.fixture_id === null) ?? null;
  const korrekturFuer = (fixtureId: number | null, istErste: boolean) =>
    (korrekturen ?? []).find((k) => k.fixture_id !== null && k.fixture_id === fixtureId) ??
    (istErste ? rundenweit : null);

  // Eine Korrektur zu einer Partie, für die keine Statistik vorliegt, muss
  // trotzdem zählen — sonst ginge ein von Hand nachgetragener Einsatz
  // verloren, weil die Datenquelle ihn nicht kennt.
  const partien: (number | null)[] = [...new Set([
    ...(zeilen ?? []).map((z) => z.fixture_id),
    ...(korrekturen ?? []).map((k) => k.fixture_id),
  ])];
  if (partien.length === 0) partien.push(null);

  // Nach Partie-ID sortieren, damit "die erste Partie" bei jedem Lauf dieselbe
  // ist — sonst wanderte eine rundenweite Korrektur zwischen den Partien.
  partien.sort((a, b) => (a ?? 0) - (b ?? 0));

  let points = 0;
  const breakdownGesamt: Record<string, number> = {};
  for (const [index, fixtureId] of partien.entries()) {
    const zeile = (zeilen ?? []).find((z) => z.fixture_id === fixtureId) ?? null;
    const base: StatFields = zeile
      ? {
          minutes: zeile.minutes,
          goals: zeile.goals,
          assists: zeile.assists,
          goals_conceded: zeile.goals_conceded,
          saves: zeile.saves,
          penalties_saved: zeile.penalties_saved,
          penalties_conceded: zeile.penalties_conceded,
          yellow_cards: zeile.yellow_cards,
          red_cards: zeile.red_cards,
          own_goals: zeile.own_goals,
        }
      : { ...LEER };

    const merged = applyOverride(base, korrekturFuer(fixtureId, index === 0));
    const { points: basisPunkte, breakdown } = computeFantasyPoints(player.position, merged);
    const bonus = await computeBonusForPlayer(supabase, playerId, gameweekId, fixtureId);

    points += basisPunkte + bonus;
    for (const [schluessel, wert] of Object.entries(breakdown)) {
      breakdownGesamt[schluessel] = (breakdownGesamt[schluessel] ?? 0) + wert;
    }
    if (bonus > 0) breakdownGesamt.bonus = (breakdownGesamt.bonus ?? 0) + bonus;
  }

  await supabase
    .from("fantasy_points")
    .upsert(
      {
        player_id: playerId,
        gameweek_id: gameweekId,
        points,
        breakdown: breakdownGesamt as unknown as Record<string, number>,
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
