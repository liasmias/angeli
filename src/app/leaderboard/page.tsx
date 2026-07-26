import { createClient } from "@/lib/supabase/server";

const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: standings } = await supabase.from("standings").select("*");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-brand-deep">Rangliste</h1>
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="brand-gradient flex items-center justify-between px-5 py-3 text-sm font-bold text-white">
          <span>Team</span>
          <span>Punkte</span>
        </div>
        <ol className="divide-y divide-brand-deep/5">
          {(standings ?? []).map((row, i) => (
            <li key={row.user_id} className="flex items-center justify-between px-5 py-3">
              <span className="flex items-center gap-3">
                <span className="w-8 text-center font-bold tabular-nums text-brand-deep/40">
                  {MEDALS[i] ?? i + 1}
                </span>
                <span className="font-semibold text-brand-deep">{row.username}</span>
              </span>
              <span className="rounded-full bg-brand-green/20 px-3 py-1 font-bold tabular-nums text-brand-deep">
                {row.total_points}
              </span>
            </li>
          ))}
          {(!standings || standings.length === 0) && (
            <li className="px-5 py-8 text-center text-sm text-brand-deep/50">
              Noch keine Punkte — sobald der erste Spieltag ausgewertet ist, erscheint hier die
              Rangliste.
            </li>
          )}
        </ol>
      </div>
    </main>
  );
}
