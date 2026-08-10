import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";
import LeaderboardTable, { type StandingRow } from "./LeaderboardTable";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const [{ data: standings }, { data: gameweeks }, { data: fixtures }, lang] = await Promise.all([
    supabase.from("standings").select("*"),
    supabase.from("gameweeks").select("id, number").order("number"),
    supabase.from("fixtures").select("gameweek_id, status"),
    getLang(),
  ]);
  const t = getDictionary(lang).leaderboard;

  // Letzte vollständig gespielte Runde — nur zwischen zwei ausgewerteten
  // Spieltagen ist ein Vergleich aussagekräftig.
  const BEENDET = new Set(["FT", "AET", "PEN"]);
  const gespielt = (gameweeks ?? []).filter((g) => {
    const eigene = (fixtures ?? []).filter((f) => f.gameweek_id === g.id);
    return eigene.length > 0 && eigene.every((f) => BEENDET.has(f.status ?? ""));
  });
  const letzte = gespielt[gespielt.length - 1]?.number ?? null;
  const vorletzte = gespielt.length >= 2 ? gespielt[gespielt.length - 2].number : null;

  // Rangliste der Vorrunde für den Vergleich. Wer damals noch nicht dabei war,
  // bekommt keinen Pfeil — ein Sprung aus dem Nichts wäre keine Bewegung.
  let vorher = new Map<string, number>();
  let dabei = new Set<string>();
  if (vorletzte !== null) {
    const { data: alt } = await supabase.rpc("standings_at", { p_gameweek: vorletzte });
    const reihen = (alt ?? []).map((r) => ({ id: r.user_id, punkte: Number(r.total_points) }));
    vorher = new Map(
      reihen.map((r) => [r.id, reihen.filter((x) => x.punkte > r.punkte).length + 1])
    );
    const ids = (gameweeks ?? []).filter((g) => g.number <= vorletzte).map((g) => g.id);
    const { data: snaps } = await supabase
      .from("gameweek_squads")
      .select("squads(user_id)")
      .in("gameweek_id", ids)
      .limit(20000);
    for (const s of snaps ?? []) {
      const sq = Array.isArray(s.squads) ? s.squads[0] : s.squads;
      if (sq?.user_id) dabei.add(sq.user_id);
    }
  }

  // Die angezeigte Nummer nummeriert Gleichstände durch (1, 2, 3 …), der
  // Vergleich muss aber geteilte Ränge verwenden — sonst erzeugt die
  // willkürliche Reihenfolge punktgleicher Teams Scheinbewegungen.
  const punkteListe = (standings ?? []).map((r) => r.total_points ?? 0);
  const geteilterRang = (punkte: number) =>
    punkteListe.filter((p) => p > punkte).length + 1;

  const rows: StandingRow[] = (standings ?? []).map((row, i) => {
    const id = row.user_id ?? String(i);
    const punkte = row.total_points ?? 0;
    const alterRang = vorher.get(id);
    return {
      user_id: id,
      username: row.username ?? "?",
      total_points: punkte,
      rank: i + 1,
      // Positiv = Plätze gutgemacht. null, wenn kein Vergleich möglich ist.
      movement:
        alterRang !== undefined && dabei.has(id) ? alterRang - geteilterRang(punkte) : null,
    };
  });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">{t.title}</h1>
      <p className="mb-1 text-sm text-brand-deep/60">{t.intro}</p>
      {vorletzte !== null && letzte !== null && (
        <p className="mb-6 text-sm text-brand-deep/45">{t.movementHint(letzte, vorletzte)}</p>
      )}
      <LeaderboardTable rows={rows} lang={lang} />
    </main>
  );
}
