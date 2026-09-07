import { createClient } from "@/lib/supabase/server";
import { shortenPlayerName } from "@/lib/player-name";
import StatsTable, { type StatsRow } from "./StatsTable";
import { getLang } from "@/lib/lang";
import { getOwnershipPercent } from "@/lib/ownership";
import { getDictionary } from "@/lib/i18n";
import { alleZeilen } from "@/lib/supabase/paginate";

export default async function StatsPage() {
  const supabase = await createClient();
  const lang = await getLang();
  const t = getDictionary(lang).stats;

  // fantasy_points und player_stats wachsen um rund 230 Zeilen je Spieltag und
  // haben das Zeilenlimit von PostgREST inzwischen gerissen (1469 Zeilen). Ohne
  // Seitenabruf fehlte still der jüngste Spieltag — genau die Spalte, die
  // niemandem auffiel, weil die Saisonsummen ja plausibel blieben.
  const [{ data: players }, points, { data: gameweeks }, ratingRows, ownership] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, position, price, clubs(name, short_name)")
      .eq("is_active", true),
    alleZeilen<{
      player_id: number;
      gameweek_id: number;
      points: number;
      breakdown: Record<string, number> | null;
    }>((von, bis) =>
      supabase.from("fantasy_points").select("player_id, gameweek_id, points, breakdown").range(von, bis)
    ),
    supabase.from("gameweeks").select("id, number").order("number", { ascending: false }),
    alleZeilen<{
      player_id: number;
      gameweek_id: number;
      rating: number | null;
      goals: number | null;
      assists: number | null;
      minutes: number | null;
      goals_conceded: number | null;
    }>((von, bis) =>
      supabase
        .from("player_stats")
        .select("player_id, gameweek_id, rating, goals, assists, minutes, goals_conceded")
        .range(von, bis)
    ),
    getOwnershipPercent(),
  ]);

  // Preisbewegung seit Saisonstart — FPL zeigt sie direkt neben dem Preis,
  // weil sie mitentscheidet, ob ein Transfer sich noch lohnt.
  const { data: preisRows } = await supabase.from("price_changes").select("player_id, delta");
  const preisDelta = new Map<number, number>();
  for (const r of preisRows ?? []) {
    preisDelta.set(r.player_id, (preisDelta.get(r.player_id) ?? 0) + Number(r.delta));
  }

  const latestGameweekWithPoints = (gameweeks ?? []).find((gw) =>
    points.some((p) => p.gameweek_id === gw.id)
  );

  // Durchschnittliches Rating ueber alle Spieltage, in denen es eines gab —
  // dazu Saisonsummen fuer Tore und Assists.
  const ratingSumme = new Map<number, { summe: number; anzahl: number }>();
  const toreSumme = new Map<number, number>();
  const assistsSumme = new Map<number, number>();
  const zuNullSumme = new Map<number, number>();
  const minutenSumme = new Map<number, number>();
  for (const r of ratingRows) {
    minutenSumme.set(r.player_id, (minutenSumme.get(r.player_id) ?? 0) + (r.minutes ?? 0));
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

  // Form wie bei FPL: der Schnitt der jüngsten Spieltage statt der Saisonsumme.
  // FPL rechnet über 30 Tage, was dort rund vier Runden sind — hier direkt vier
  // Runden, damit die Zahl unabhängig vom Spielplan vergleichbar bleibt.
  const FORM_RUNDEN = 4;
  // Nur Runden, die schon gewertet sind. `gameweeks` ist absteigend sortiert und
  // beginnt deshalb mit den noch kommenden Spieltagen — ohne diesen Filter
  // bestünde das Fenster ausschliesslich aus Runden ohne einen einzigen Punkt.
  const gespielteIds = new Set(points.map((p) => p.gameweek_id));
  const formIds = new Set(
    (gameweeks ?? []).filter((g) => gespielteIds.has(g.id)).slice(0, FORM_RUNDEN).map((g) => g.id)
  );
  const formSumme = new Map<number, { summe: number; anzahl: number }>();

  const totalsByPlayer = new Map<number, number>();
  const latestByPlayer = new Map<number, number>();
  const bonusByPlayer = new Map<number, number>();
  for (const p of points) {
    totalsByPlayer.set(p.player_id, (totalsByPlayer.get(p.player_id) ?? 0) + p.points);
    const b = Number(p.breakdown?.bonus ?? 0);
    if (b) bonusByPlayer.set(p.player_id, (bonusByPlayer.get(p.player_id) ?? 0) + b);
    if (formIds.has(p.gameweek_id)) {
      const e = formSumme.get(p.player_id) ?? { summe: 0, anzahl: 0 };
      formSumme.set(p.player_id, { summe: e.summe + p.points, anzahl: e.anzahl + 1 });
    }
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
      owned: ownership.get(p.id) ?? 0,
      minutes: minutenSumme.get(p.id) ?? 0,
      priceDelta: preisDelta.get(p.id) ?? 0,
      form: (() => {
        const e = formSumme.get(p.id);
        return e && e.anzahl > 0 ? e.summe / e.anzahl : null;
      })(),
      // Punkte je Mio. — bei FPL der Massstab dafür, ob ein Spieler sein Geld
      // wert ist. Ohne Punkte bleibt die Spalte leer statt auf 0 zu fallen.
      valuePerMillion: (() => {
        const gesamt = totalsByPlayer.get(p.id) ?? 0;
        const preis = Number(p.price);
        return gesamt > 0 && preis > 0 ? gesamt / preis : null;
      })(),
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
