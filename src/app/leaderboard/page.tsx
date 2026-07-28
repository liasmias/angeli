import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";
import LeaderboardTable, { type StandingRow } from "./LeaderboardTable";

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const [{ data: standings }, lang] = await Promise.all([
    supabase.from("standings").select("*"),
    getLang(),
  ]);
  const t = getDictionary(lang).leaderboard;

  const rows: StandingRow[] = (standings ?? []).map((row, i) => ({
    user_id: row.user_id ?? String(i),
    username: row.username ?? "?",
    total_points: row.total_points ?? 0,
    rank: i + 1,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">{t.title}</h1>
      <p className="mb-6 text-sm text-brand-deep/60">{t.intro}</p>
      <LeaderboardTable rows={rows} lang={lang} />
    </main>
  );
}
