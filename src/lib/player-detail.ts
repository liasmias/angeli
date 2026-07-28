import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StatFields } from "@/lib/database.types";

/** Alles, was das Spieler-Popup für einen Spieltag braucht. */
export interface PlayerDetail {
  /** Rohwerte, so wie sie in die Punkte einfliessen. */
  stats: StatFields;
  /** Punkte je Kategorie — Schlüssel wie in `fantasy_points.breakdown`. */
  breakdown: Record<string, number>;
  /** Bewertung der Datenquelle; zählt nicht für die Punkte. */
  rating: number | null;
  /** Gegner in der Form "THU (H)". */
  opponent: string | null;
  /** Endstand aus Sicht des eigenen Clubs, z. B. "1:1". */
  score: string | null;
  kickoff: string | null;
}

const LEER: StatFields = {
  minutes: 0, goals: 0, assists: 0, goals_conceded: 0, saves: 0,
  penalties_saved: 0, penalties_conceded: 0, yellow_cards: 0, red_cards: 0, own_goals: 0,
};

/**
 * Lädt Statistik, Punkte-Aufschlüsselung und Partie-Kontext für eine Menge
 * von Spielern an einem Spieltag — in vier Abfragen statt einer pro Spieler.
 */
export async function loadPlayerDetails(
  supabase: SupabaseClient<Database>,
  gameweekId: number,
  playerIds: number[]
): Promise<Record<number, PlayerDetail>> {
  if (playerIds.length === 0) return {};

  const [{ data: players }, { data: stats }, { data: points }, { data: fixtures }] =
    await Promise.all([
      supabase.from("players").select("id, club_id").in("id", playerIds),
      supabase
        .from("player_stats")
        .select("*")
        .eq("gameweek_id", gameweekId)
        .in("player_id", playerIds),
      supabase
        .from("fantasy_points")
        .select("player_id, points, breakdown")
        .eq("gameweek_id", gameweekId)
        .in("player_id", playerIds),
      supabase
        .from("fixtures")
        .select(
          "home_club_id, away_club_id, home_goals, away_goals, kickoff, home:clubs!fixtures_home_club_id_fkey(short_name), away:clubs!fixtures_away_club_id_fkey(short_name)"
        )
        .eq("gameweek_id", gameweekId),
    ]);

  // Pro Club die Partie dieses Spieltags — daraus Gegner und Endstand.
  const partieByClub = new Map<number, { opponent: string; score: string | null; kickoff: string | null }>();
  for (const f of fixtures ?? []) {
    const home = Array.isArray(f.home) ? f.home[0] : f.home;
    const away = Array.isArray(f.away) ? f.away[0] : f.away;
    const tore = f.home_goals !== null && f.away_goals !== null;
    if (f.home_club_id) {
      partieByClub.set(f.home_club_id, {
        opponent: `${away?.short_name ?? "?"} (H)`,
        score: tore ? `${f.home_goals}:${f.away_goals}` : null,
        kickoff: f.kickoff,
      });
    }
    if (f.away_club_id) {
      partieByClub.set(f.away_club_id, {
        opponent: `${home?.short_name ?? "?"} (A)`,
        score: tore ? `${f.away_goals}:${f.home_goals}` : null,
        kickoff: f.kickoff,
      });
    }
  }

  const statsById = new Map((stats ?? []).map((s) => [s.player_id, s]));
  const pointsById = new Map((points ?? []).map((p) => [p.player_id, p]));
  const clubById = new Map((players ?? []).map((p) => [p.id, p.club_id]));

  const ergebnis: Record<number, PlayerDetail> = {};
  for (const id of playerIds) {
    const s = statsById.get(id);
    const p = pointsById.get(id);
    const partie = clubById.get(id) ? partieByClub.get(clubById.get(id) as number) : undefined;
    ergebnis[id] = {
      stats: s
        ? {
            minutes: s.minutes, goals: s.goals, assists: s.assists,
            goals_conceded: s.goals_conceded, saves: s.saves,
            penalties_saved: s.penalties_saved, penalties_conceded: s.penalties_conceded,
            yellow_cards: s.yellow_cards, red_cards: s.red_cards, own_goals: s.own_goals,
          }
        : LEER,
      breakdown: (p?.breakdown as Record<string, number>) ?? {},
      rating: s?.rating ?? null,
      opponent: partie?.opponent ?? null,
      score: partie?.score ?? null,
      kickoff: partie?.kickoff ?? null,
    };
  }
  return ergebnis;
}
