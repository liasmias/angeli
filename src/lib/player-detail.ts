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

  // Pro Club die Partien dieses Spieltags — daraus Gegner und Endstand.
  // Bewusst eine Liste: In einer Double Gameweek hat ein Verein zwei Partien,
  // und die zweite überschrieb bisher die erste.
  const partienByClub = new Map<number, { opponent: string; score: string | null; kickoff: string | null }[]>();
  const merke = (
    clubId: number | null,
    eintrag: { opponent: string; score: string | null; kickoff: string | null }
  ) => {
    if (!clubId) return;
    partienByClub.set(clubId, [...(partienByClub.get(clubId) ?? []), eintrag]);
  };
  for (const f of fixtures ?? []) {
    const home = Array.isArray(f.home) ? f.home[0] : f.home;
    const away = Array.isArray(f.away) ? f.away[0] : f.away;
    const tore = f.home_goals !== null && f.away_goals !== null;
    merke(f.home_club_id, {
      opponent: `${away?.short_name ?? "?"} (H)`,
      score: tore ? `${f.home_goals}:${f.away_goals}` : null,
      kickoff: f.kickoff,
    });
    {
      merke(f.away_club_id, {
        opponent: `${home?.short_name ?? "?"} (A)`,
        score: tore ? `${f.away_goals}:${f.home_goals}` : null,
        kickoff: f.kickoff,
      });
    }
  }

  // Alle Zeilen je Spieler — bei zwei Partien zwei Stück.
  const zeilenById = new Map<number, NonNullable<typeof stats>>();
  for (const s of stats ?? []) {
    zeilenById.set(s.player_id, [...(zeilenById.get(s.player_id) ?? []), s] as NonNullable<typeof stats>);
  }
  const pointsById = new Map((points ?? []).map((p) => [p.player_id, p]));
  const clubById = new Map((players ?? []).map((p) => [p.id, p.club_id]));

  const ergebnis: Record<number, PlayerDetail> = {};
  for (const id of playerIds) {
    const zeilen = zeilenById.get(id) ?? [];
    const p = pointsById.get(id);
    const clubId = clubById.get(id);
    const partien = clubId ? (partienByClub.get(clubId) ?? []) : [];

    // Rohwerte über alle Partien der Runde summieren; die Punkte in
    // fantasy_points sind bereits die Rundensumme.
    const summiert: StatFields = { ...LEER };
    for (const z of zeilen) {
      summiert.minutes += z.minutes;
      summiert.goals += z.goals;
      summiert.assists += z.assists;
      summiert.goals_conceded += z.goals_conceded;
      summiert.saves += z.saves;
      summiert.penalties_saved += z.penalties_saved;
      summiert.penalties_conceded += z.penalties_conceded;
      summiert.yellow_cards += z.yellow_cards;
      summiert.red_cards += z.red_cards;
      summiert.own_goals += z.own_goals;
    }

    // Bewertung gemittelt — eine einzelne Zahl für die Runde, wie bei der
    // Preisregel. Zeilen ohne Bewertung bleiben aussen vor.
    const bewertet = zeilen.filter((z) => z.rating !== null);
    const rating =
      bewertet.length > 0
        ? bewertet.reduce((summe, z) => summe + Number(z.rating), 0) / bewertet.length
        : null;

    ergebnis[id] = {
      stats: zeilen.length > 0 ? summiert : LEER,
      breakdown: (p?.breakdown as Record<string, number>) ?? {},
      rating,
      opponent: partien.length === 0 ? null : partien.map((f) => f.opponent).join(" · "),
      score: partien.length === 0 ? null : partien.map((f) => f.score ?? "–").join(" · "),
      kickoff: partien[0]?.kickoff ?? null,
    };
  }
  return ergebnis;
}
