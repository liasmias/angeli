import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGameweekPoints, getRank } from "@/lib/gameweek-summary";
import { shortenPlayerName } from "@/lib/player-name";
import GameweekNav from "@/app/team/GameweekNav";
import PastGameweek, { type PastPlayer } from "@/app/team/PastGameweek";

/**
 * Kader eines anderen Mitglieds ansehen.
 *
 * Bewusst nur für abgeschlossene Spieltage: Wäre die laufende Aufstellung
 * sichtbar, könnte man vor der Deadline einfach die Teams der Konkurrenz
 * abschreiben.
 */
export default async function SquadPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ gw?: string }>;
}) {
  const [{ username: rawUsername }, { gw }] = await Promise.all([params, searchParams]);
  const username = decodeURIComponent(rawUsername);
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, is_blocked")
    .eq("username", username)
    .maybeSingle();

  if (!profile || profile.is_blocked) notFound();

  const [{ data: squad }, { data: allGameweeks }] = await Promise.all([
    supabase.from("squads").select("id").eq("user_id", profile.id).single(),
    supabase.from("gameweeks").select("id, number, deadline, is_locked").order("number"),
  ]);
  if (!squad) notFound();

  const jetzt = Date.now();
  // Nur Spieltage, deren Deadline durch ist — die laufende Aufstellung bleibt geheim.
  const abgeschlossen = (allGameweeks ?? []).filter(
    (g) => g.is_locked || new Date(g.deadline).getTime() <= jetzt
  );

  const { data: snapshotGws } = await supabase
    .from("gameweek_squads")
    .select("gameweek_id")
    .eq("squad_id", squad.id);
  const mitAufstellung = new Set((snapshotGws ?? []).map((r) => r.gameweek_id));
  const verfuegbar = abgeschlossen.filter((g) => mitAufstellung.has(g.id));

  if (verfuegbar.length === 0) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <Link href="/leaderboard" className="text-sm font-semibold text-brand-magenta">
          ← Zurück zur Rangliste
        </Link>
        <h1 className="mb-4 mt-2 text-2xl font-bold tracking-tight text-brand-deep">
          {profile.username}
        </h1>
        <p className="rounded-lg bg-brand-deep/5 px-4 py-6 text-center text-sm text-brand-deep/60">
          Von {profile.username} ist noch keine Aufstellung öffentlich — Teams werden erst nach
          der Deadline des jeweiligen Spieltags sichtbar.
        </p>
      </main>
    );
  }

  const gewuenscht = gw ? Number(gw) : null;
  const angezeigt =
    (gewuenscht !== null ? verfuegbar.find((g) => g.number === gewuenscht) : undefined) ??
    verfuegbar[verfuegbar.length - 1];

  const idx = verfuegbar.findIndex((g) => g.id === angezeigt.id);
  const prevGameweek = idx > 0 ? verfuegbar[idx - 1].number : null;
  const nextGameweek = idx < verfuegbar.length - 1 ? verfuegbar[idx + 1].number : null;

  // Live-Phase: Deadline vorbei, aber noch nicht alle Partien beendet.
  const BEENDET = new Set(["FT", "AET", "PEN"]);
  const { data: fx } = await supabase
    .from("fixtures")
    .select("status")
    .eq("gameweek_id", angezeigt.id);
  const isLive = (fx ?? []).length > 0 && (fx ?? []).some((f) => !BEENDET.has(f.status ?? ""));

  const [punkte, rangInfo, { data: snapshot }, { data: chips }] = await Promise.all([
    getGameweekPoints(supabase, squad.id, angezeigt.id),
    getRank(supabase, profile.id),
    supabase
      .from("gameweek_squads")
      .select(
        "player_id, is_starting, is_captain, points_earned, players(first_name, last_name, position, clubs(short_name, name))"
      )
      .eq("squad_id", squad.id)
      .eq("gameweek_id", angezeigt.id),
    supabase
      .from("chip_usages")
      .select("chip")
      .eq("squad_id", squad.id)
      .eq("gameweek_id", angezeigt.id),
  ]);

  const players: PastPlayer[] = (snapshot ?? []).map((r) => {
    const p = Array.isArray(r.players) ? r.players[0] : r.players;
    const club = p ? (Array.isArray(p.clubs) ? p.clubs[0] : p.clubs) : null;
    return {
      playerId: r.player_id,
      name: p ? shortenPlayerName(p.first_name, p.last_name) : "?",
      club: club?.short_name ?? club?.name ?? "—",
      position: p?.position ?? "MID",
      isStarting: r.is_starting,
      isCaptain: r.is_captain,
      pointsEarned: r.points_earned,
    };
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/leaderboard" className="text-sm font-semibold text-brand-magenta">
        ← Zurück zur Rangliste
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold tracking-tight text-brand-deep">
        {profile.username}
      </h1>
      <GameweekNav
        username={profile.username}
        gameweekNumber={angezeigt.number}
        isPast
        isLive={isLive}
        deadline={angezeigt.deadline}
        points={punkte}
        totalPoints={rangInfo.totalPoints}
        rank={rangInfo.rank}
        participants={rangInfo.participants}
        prevGameweek={prevGameweek}
        nextGameweek={nextGameweek}
        basePath={`/squad/${encodeURIComponent(profile.username)}`}
      />
      <PastGameweek
        players={players}
        benchBoost={(chips ?? []).some((c) => c.chip === "bench_boost")}
        wildcard={(chips ?? []).some((c) => c.chip === "wildcard")}
      />
    </main>
  );
}
