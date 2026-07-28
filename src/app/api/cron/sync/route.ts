import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFixturesByRound, getFixturePlayerStats } from "@/lib/football-api/client";
import { recomputePlayerPoints } from "@/lib/gameweek-scoring";
import { computeAutoSubs } from "@/lib/auto-subs";
import type { Position } from "@/lib/database.types";

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
  // die zuletzt gespielte Aufstellung automatisch weiter.
  //
  // Nur für Kader, die an einer FRÜHEREN Runde bereits teilgenommen haben.
  // Sonst bekäme jemand, der erst jetzt einsteigt, rückwirkend Aufstellungen
  // für längst gespielte Runden — und damit Punkte, die ihm nicht zustehen.
  // Kopiert wird aus der letzten echten Aufstellung, nicht aus squad_players:
  // der aktuelle Kader kann inzwischen für eine spätere Runde umgebaut sein.
  let squadsRolledOver = 0;
  const { data: alleGws } = await supabase
    .from("gameweeks")
    .select("id, number")
    .eq("season", settings.season);
  const frueher = (alleGws ?? []).filter((g) => g.number < gameweek.number);
  const nummerById = new Map(frueher.map((g) => [g.id, g.number]));

  if (frueher.length > 0) {
    const { data: alleSquads } = await supabase.from("squads").select("id");
    for (const s of alleSquads ?? []) {
      const { count } = await supabase
        .from("gameweek_squads")
        .select("*", { count: "exact", head: true })
        .eq("squad_id", s.id)
        .eq("gameweek_id", gameweek.id);
      if (count) continue;

      const { data: vorherige } = await supabase
        .from("gameweek_squads")
        .select("gameweek_id, player_id, is_starting, is_captain, bench_order")
        .eq("squad_id", s.id)
        .in(
          "gameweek_id",
          frueher.map((g) => g.id)
        );
      // Noch nie mitgespielt → nichts nachtragen, sonst gäbe es Punkte
      // für Runden, in denen dieser Kader gar nicht dabei war.
      if (!vorherige || vorherige.length === 0) continue;

      const letzteNummer = Math.max(
        ...vorherige.map((r) => nummerById.get(r.gameweek_id) ?? 0)
      );
      const quelle = vorherige.filter(
        (r) => nummerById.get(r.gameweek_id) === letzteNummer
      );
      await supabase.from("gameweek_squads").insert(
        quelle.map((r) => ({
          squad_id: s.id,
          gameweek_id: gameweek.id,
          player_id: r.player_id,
          is_starting: r.is_starting,
          is_captain: r.is_captain,
          bench_order: r.bench_order,
          points_earned: null,
        }))
      );
      squadsRolledOver++;
    }
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

  // Automatische Einwechslungen — erst wenn ALLE Partien der Runde beendet
  // sind, sonst würde ein Spieler getauscht, dessen Partie noch aussteht.
  let autoSubs = 0;
  if (offeneSpiele === 0 && liveSpiele === 0 && beendeteSpiele > 0) {
    const { data: aufstellungen } = await supabase
      .from("gameweek_squads")
      .select("squad_id, player_id, is_starting, bench_order, auto_subbed, players(position)")
      .eq("gameweek_id", gameweek.id);

    const { data: minutenRows } = await supabase
      .from("player_stats")
      .select("player_id, minutes")
      .eq("gameweek_id", gameweek.id);
    const minutenByPlayer = new Map((minutenRows ?? []).map((m) => [m.player_id, m.minutes]));

    type AufstellungsZeile = NonNullable<typeof aufstellungen>[number];
    const proKader = new Map<number, AufstellungsZeile[]>();
    for (const r of aufstellungen ?? []) {
      const liste = proKader.get(r.squad_id) ?? [];
      liste.push(r);
      proKader.set(r.squad_id, liste);
    }

    for (const [squadId, zeilen] of proKader) {
      // Schon getauscht — nicht erneut anfassen.
      if (zeilen.some((z) => z.auto_subbed)) continue;

      const subs = computeAutoSubs(
        zeilen.map((z) => {
          const pl = Array.isArray(z.players) ? z.players[0] : z.players;
          return {
            playerId: z.player_id,
            position: (pl?.position ?? "MID") as Position,
            isStarting: z.is_starting,
            benchOrder: z.bench_order,
            minutes: minutenByPlayer.get(z.player_id) ?? 0,
          };
        })
      );
      if (subs.length === 0) continue;

      for (const s of subs) {
        await supabase
          .from("gameweek_squads")
          .update({ is_starting: false, auto_subbed: true })
          .eq("squad_id", squadId)
          .eq("gameweek_id", gameweek.id)
          .eq("player_id", s.outPlayerId);
        await supabase
          .from("gameweek_squads")
          .update({ is_starting: true, auto_subbed: true })
          .eq("squad_id", squadId)
          .eq("gameweek_id", gameweek.id)
          .eq("player_id", s.inPlayerId);
      }
      autoSubs += subs.length;
    }
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

  // Heartbeat für die Admin-Statusanzeige — nur nach einem vollständigen
  // Lauf, damit ein stehengebliebener Zeitstempel echte Ausfälle verrät.
  // Tolerant gegenüber fehlender Spalte (Migration 0011 noch nicht gelaufen).
  await supabase
    .from("league_settings")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_note: `GW ${gameweek.number}: ${statsSynced} Statistiken, ${liveSpiele} live, ${beendeteSpiele} beendet`,
    })
    .eq("id", 1)
    .then(({ error }) => {
      if (error) console.warn("Heartbeat nicht geschrieben:", error.message);
    });

  return NextResponse.json({
    gameweek: gameweek.number,
    lockedByDeadline: (newlyLocked ?? []).map((g) => g.number),
    squadsRolledOver,
    fixturesSynced,
    spiele: { live: liveSpiele, beendet: beendeteSpiele, offen: offeneSpiele },
    statsSynced,
    playersRecomputed: touchedPlayerIds.size,
    autoSubs,
    deadlinesAdjusted,
  });
}
