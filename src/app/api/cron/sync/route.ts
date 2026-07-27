import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFixturesByRound, getFixturePlayerStats } from "@/lib/football-api/client";
import { recomputePlayerPoints } from "@/lib/gameweek-scoring";

// Status-Codes von API-Football.
//
// Live-Spiele werden bewusst mitgenommen, damit die Punkte schon während der
// Partie mitlaufen. Da der Cron alle 15 Minuten erneut über denselben
// Spieltag läuft, werden Zwischenstände später automatisch durch die
// Endergebnisse überschrieben.
const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const HAT_DATEN = new Set([...LIVE_STATUSES, ...FINISHED_STATUSES]);

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = process.env.API_FOOTBALL_LEAGUE_ID;
  if (!leagueId) {
    return NextResponse.json({ error: "API_FOOTBALL_LEAGUE_ID fehlt." }, { status: 500 });
  }

  const supabase = createAdminClient();

  const { data: settings } = await supabase.from("league_settings").select("season").eq("id", 1).single();
  if (!settings) {
    return NextResponse.json({ error: "league_settings nicht konfiguriert." }, { status: 500 });
  }

  // Spieltage mit abgelaufener Deadline automatisch sperren — ohne das bliebe
  // die Sperre vom manuellen Admin-Klick abhängig und der Sync würde den
  // laufenden Spieltag nie als "gesperrt" erkennen.
  const { data: newlyLocked } = await supabase
    .from("gameweeks")
    .update({ is_locked: true })
    .eq("season", settings.season)
    .eq("is_locked", false)
    .lt("deadline", new Date().toISOString())
    .select("number");

  // Only the gameweek whose deadline has already passed (is_locked) can have
  // live/final stats — pick the most recent one so a single cron tick doesn't
  // re-fetch every finished round of the season.
  const { data: gameweek } = await supabase
    .from("gameweeks")
    .select("id, number")
    .eq("season", settings.season)
    .eq("is_locked", true)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!gameweek) {
    return NextResponse.json({ message: "Kein gesperrter Spieltag zum Synchronisieren." });
  }

  // Fehlende Aufstellungs-Schnappschüsse nachziehen: Der Schnappschuss entsteht
  // sonst nur beim Klick auf "Team speichern" — wer eine Runde lang nichts
  // ändert, hätte gar keine Aufstellung und ginge leer aus. Stattdessen läuft
  // das zuletzt gespeicherte Team automatisch weiter.
  let squadsRolledOver = 0;
  const { data: alleSquads } = await supabase.from("squads").select("id");
  for (const s of alleSquads ?? []) {
    const { count } = await supabase
      .from("gameweek_squads")
      .select("*", { count: "exact", head: true })
      .eq("squad_id", s.id)
      .eq("gameweek_id", gameweek.id);
    if (count) continue;
    const { data: aktuell } = await supabase
      .from("squad_players")
      .select("player_id, is_starting, is_captain")
      .eq("squad_id", s.id);
    if (!aktuell || aktuell.length === 0) continue;
    await supabase.from("gameweek_squads").insert(
      aktuell.map((r) => ({
        squad_id: s.id,
        gameweek_id: gameweek.id,
        player_id: r.player_id,
        is_starting: r.is_starting,
        is_captain: r.is_captain,
        points_earned: null,
      }))
    );
    squadsRolledOver++;
  }

  const { data: clubs } = await supabase.from("clubs").select("id, api_football_team_id");
  const clubIdByApiId = new Map((clubs ?? []).filter((c) => c.api_football_team_id !== null).map((c) => [c.api_football_team_id as number, c.id]));

  const { data: players } = await supabase.from("players").select("id, api_football_player_id");
  const playerIdByApiId = new Map((players ?? []).filter((p) => p.api_football_player_id !== null).map((p) => [p.api_football_player_id as number, p.id]));

  const fixtures = await getFixturesByRound(leagueId, settings.season, `Regular Season - ${gameweek.number}`);

  const touchedPlayerIds = new Set<number>();
  let fixturesSynced = 0;
  let statsSynced = 0;
  let liveSpiele = 0;
  let beendeteSpiele = 0;
  let offeneSpiele = 0;

  for (const fixture of fixtures) {
    const homeClubId = clubIdByApiId.get(fixture.teams.home.id);
    const awayClubId = clubIdByApiId.get(fixture.teams.away.id);

    await supabase.from("fixtures").upsert(
      {
        api_football_fixture_id: fixture.fixture.id,
        gameweek_id: gameweek.id,
        home_club_id: homeClubId ?? null,
        away_club_id: awayClubId ?? null,
        kickoff: fixture.fixture.date,
        status: fixture.fixture.status.short,
        home_goals: fixture.goals.home,
        away_goals: fixture.goals.away,
      },
      { onConflict: "api_football_fixture_id" }
    );
    fixturesSynced++;

    const status = fixture.fixture.status.short;
    if (LIVE_STATUSES.has(status)) liveSpiele++;
    else if (FINISHED_STATUSES.has(status)) beendeteSpiele++;
    else offeneSpiele++;

    if (!HAT_DATEN.has(status)) continue;

    const { data: fixtureRow } = await supabase
      .from("fixtures")
      .select("id")
      .eq("api_football_fixture_id", fixture.fixture.id)
      .single();

    // Gegentore pro Team aus dem Resultat — die API liefert `goals.conceded`
    // nur für Torhüter zuverlässig, bei Feldspielern kommt null.
    const concededByTeam = new Map<number, number>([
      [fixture.teams.home.id, fixture.goals.away ?? 0],
      [fixture.teams.away.id, fixture.goals.home ?? 0],
    ]);

    const playerStats = await getFixturePlayerStats(fixture.fixture.id);
    for (const entry of playerStats) {
      const playerId = playerIdByApiId.get(entry.apiFootballPlayerId);
      if (!playerId) continue;

      const teamConceded = concededByTeam.get(entry.teamApiId) ?? 0;
      await supabase.from("player_stats").upsert(
        {
          player_id: playerId,
          gameweek_id: gameweek.id,
          fixture_id: fixtureRow?.id ?? null,
          ...entry.stats,
          // Näherung: Spieler mit Einsatzzeit bekommen die Team-Gegentore zugerechnet.
          goals_conceded: entry.stats.minutes > 0 ? teamConceded : 0,
          rating: entry.rating,
          // Explizit setzen: Der Standardwert `now()` greift nur beim Einfügen.
          // Ohne das blieb der Zeitstempel beim allerersten Import stehen und
          // liess frische Daten alt aussehen.
          synced_at: new Date().toISOString(),
        },
        { onConflict: "player_id,gameweek_id" }
      );
      touchedPlayerIds.add(playerId);
      statsSynced++;
    }
  }

  for (const playerId of touchedPlayerIds) {
    await recomputePlayerPoints(supabase, playerId, gameweek.id);
  }

  // Deadlines pflegen: immer 1 Stunde vor dem ersten Anpfiff der Runde.
  // Für die nächste offene Runde kommen die Anspielzeiten frisch von der API —
  // Spielverschiebungen korrigieren die Deadline damit von selbst. Spätere
  // Runden rechnen mit den bereits importierten Zeiten und werden präzisiert,
  // sobald sie an der Reihe sind.
  let deadlinesAdjusted = 0;
  const { data: naechsteOffene } = await supabase
    .from("gameweeks")
    .select("id, number")
    .eq("season", settings.season)
    .eq("is_locked", false)
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (naechsteOffene) {
    const kommende = await getFixturesByRound(
      leagueId,
      settings.season,
      `Regular Season - ${naechsteOffene.number}`
    );
    for (const fixture of kommende) {
      await supabase.from("fixtures").upsert(
        {
          api_football_fixture_id: fixture.fixture.id,
          gameweek_id: naechsteOffene.id,
          home_club_id: clubIdByApiId.get(fixture.teams.home.id) ?? null,
          away_club_id: clubIdByApiId.get(fixture.teams.away.id) ?? null,
          kickoff: fixture.fixture.date,
          status: fixture.fixture.status.short,
          home_goals: fixture.goals.home,
          away_goals: fixture.goals.away,
        },
        { onConflict: "api_football_fixture_id" }
      );
    }
  }
  const { data: offeneRunden } = await supabase
    .from("gameweeks")
    .select("id, deadline")
    .eq("season", settings.season)
    .eq("is_locked", false);
  for (const runde of offeneRunden ?? []) {
    const { data: ersterAnpfiff } = await supabase
      .from("fixtures")
      .select("kickoff")
      .eq("gameweek_id", runde.id)
      .order("kickoff", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!ersterAnpfiff?.kickoff) continue;
    const soll = new Date(new Date(ersterAnpfiff.kickoff).getTime() - 3600_000).toISOString();
    if (new Date(runde.deadline).toISOString() !== soll) {
      await supabase.from("gameweeks").update({ deadline: soll }).eq("id", runde.id);
      deadlinesAdjusted++;
    }
  }

  return NextResponse.json({
    gameweek: gameweek.number,
    lockedByDeadline: (newlyLocked ?? []).map((g) => g.number),
    squadsRolledOver,
    fixturesSynced,
    spiele: { live: liveSpiele, beendet: beendeteSpiele, offen: offeneSpiele },
    statsSynced,
    playersRecomputed: touchedPlayerIds.size,
    deadlinesAdjusted,
  });
}
