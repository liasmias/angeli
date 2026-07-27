import "server-only";
import type { StatFields } from "@/lib/database.types";

const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

async function apiFootballFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(BASE_URL + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY! },
    // Bewusst ungecached: Der Sync existiert ausschliesslich, um frische
    // Daten zu holen. Mit Next.js' Data Cache lieferte er veraltete
    // Spielstände aus — beendete Partien blieben auf "nicht gestartet"
    // stehen, weil eine ältere Antwort wiederverwendet wurde.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`API-Football request failed (${res.status}): ${path}`);
  }

  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }
  return json.response as T;
}

export interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
}

/** Round strings look like "Regular Season - 5". */
export async function getFixturesByRound(
  leagueId: string,
  season: string,
  round: string
): Promise<ApiFixture[]> {
  return apiFootballFetch<ApiFixture[]>("/fixtures", {
    league: leagueId,
    season,
    round,
  });
}

interface ApiPlayerFixtureStats {
  player: { id: number; name: string };
  statistics: Array<{
    games: { minutes: number | null };
    goals: {
      total: number | null;
      conceded: number | null;
      assists: number | null;
      saves: number | null;
    };
    penalty: {
      scored: number | null;
      missed: number | null;
      saved: number | null;
      // API-Football spells this field with one "m" — not a typo on our side.
      commited: number | null;
    };
    cards: { yellow: number | null; red: number | null };
  }>;
}

interface ApiFixturePlayersResponse {
  team: { id: number };
  players: ApiPlayerFixtureStats[];
}

export async function getFixturePlayerStats(
  fixtureId: number
): Promise<Array<{ apiFootballPlayerId: number; teamApiId: number; stats: StatFields }>> {
  const teams = await apiFootballFetch<ApiFixturePlayersResponse[]>("/fixtures/players", {
    fixture: String(fixtureId),
  });

  return teams.flatMap((team) =>
    team.players.map((entry) => {
      const s = entry.statistics[0];
      return {
        apiFootballPlayerId: entry.player.id,
        teamApiId: team.team.id,
        stats: {
          minutes: s?.games.minutes ?? 0,
          goals: s?.goals.total ?? 0,
          assists: s?.goals.assists ?? 0,
          goals_conceded: s?.goals.conceded ?? 0,
          saves: s?.goals.saves ?? 0,
          penalties_saved: s?.penalty.saved ?? 0,
          penalties_conceded: s?.penalty.commited ?? 0,
          yellow_cards: s?.cards.yellow ?? 0,
          red_cards: s?.cards.red ?? 0,
          // Not exposed by this endpoint at all — always 0 from the sync,
          // only ever set through an admin override.
          own_goals: 0,
        },
      };
    })
  );
}
