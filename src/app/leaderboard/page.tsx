import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";
import LeaderboardTable, { type StandingRow } from "./LeaderboardTable";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string; gw?: string }>;
}) {
  const { ansicht, gw } = await searchParams;
  const supabase = await createClient();
  const [{ data: standings }, { data: gameweeks }, { data: fixtures }, lang] = await Promise.all([
    supabase.from("standings").select("*"),
    supabase.from("gameweeks").select("id, number, deadline, is_locked").order("number"),
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

  // ---------- Spieltags-Ranking ----------
  //
  // Punkte einer Runde = Gesamtstand nach der Runde minus Gesamtstand davor.
  // Damit gelten exakt die Regeln der Gesamtwertung — Kapitän, Bench Boost,
  // Transferabzüge, Wildcard — und die beiden Ansichten können nie
  // voneinander abweichen.
  //
  // Manuelle Punktkorrekturen bleiben hier draussen: Ein "Startbonus
  // Spieltag 3" von +37 ist nicht auf dem Platz erspielt und würde sonst den
  // Spieltagssieger jener Runde bestimmen. In der Gesamtwertung zählen sie
  // weiterhin.
  //
  // Auswählbar sind alle gesperrten Runden, also auch die laufende — dann
  // ist es ein Live-Ranking des Spieltags.
  const auswaehlbar = (gameweeks ?? []).filter((g) => g.is_locked).map((g) => g.number);
  const spieltagsAnsicht = ansicht === "spieltag" && auswaehlbar.length > 0;
  if (spieltagsAnsicht) {
    const gewuenscht = Number(gw);
    const runde = auswaehlbar.includes(gewuenscht) ? gewuenscht : auswaehlbar[auswaehlbar.length - 1];
    const rundeId = (gameweeks ?? []).find((g) => g.number === runde)?.id;

    const [{ data: nach }, { data: vor }, { data: teilnahme }, { data: kader }, { data: korrekturen }] =
      await Promise.all([
        supabase.rpc("standings_at", { p_gameweek: runde }),
        runde > 1
          ? supabase.rpc("standings_at", { p_gameweek: runde - 1 })
          : Promise.resolve({ data: [] as { user_id: string; total_points: number }[] }),
        // Wer in der Runde dabei war: je Kader genau ein Kapitän — eine Zeile
        // statt fünfzehn, sonst stösst die Abfrage an das Zeilenlimit.
        supabase
          .from("gameweek_squads")
          .select("squad_id")
          .eq("gameweek_id", rundeId ?? -1)
          .eq("is_captain", true),
        supabase.from("squads").select("id, user_id"),
        supabase.from("point_adjustments").select("squad_id, points, created_at"),
      ]);

    const userVonKader = new Map((kader ?? []).map((k) => [k.id, k.user_id]));
    const dabeiJetzt = new Set(
      (teilnahme ?? []).map((t) => userVonKader.get(t.squad_id)).filter(Boolean) as string[]
    );

    // Korrekturen derselben Runde zuordnen wie standings_at: erste Runde,
    // deren Deadline nach dem Eintrag liegt, sonst die letzte.
    const sortiert = [...(gameweeks ?? [])].sort((a, b) => a.number - b.number);
    const rundeVon = (zeit: string) =>
      sortiert.find((g) => g.deadline && new Date(g.deadline) > new Date(zeit))?.number ??
      sortiert[sortiert.length - 1]?.number;
    const korrekturJeUser = new Map<string, number>();
    for (const k of korrekturen ?? []) {
      if (rundeVon(k.created_at) !== runde) continue;
      const user = userVonKader.get(k.squad_id);
      if (!user) continue;
      korrekturJeUser.set(user, (korrekturJeUser.get(user) ?? 0) + k.points);
    }

    const vorher = new Map((vor ?? []).map((r) => [r.user_id, Number(r.total_points)]));
    const runden = (nach ?? [])
      .filter((r) => dabeiJetzt.has(r.user_id))
      .map((r) => ({
        user_id: r.user_id,
        username: r.username,
        punkte:
          Number(r.total_points) - (vorher.get(r.user_id) ?? 0) - (korrekturJeUser.get(r.user_id) ?? 0),
      }))
      .sort((a, b) => b.punkte - a.punkte || a.username.localeCompare(b.username));

    const zeilen: StandingRow[] = runden.map((r) => ({
      user_id: r.user_id,
      username: r.username,
      total_points: r.punkte,
      // Geteilter Rang: punktgleiche Teams teilen sich den Platz.
      rank: runden.filter((x) => x.punkte > r.punkte).length + 1,
      movement: null,
    }));

    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">{t.title}</h1>
        <AnsichtUmschalter t={t} spieltag />
        <p className="mb-3 text-sm text-brand-deep/70">{t.gwIntro(runde)}</p>
        <nav aria-label={t.gwPick} className="-mx-6 mb-6 overflow-x-auto px-6">
          <div className="flex gap-1.5">
            {[...auswaehlbar].reverse().map((n) => (
              <Link
                key={n}
                href={`/leaderboard?ansicht=spieltag&gw=${n}`}
                aria-current={n === runde ? "page" : undefined}
                className={`pressable-subtle shrink-0 fase-knopf px-3 py-1 text-xs font-bold tabular-nums ${
                  n === runde
                    ? "bg-brand-deep text-brand-accent"
                    : "bg-brand-deep/5 text-brand-deep/70 hover:bg-brand-deep/10"
                }`}
              >
                GW {n}
              </Link>
            ))}
          </div>
        </nav>
        <LeaderboardTable rows={zeilen} lang={lang} />
      </main>
    );
  }

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
      <AnsichtUmschalter t={t} spieltag={false} zeigen={auswaehlbar.length > 0} />
      <p className="mb-1 text-sm text-brand-deep/70">{t.intro}</p>
      {vorletzte !== null && letzte !== null && (
        <p className="mb-6 text-sm text-brand-deep/65">{t.movementHint(letzte, vorletzte)}</p>
      )}
      <LeaderboardTable rows={rows} lang={lang} />
    </main>
  );
}

/** Umschalter Gesamt / Spieltag — als Links, damit die Ansicht teilbar ist. */
function AnsichtUmschalter({
  t,
  spieltag,
  zeigen = true,
}: {
  t: ReturnType<typeof getDictionary>["leaderboard"];
  spieltag: boolean;
  zeigen?: boolean;
}) {
  if (!zeigen) return null;
  const klasse = (aktiv: boolean) =>
    `pressable-subtle flex-1 fase-knopf px-4 py-1.5 text-center text-sm font-bold ${
      aktiv ? "bg-brand-deep text-brand-accent" : "text-brand-deep/70 hover:text-brand-deep"
    }`;
  return (
    <div className="my-4 flex fase-knopf bg-brand-deep/5 p-1">
      <Link href="/leaderboard" aria-current={!spieltag ? "page" : undefined} className={klasse(!spieltag)}>
        {t.viewTotal}
      </Link>
      <Link
        href="/leaderboard?ansicht=spieltag"
        aria-current={spieltag ? "page" : undefined}
        className={klasse(spieltag)}
      >
        {t.viewGameweek}
      </Link>
    </div>
  );
}
