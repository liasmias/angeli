import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFixturesByRound, getFixturesByIds, getFixturePlayerStats } from "@/lib/football-api/client";
import { recomputePlayerPoints } from "@/lib/gameweek-scoring";
import { computeAutoSubs } from "@/lib/auto-subs";
import { PREIS_AB_SPIELTAG, PREIS_ANSTIEG, PREIS_MINIMUM, PREIS_RATING_SCHWELLE, PREIS_SENKUNG, PREIS_SENKUNG_SCHWELLE } from "@/lib/pricing";
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

  const { data: settings } = await supabase
    .from("league_settings")
    .select("season, last_sync_at")
    .eq("id", 1)
    .single();
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

  // ---------------------------------------------------------------------
  // Leerlauf-Bremse
  //
  // Der Cron tickt alle 5 Minuten, gespielt wird aber nur an rund zwei
  // Tagen pro Woche. Ohne diese Prüfung würde jeder Tick den zuletzt
  // gesperrten Spieltag komplett durcharbeiten — auch tagelang nach dem
  // Schlusspfiff. Das kostet Rechenzeit bei Vercel und Kontingent bei
  // API-Football, ohne je ein anderes Ergebnis zu liefern.
  //
  // Voll gerechnet wird nur, wenn es etwas zu holen gibt:
  //   * eine Partie läuft, steht kurz bevor oder endete gerade
  //   * der Spieltag wurde in diesem Lauf frisch gesperrt (Schnappschüsse!)
  //   * der Spielplan fehlt noch komplett
  //   * der letzte volle Lauf ist zu lange her (Spielplan-Auffrischung)
  // Sonst steigen wir hier aus — ein paar Datenbank-Abfragen statt eines
  // vollen Durchlaufs.
  const VORLAUF_MS = 15 * 60 * 1000; // vor dem Anpfiff schon mitlaufen
  const NACHLAUF_MS = 3.5 * 60 * 60 * 1000; // Spiel + Nachspielzeit + Bonus
  const NACHZUEGLER_MS = 8 * 60 * 60 * 1000; // Schlussstand fehlt noch
  const AUFFRISCHUNG_MS = 6 * 60 * 60 * 1000; // Spielplan-Kontrolle

  const { data: bekannteFixtures } = await supabase
    .from("fixtures")
    .select("kickoff, status")
    .eq("gameweek_id", gameweek.id);

  const jetzt = Date.now();
  const partieAktiv = (bekannteFixtures ?? []).some((f) => {
    // Ohne Anstosszeit lieber rechnen als etwas verpassen.
    if (!f.kickoff) return true;
    const anpfiff = new Date(f.kickoff).getTime();
    if (anpfiff > jetzt) return anpfiff - jetzt <= VORLAUF_MS;
    const seitAnpfiff = jetzt - anpfiff;
    if (seitAnpfiff <= NACHLAUF_MS) return true;
    // Längst angepfiffen, aber noch kein Schlussstand — Daten nachziehen.
    // Zeitlich begrenzt, sonst hielte eine abgesagte Partie den Sync ewig wach.
    return seitAnpfiff <= NACHZUEGLER_MS && !FINISHED_STATUSES.has(f.status ?? "");
  });

  const letzterSync = settings.last_sync_at ? new Date(settings.last_sync_at).getTime() : 0;
  const planFaellig = jetzt - letzterSync >= AUFFRISCHUNG_MS;
  const spielplanFehlt = (bekannteFixtures ?? []).length === 0;
  const geradeGesperrt = (newlyLocked ?? []).length > 0;

  if (!partieAktiv && !planFaellig && !spielplanFehlt && !geradeGesperrt) {
    return NextResponse.json({
      gameweek: gameweek.number,
      skipped: true,
      message: "Leerlauf — keine Partie aktiv, Spielplan aktuell.",
    });
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
        .select("gameweek_id, player_id, is_starting, is_captain, is_vice_captain, bench_order")
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
          is_vice_captain: r.is_vice_captain,
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

  // Von Hand terminierte Partien: Ihre Runde bei API-Football stimmt nicht
  // mehr mit unserer überein. Wir schneiden sie aus der Rundenliste heraus und
  // holen stattdessen die, die bei uns in dieser Runde liegen, über ihre ID.
  const { data: manuelleRows } = await supabase
    .from("fixtures")
    .select("api_football_fixture_id, gameweek_id")
    .eq("manual_schedule", true);
  const manuelleRunde = new Map(
    (manuelleRows ?? [])
      .filter((m) => m.api_football_fixture_id !== null)
      .map((m) => [m.api_football_fixture_id as number, m.gameweek_id])
  );

  const ausRunde = (
    await getFixturesByRound(leagueId, settings.season, `Regular Season - ${gameweek.number}`)
  ).filter((f) => {
    const zugewiesen = manuelleRunde.get(f.fixture.id);
    // Nicht von Hand terminiert → die API entscheidet.
    return zugewiesen === undefined || zugewiesen === gameweek.id;
  });
  const nachzutragen = [...manuelleRunde]
    .filter(([id, gwId]) => gwId === gameweek.id && !ausRunde.some((f) => f.fixture.id === id))
    .map(([id]) => id);
  const fixtures = [...ausRunde, ...(await getFixturesByIds(nachzutragen))];

  const touchedPlayerIds = new Set<number>();
  let fixturesSynced = 0;
  let statsSynced = 0;
  let liveSpiele = 0;
  let beendeteSpiele = 0;
  let offeneSpiele = 0;

  for (const fixture of fixtures) {
    const homeClubId = clubIdByApiId.get(fixture.teams.home.id);
    const awayClubId = clubIdByApiId.get(fixture.teams.away.id);

    // Runde und Anstosszeit bleiben bei von Hand terminierten Partien, wie
    // sie sind — die API kennt dort nur den überholten Termin.
    const gemeinsam = {
      home_club_id: homeClubId ?? null,
      away_club_id: awayClubId ?? null,
      status: fixture.fixture.status.short,
      home_goals: fixture.goals.home,
      away_goals: fixture.goals.away,
    };
    if (manuelleRunde.has(fixture.fixture.id)) {
      // Der Datensatz existiert zwingend — die Markierung stammt aus ihm.
      await supabase
        .from("fixtures")
        .update(gemeinsam)
        .eq("api_football_fixture_id", fixture.fixture.id);
    } else {
      await supabase.from("fixtures").upsert(
        {
          api_football_fixture_id: fixture.fixture.id,
          gameweek_id: gameweek.id,
          kickoff: fixture.fixture.date,
          manual_schedule: false,
          ...gemeinsam,
        },
        { onConflict: "api_football_fixture_id" }
      );
    }
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
  let captainSwaps = 0;
  if (offeneSpiele === 0 && liveSpiele === 0 && beendeteSpiele > 0) {
    const { data: aufstellungen } = await supabase
      .from("gameweek_squads")
      .select("squad_id, player_id, is_starting, is_captain, is_vice_captain, bench_order, auto_subbed, players(position)")
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

      // Binde weitergeben, BEVOR getauscht wird: Spielt der Captain keine
      // Minute, übernimmt der Vize — sofern er selbst gespielt hat. Danach
      // greift die doppelte Wertung überall von selbst, weil sie an
      // `is_captain` hängt.
      const captain = zeilen.find((z) => z.is_captain);
      const vize = zeilen.find((z) => z.is_vice_captain);
      if (
        captain &&
        vize &&
        (minutenByPlayer.get(captain.player_id) ?? 0) === 0 &&
        (minutenByPlayer.get(vize.player_id) ?? 0) > 0
      ) {
        await supabase
          .from("gameweek_squads")
          .update({ is_captain: false })
          .eq("squad_id", squadId)
          .eq("gameweek_id", gameweek.id)
          .eq("player_id", captain.player_id);
        await supabase
          .from("gameweek_squads")
          .update({ is_captain: true, is_vice_captain: false })
          .eq("squad_id", squadId)
          .eq("gameweek_id", gameweek.id)
          .eq("player_id", vize.player_id);
        captainSwaps++;
      }

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

  // Preisanstieg: Rating >= Schwelle an diesem UND dem vorherigen Spieltag
  // → +0.3 Mio. Läuft erst nach Rundenende, damit das Rating final ist.
  // price_changes hält je Spieler und Runde höchstens einen Eintrag — der
  // Schritt ist dadurch beliebig wiederholbar, ohne doppelt zu erhöhen.
  let priceRises = 0;
  if (offeneSpiele === 0 && liveSpiele === 0 && beendeteSpiele > 0) {
    const vorherigeRunde = (alleGws ?? []).find((g) => g.number === gameweek.number - 1);
    // Spieltag 1 zaehlt nicht in Bewertungspaare (PREIS_AB_SPIELTAG):
    // er lag vor dem Beitritt der Mitglieder und steckt schon in den
    // Startpreisen. Erstes Paar ist damit 2+3.
    if (vorherigeRunde && vorherigeRunde.number >= PREIS_AB_SPIELTAG) {
      const [{ data: aktuelleTop }, { data: vorherigeTop }, { data: aktuelleTief }, { data: vorherigeTief }] =
        await Promise.all([
          supabase
            .from("player_stats")
            .select("player_id")
            .eq("gameweek_id", gameweek.id)
            .gte("rating", PREIS_RATING_SCHWELLE),
          supabase
            .from("player_stats")
            .select("player_id")
            .eq("gameweek_id", vorherigeRunde.id)
            .gte("rating", PREIS_RATING_SCHWELLE),
          // Schwach nur, wer gespielt UND ein Rating unter der Schwelle hat —
          // wer gar nicht zum Einsatz kam (rating NULL), fällt nicht darunter.
          supabase
            .from("player_stats")
            .select("player_id")
            .eq("gameweek_id", gameweek.id)
            .lt("rating", PREIS_SENKUNG_SCHWELLE),
          supabase
            .from("player_stats")
            .select("player_id")
            .eq("gameweek_id", vorherigeRunde.id)
            .lt("rating", PREIS_SENKUNG_SCHWELLE),
        ]);

      // Je Spieler und Runde genau eine Preisbewegung; das Vorzeichen von
      // delta unterscheidet Anstieg und Senkung.
      const bewegungen: { playerId: number; delta: number }[] = [];
      const topVorher = new Set((vorherigeTop ?? []).map((r) => r.player_id));
      for (const r of aktuelleTop ?? []) {
        if (topVorher.has(r.player_id)) bewegungen.push({ playerId: r.player_id, delta: PREIS_ANSTIEG });
      }
      const tiefVorher = new Set((vorherigeTief ?? []).map((r) => r.player_id));
      for (const r of aktuelleTief ?? []) {
        if (tiefVorher.has(r.player_id)) bewegungen.push({ playerId: r.player_id, delta: -PREIS_SENKUNG });
      }

      for (const b of bewegungen) {
        const { data: spieler } = await supabase
          .from("players")
          .select("price")
          .eq("id", b.playerId)
          .single();
        if (!spieler) continue;
        const alt = Number(spieler.price);
        const neu = Math.max(PREIS_MINIMUM, Math.round((alt + b.delta) * 10) / 10);
        if (neu === alt) continue; // schon am Minimum — keine Bewegung buchen
        // Insert schlägt fehl, wenn für diese Runde schon gebucht wurde
        // (unique) oder die Migration noch fehlt — beides: überspringen.
        const { error: insertError } = await supabase
          .from("price_changes")
          .insert({ player_id: b.playerId, gameweek_id: gameweek.id, delta: neu - alt });
        if (insertError) continue;
        await supabase.from("players").update({ price: neu }).eq("id", b.playerId);
        priceRises++;
      }
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
      // Von Hand terminierte Partien nicht in ihre alte Runde zurückziehen.
      if (manuelleRunde.has(fixture.fixture.id)) continue;
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
          manual_schedule: false,
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
    captainSwaps,
    priceRises,
    deadlinesAdjusted,
  });
}
