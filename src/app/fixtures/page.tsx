import { createClient } from "@/lib/supabase/server";
import { shortenPlayerName } from "@/lib/player-name";

const FINISHED = new Set(["FT", "AET", "PEN"]);

interface BestPlayer {
  name: string;
  points: number;
  goals: number;
  assists: number;
}

export default async function FixturesPage() {
  const supabase = await createClient();

  const [{ data: gameweeks }, { data: fixtures }, { data: stats }, { data: points }, { data: players }] =
    await Promise.all([
      supabase.from("gameweeks").select("id, number, deadline").order("number"),
      supabase
        .from("fixtures")
        .select("id, gameweek_id, kickoff, status, home_goals, away_goals, home:clubs!fixtures_home_club_id_fkey(name, short_name), away:clubs!fixtures_away_club_id_fkey(name, short_name)")
        .order("kickoff"),
      supabase.from("player_stats").select("player_id, fixture_id, gameweek_id, goals, assists"),
      supabase.from("fantasy_points").select("player_id, gameweek_id, points"),
      supabase.from("players").select("id, first_name, last_name"),
    ]);

  const nameById = new Map(
    (players ?? []).map((p) => [p.id, shortenPlayerName(p.first_name, p.last_name)])
  );
  const pointsByPlayerGw = new Map((points ?? []).map((p) => [`${p.player_id}:${p.gameweek_id}`, p.points]));

  const bestByFixture = new Map<number, BestPlayer[]>();
  for (const s of stats ?? []) {
    if (s.fixture_id === null) continue;
    const entry: BestPlayer = {
      name: nameById.get(s.player_id) ?? "?",
      points: pointsByPlayerGw.get(`${s.player_id}:${s.gameweek_id}`) ?? 0,
      goals: s.goals,
      assists: s.assists,
    };
    const list = bestByFixture.get(s.fixture_id) ?? [];
    list.push(entry);
    bestByFixture.set(s.fixture_id, list);
  }

  const now = Date.now();
  // Aktueller Spieltag zuoberst: der erste, dessen Deadline noch bevorsteht —
  // sonst der letzte. Danach absteigend sortiert die Vergangenheit, aufsteigend die Zukunft.
  const gws = gameweeks ?? [];
  const currentIndex = Math.max(
    0,
    gws.findIndex((g) => new Date(g.deadline).getTime() > now) === -1
      ? gws.length - 1
      : gws.findIndex((g) => new Date(g.deadline).getTime() > now) - 1
  );

  const ordered = [
    ...gws.slice(currentIndex),
    ...gws.slice(0, currentIndex).reverse(),
  ];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-brand-deep">Spielplan</h1>
      <div className="flex flex-col gap-6">
        {ordered.map((gw) => {
          const gwFixtures = (fixtures ?? []).filter((f) => f.gameweek_id === gw.id);
          if (gwFixtures.length === 0) return null;
          return (
            <section key={gw.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <h2 className="brand-gradient px-5 py-2.5 text-sm font-bold text-white">
                Spieltag {gw.number}
              </h2>
              <ul className="divide-y divide-brand-deep/5">
                {gwFixtures.map((f) => {
                  const home = Array.isArray(f.home) ? f.home[0] : f.home;
                  const away = Array.isArray(f.away) ? f.away[0] : f.away;
                  const finished = FINISHED.has(f.status);
                  const best = (bestByFixture.get(f.id) ?? [])
                    .filter((b) => b.points > 0)
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 6);
                  const scorers = (bestByFixture.get(f.id) ?? []).filter((b) => b.goals > 0);
                  const assisters = (bestByFixture.get(f.id) ?? []).filter((b) => b.assists > 0);

                  const matchRow = (
                    <div className="flex items-center gap-3 px-5 py-3">
                      <span className="flex-1 text-right font-semibold text-brand-deep">
                        {home?.name ?? "?"}
                      </span>
                      {finished ? (
                        <span className="rounded-lg bg-brand-deep px-3 py-1 font-bold tabular-nums text-brand-green">
                          {f.home_goals}:{f.away_goals}
                        </span>
                      ) : (
                        <span className="rounded-lg bg-brand-deep/5 px-3 py-1 text-xs font-semibold tabular-nums text-brand-deep/60">
                          {f.kickoff
                            ? new Date(f.kickoff).toLocaleString("de-CH", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      )}
                      <span className="flex-1 font-semibold text-brand-deep">
                        {away?.name ?? "?"}
                      </span>
                    </div>
                  );

                  if (!finished || best.length === 0) {
                    return <li key={f.id}>{matchRow}</li>;
                  }

                  return (
                    <li key={f.id}>
                      <details className="group">
                        <summary className="cursor-pointer list-none transition-colors hover:bg-brand-deep/5 [&::-webkit-details-marker]:hidden">
                          {matchRow}
                          <div className="pb-2 text-center text-[11px] font-semibold text-brand-magenta group-open:hidden">
                            Beste Spieler anzeigen ▾
                          </div>
                        </summary>
                        <div className="border-t border-brand-deep/5 bg-brand-deep/[0.03] px-5 py-3 text-sm">
                          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-deep/50">
                            Beste Spieler
                          </div>
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {best.map((b) => (
                              <span
                                key={b.name}
                                className="rounded-full bg-brand-green/20 px-2.5 py-0.5 text-xs font-bold text-brand-deep"
                              >
                                {b.name} ({b.points})
                              </span>
                            ))}
                          </div>
                          {scorers.length > 0 && (
                            <p className="text-xs text-brand-deep/70">
                              <span className="font-bold">Tor:</span>{" "}
                              {scorers.map((s) => `${s.name}${s.goals > 1 ? ` (${s.goals})` : ""}`).join(", ")}
                            </p>
                          )}
                          {assisters.length > 0 && (
                            <p className="text-xs text-brand-deep/70">
                              <span className="font-bold">Assist:</span>{" "}
                              {assisters.map((a) => `${a.name}${a.assists > 1 ? ` (${a.assists})` : ""}`).join(", ")}
                            </p>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {(fixtures ?? []).length === 0 && (
          <p className="rounded-xl bg-white px-5 py-8 text-center text-sm text-brand-deep/50 shadow-sm">
            Noch keine Spiele importiert.
          </p>
        )}
      </div>
    </main>
  );
}
