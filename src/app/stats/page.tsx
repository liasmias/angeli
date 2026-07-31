import { createClient } from "@/lib/supabase/server";
import { shortenPlayerName } from "@/lib/player-name";
import StatsTable, { type StatsRow } from "./StatsTable";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";

export default async function StatsPage() {
  const supabase = await createClient();
  const lang = await getLang();
  const t = getDictionary(lang).stats;

  const [{ data: players }, { data: points }, { data: gameweeks }, { data: ratingRows }] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, position, price, clubs(name, short_name)")
      .eq("is_active", true),
    supabase.from("fantasy_points").select("player_id, gameweek_id, points, breakdown"),
    supabase.from("gameweeks").select("id, number").order("number", { ascending: false }),
    supabase.from("player_stats").select("player_id, rating, goals, assists, minutes, goals_conceded"),
  ]);

  const latestGameweekWithPoints = (gameweeks ?? []).find((gw) =>
    (points ?? []).some((p) => p.gameweek_id === gw.id)
  );

  // Durchschnittliches Rating ueber alle Spieltage, in denen es eines gab —
  // dazu Saisonsummen fuer Tore und Assists.
  const ratingSumme = new Map<number, { summe: number; anzahl: number }>();
  const toreSumme = new Map<number, number>();
  const assistsSumme = new Map<number, number>();
  const zuNullSumme = new Map<number, number>();
  for (const r of ratingRows ?? []) {
    toreSumme.set(r.player_id, (toreSumme.get(r.player_id) ?? 0) + (r.goals ?? 0));
    assistsSumme.set(r.player_id, (assistsSumme.get(r.player_id) ?? 0) + (r.assists ?? 0));
    // Zu-null wie im Regelwerk: ab 60 Minuten ohne Gegentor.
    if ((r.minutes ?? 0) >= 60 && (r.goals_conceded ?? 0) === 0) {
      zuNullSumme.set(r.player_id, (zuNullSumme.get(r.player_id) ?? 0) + 1);
    }
    if (r.rating === null) continue;
    const e = ratingSumme.get(r.player_id) ?? { summe: 0, anzahl: 0 };
    ratingSumme.set(r.player_id, { summe: e.summe + Number(r.rating), anzahl: e.anzahl + 1 });
  }

  const totalsByPlayer = new Map<number, number>();
  const latestByPlayer = new Map<number, number>();
  const bonusByPlayer = new Map<number, number>();
  for (const p of points ?? []) {
    totalsByPlayer.set(p.player_id, (totalsByPlayer.get(p.player_id) ?? 0) + p.points);
    const b = Number((p.breakdown as Record<string, number> | null)?.bonus ?? 0);
    if (b) bonusByPlayer.set(p.player_id, (bonusByPlayer.get(p.player_id) ?? 0) + b);
    if (latestGameweekWithPoints && p.gameweek_id === latestGameweekWithPoints.id) {
      latestByPlayer.set(p.player_id, p.points);
    }
  }

  const rows: StatsRow[] = (players ?? []).map((p) => {
    const club = Array.isArray(p.clubs) ? p.clubs[0] : p.clubs;
    return {
      id: p.id,
      name: shortenPlayerName(p.first_name, p.last_name),
      position: p.position,
      price: Number(p.price),
      club: club?.short_name ?? club?.name ?? "—",
      totalPoints: totalsByPlayer.get(p.id) ?? 0,
      latestPoints: latestByPlayer.get(p.id) ?? null,
      goals: toreSumme.get(p.id) ?? 0,
      assists: assistsSumme.get(p.id) ?? 0,
      bonus: bonusByPlayer.get(p.id) ?? 0,
      // Nur für Torhüter und Verteidiger — bei anderen Positionen zählt
      // die Wertung nicht, die Spalte zeigt dort einen Strich.
      cleanSheets:
        p.position === "GK" || p.position === "DEF" ? (zuNullSumme.get(p.id) ?? 0) : null,
      rating: (() => {
        const e = ratingSumme.get(p.id);
        return e ? e.summe / e.anzahl : null;
      })(),
    };
  });

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">{t.title}</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        {latestGameweekWithPoints ? t.introAfter(latestGameweekWithPoints.number) : t.introEmpty}
      </p>
      <StatsTable rows={rows} latestGameweekNumber={latestGameweekWithPoints?.number ?? null} lang={lang} />
    </main>
  );
}
