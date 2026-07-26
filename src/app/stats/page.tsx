import { createClient } from "@/lib/supabase/server";
import StatsTable, { type StatsRow } from "./StatsTable";

export default async function StatsPage() {
  const supabase = await createClient();

  const [{ data: players }, { data: points }, { data: gameweeks }] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, position, price, clubs(name, short_name)")
      .eq("is_active", true),
    supabase.from("fantasy_points").select("player_id, gameweek_id, points"),
    supabase.from("gameweeks").select("id, number").order("number", { ascending: false }),
  ]);

  const latestGameweekWithPoints = (gameweeks ?? []).find((gw) =>
    (points ?? []).some((p) => p.gameweek_id === gw.id)
  );

  const totalsByPlayer = new Map<number, number>();
  const latestByPlayer = new Map<number, number>();
  for (const p of points ?? []) {
    totalsByPlayer.set(p.player_id, (totalsByPlayer.get(p.player_id) ?? 0) + p.points);
    if (latestGameweekWithPoints && p.gameweek_id === latestGameweekWithPoints.id) {
      latestByPlayer.set(p.player_id, p.points);
    }
  }

  const rows: StatsRow[] = (players ?? []).map((p) => {
    const club = Array.isArray(p.clubs) ? p.clubs[0] : p.clubs;
    return {
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      position: p.position,
      price: Number(p.price),
      club: club?.short_name ?? club?.name ?? "—",
      totalPoints: totalsByPlayer.get(p.id) ?? 0,
      latestPoints: latestByPlayer.get(p.id) ?? null,
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Statistiken</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        {latestGameweekWithPoints
          ? `Punkte aller Spieler — Stand nach Spieltag ${latestGameweekWithPoints.number}.`
          : "Sobald der erste Spieltag synchronisiert ist, erscheinen hier die Punkte aller Spieler."}
      </p>
      <StatsTable rows={rows} latestGameweekNumber={latestGameweekWithPoints?.number ?? null} />
    </main>
  );
}
