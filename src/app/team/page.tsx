import { createClient } from "@/lib/supabase/server";
import { getTransferBudget } from "@/lib/transfers";
import { getGameweekPoints, getRank } from "@/lib/gameweek-summary";
import { shortenPlayerName } from "@/lib/player-name";
import GameweekNav from "./GameweekNav";
import PastGameweek, { type PastPlayer } from "./PastGameweek";
import TeamBuilder, { type PlayerOption, type SquadPick } from "./TeamBuilder";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";
import { loadPlayerDetails } from "@/lib/player-detail";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ gw?: string }>;
}) {
  const { gw } = await searchParams;
  const supabase = await createClient();
  const lang = await getLang();
  const t = getDictionary(lang);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // proxy.ts already guards this route; this is just a defensive fallback.
    return <main className="p-6">Bitte einloggen.</main>;
  }

  const [{ data: settings }, { data: squad }, { data: profile }, { data: allGameweeks }] =
    await Promise.all([
      supabase.from("league_settings").select("*").eq("id", 1).single(),
      supabase.from("squads").select("id, free_transfers_remaining").eq("user_id", user.id).single(),
      supabase.from("profiles").select("username").eq("id", user.id).single(),
      supabase.from("gameweeks").select("id, number, deadline, is_locked").order("number"),
    ]);

  if (!settings || !squad) {
    return <main className="p-6">Konnte Team-Daten nicht laden. Ist das Schema aufgesetzt?</main>;
  }

  const gameweeks = allGameweeks ?? [];
  const jetzt = Date.now();
  const istOffen = (g: (typeof gameweeks)[number]) =>
    !g.is_locked && new Date(g.deadline).getTime() > jetzt;

  const offenerSpieltag = gameweeks.find(istOffen) ?? null;

  // Läuft gerade eine Runde? Deadline vorbei, aber noch nicht alle Partien
  // beendet — dann ist DAS die Ansicht, die alle sehen wollen (Live-Punkte),
  // nicht die Planung der Folgerunde.
  const BEENDET = new Set(["FT", "AET", "PEN"]);
  const letzteVergangene = [...gameweeks]
    .reverse()
    .find((g) => new Date(g.deadline).getTime() <= jetzt);
  let laufenderSpieltag: (typeof gameweeks)[number] | null = null;
  if (letzteVergangene) {
    const { data: fx } = await supabase
      .from("fixtures")
      .select("status")
      .eq("gameweek_id", letzteVergangene.id);
    if ((fx ?? []).length > 0 && (fx ?? []).some((f) => !BEENDET.has(f.status ?? ""))) {
      laufenderSpieltag = letzteVergangene;
    }
  }

  // Angezeigt wird: der per ?gw= gewählte Spieltag, sonst die laufende Runde,
  // sonst der offene.
  const gewuenschteNummer = gw ? Number(gw) : null;
  const angezeigt =
    (gewuenschteNummer !== null
      ? gameweeks.find((g) => g.number === gewuenschteNummer)
      : undefined) ??
    laufenderSpieltag ??
    offenerSpieltag ??
    // Kein offener Spieltag mehr (Saisonende): den letzten zeigen.
    gameweeks[gameweeks.length - 1] ??
    null;

  if (!angezeigt) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-brand-deep">{t.team.title}</h1>
        <p className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          Noch keine Spieltage angelegt — ein Admin muss sie zuerst erfassen.
        </p>
      </main>
    );
  }

  const bearbeitbar = istOffen(angezeigt);

  // Nur Spieltage anbieten, die auch etwas zu zeigen haben: vergangene mit
  // gespeicherter Aufstellung, plus der aktuell offene.
  const { data: snapshotGws } = await supabase
    .from("gameweek_squads")
    .select("gameweek_id")
    .eq("squad_id", squad.id);
  const mitAufstellung = new Set((snapshotGws ?? []).map((r) => r.gameweek_id));
  const navigierbar = gameweeks.filter(
    (g) =>
      mitAufstellung.has(g.id) ||
      (offenerSpieltag && g.id === offenerSpieltag.id) ||
      (laufenderSpieltag && g.id === laufenderSpieltag.id)
  );
  const idx = navigierbar.findIndex((g) => g.id === angezeigt.id);
  const prevGameweek = idx > 0 ? navigierbar[idx - 1].number : null;
  const nextGameweek = idx >= 0 && idx < navigierbar.length - 1 ? navigierbar[idx + 1].number : null;

  const [punkte, rangInfo] = await Promise.all([
    getGameweekPoints(supabase, squad.id, angezeigt.id),
    getRank(supabase, user.id),
  ]);

  const nav = (
    <GameweekNav
      lang={lang}
      username={profile?.username ?? t.team.title}
      gameweekNumber={angezeigt.number}
      isPast={!bearbeitbar}
      isLive={laufenderSpieltag?.id === angezeigt.id}
      deadline={angezeigt.deadline}
      points={punkte}
      totalPoints={rangInfo.totalPoints}
      rank={rangInfo.rank}
      participants={rangInfo.participants}
      prevGameweek={prevGameweek}
      nextGameweek={nextGameweek}
    />
  );

  // ---------- Vergangener Spieltag: nur ansehen ----------
  if (!bearbeitbar) {
    const [{ data: snapshot }, { data: chips }] = await Promise.all([
      supabase
        .from("gameweek_squads")
        .select(
          "player_id, is_starting, is_captain, is_vice_captain, points_earned, bench_order, auto_subbed, players(first_name, last_name, position, clubs(short_name, name))"
        )
        .eq("squad_id", squad.id)
        .eq("gameweek_id", angezeigt.id),
      supabase
        .from("chip_usages")
        .select("chip")
        .eq("squad_id", squad.id)
        .eq("gameweek_id", angezeigt.id),
    ]);

    const details = await loadPlayerDetails(
      supabase,
      angezeigt.id,
      (snapshot ?? []).map((r) => r.player_id)
    );

    const pastPlayers: PastPlayer[] = (snapshot ?? []).map((r) => {
      const p = Array.isArray(r.players) ? r.players[0] : r.players;
      const club = p ? (Array.isArray(p.clubs) ? p.clubs[0] : p.clubs) : null;
      return {
        playerId: r.player_id,
        name: p ? shortenPlayerName(p.first_name, p.last_name) : "?",
        club: club?.short_name ?? club?.name ?? "—",
        position: p?.position ?? "MID",
        isStarting: r.is_starting,
        isCaptain: r.is_captain,
        isViceCaptain: r.is_vice_captain,
        pointsEarned: r.points_earned,
        benchOrder: r.bench_order,
        autoSubbed: r.auto_subbed,
        detail: details[r.player_id],
      };
    });

    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-brand-deep">{t.team.title}</h1>
        {nav}
        {pastPlayers.length === 0 ? (
          <p className="rounded-lg bg-brand-deep/5 px-4 py-6 text-center text-sm text-brand-deep/60">
            {t.team.noLineup(angezeigt.number)}
          </p>
        ) : (
          <PastGameweek
            lang={lang}
            gameweekNumber={angezeigt.number}
            players={pastPlayers}
            benchBoost={(chips ?? []).some((c) => c.chip === "bench_boost")}
            wildcard={(chips ?? []).some((c) => c.chip === "wildcard")}
          />
        )}
      </main>
    );
  }

  // ---------- Offener Spieltag: bearbeiten ----------
  const [{ data: players }, { data: pointRows }, { data: squadPlayers }, { data: chipRows }, { data: gwFixtures }] =
    await Promise.all([
      supabase
        .from("players")
        .select("id, first_name, last_name, position, price, is_active, club_id, clubs(name, short_name)")
        .eq("is_active", true)
        .order("position")
        .order("price", { ascending: false }),
      supabase.from("fantasy_points").select("player_id, points"),
      supabase
        .from("squad_players")
        .select("player_id, is_starting, is_captain, is_vice_captain, purchase_price")
        .eq("squad_id", squad.id),
      supabase.from("chip_usages").select("chip, gameweek_id, gameweeks(number)").eq("squad_id", squad.id),
      supabase
        .from("fixtures")
        .select(
          "home_club_id, away_club_id, home:clubs!fixtures_home_club_id_fkey(short_name), away:clubs!fixtures_away_club_id_fkey(short_name)"
        )
        .eq("gameweek_id", angezeigt.id),
    ]);

  const totalPointsByPlayer = new Map<number, number>();
  for (const row of pointRows ?? []) {
    totalPointsByPlayer.set(row.player_id, (totalPointsByPlayer.get(row.player_id) ?? 0) + row.points);
  }

  // Gegner des kommenden Spieltags pro Verein — (H)eim oder (A)uswärts.
  const opponentByClub = new Map<number, string>();
  for (const f of gwFixtures ?? []) {
    const home = Array.isArray(f.home) ? f.home[0] : f.home;
    const away = Array.isArray(f.away) ? f.away[0] : f.away;
    if (f.home_club_id && away?.short_name) {
      opponentByClub.set(f.home_club_id, `${away.short_name} (H)`);
    }
    if (f.away_club_id && home?.short_name) {
      opponentByClub.set(f.away_club_id, `${home.short_name} (A)`);
    }
  }

  // Aus der Transferhistorie hergeleitet (inkl. angesparter Transfers) —
  // nicht aus einem Zählerfeld, das beim Speichern überschrieben werden kann.
  const budget = await getTransferBudget(supabase, squad.id, angezeigt, settings);

  const chipState = (["wildcard", "bench_boost"] as const).map((chip) => {
    const row = (chipRows ?? []).find((c) => c.chip === chip);
    const gwRow = row ? (Array.isArray(row.gameweeks) ? row.gameweeks[0] : row.gameweeks) : null;
    return {
      chip,
      activeNow: !!row && row.gameweek_id === angezeigt.id,
      usedInGameweek: row && row.gameweek_id !== angezeigt.id ? (gwRow?.number ?? null) : null,
    };
  });

  const playerOptions: PlayerOption[] = (players ?? []).map((p) => {
    const club = Array.isArray(p.clubs) ? p.clubs[0] : p.clubs;
    return {
      id: p.id,
      name: shortenPlayerName(p.first_name, p.last_name),
      position: p.position,
      price: Number(p.price),
      club: club?.short_name ?? club?.name ?? "—",
      points: totalPointsByPlayer.get(p.id) ?? 0,
      nextOpponent: p.club_id ? (opponentByClub.get(p.club_id) ?? null) : null,
    };
  });

  const initialSquad: SquadPick[] = (squadPlayers ?? []).map((sp) => ({
    playerId: sp.player_id,
    isStarting: sp.is_starting,
    isCaptain: sp.is_captain,
    isViceCaptain: sp.is_vice_captain,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-brand-deep">{t.team.title}</h1>
      {nav}
      <TeamBuilder
        lang={lang}
        players={playerOptions}
        initialSquad={initialSquad}
        settings={{
          budgetCap: Number(settings.budget_cap),
          squadSize: settings.squad_size,
          startingSize: settings.starting_size,
          gkSlots: settings.gk_slots,
          defSlots: settings.def_slots,
          midSlots: settings.mid_slots,
          fwdSlots: settings.fwd_slots,
        }}
        gameweekOpen
        gameweekNumber={angezeigt.number}
        deadline={angezeigt.deadline}
        freeTransfers={budget.freeAvailable}
        transfersUsed={budget.usedThisGameweek}
        unlimitedTransfers={budget.unlimited}
        extraTransferCost={settings.extra_transfer_cost}
        chips={chipState}
      />
    </main>
  );
}
