import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface GameweekSummary {
  /** Punkte, die dieser Kader an diesem Spieltag geholt hat (inkl. Chips und Transferkosten). */
  points: number | null;
  /** Gesamtpunkte über die Saison. */
  totalPoints: number;
  /** Platzierung in der Rangliste, 1 = Erster. */
  rank: number | null;
  /** Teilnehmerzahl, für "80 von 120". */
  participants: number;
}

/**
 * Punkte eines Kaders an einem bestimmten Spieltag.
 *
 * Spiegelt bewusst dieselbe Rechnung wie die `standings`-View: Startelf zählt,
 * der Captain doppelt, bei aktivem Bench Boost zählt auch die Bank, und die
 * Transferkosten dieses Spieltags werden abgezogen.
 *
 * Gibt `null` zurück, wenn für den Spieltag noch keine Punkte vergeben wurden
 * (dann steht in der Anzeige "—" statt einer irreführenden 0).
 */
export async function getGameweekPoints(
  supabase: SupabaseClient<Database>,
  squadId: number,
  gameweekId: number
): Promise<number | null> {
  const [{ data: rows }, { data: benchBoost }, { data: transfers }] = await Promise.all([
    supabase
      .from("gameweek_squads")
      .select("is_starting, is_captain, points_earned")
      .eq("squad_id", squadId)
      .eq("gameweek_id", gameweekId),
    supabase
      .from("chip_usages")
      .select("id")
      .eq("squad_id", squadId)
      .eq("chip", "bench_boost")
      .eq("gameweek_id", gameweekId)
      .maybeSingle(),
    supabase
      .from("transfers")
      .select("points_cost")
      .eq("squad_id", squadId)
      .eq("gameweek_id", gameweekId),
  ]);

  if (!rows || rows.length === 0) return null;
  // Noch kein Spieler ausgewertet → Spieltag hat noch nicht stattgefunden.
  if (rows.every((r) => r.points_earned === null)) return null;

  const boost = !!benchBoost;
  let points = 0;
  for (const r of rows) {
    const p = r.points_earned ?? 0;
    if (r.is_starting || boost) points += p;
    if (r.is_starting && r.is_captain) points += p;
  }
  points -= (transfers ?? []).reduce((sum, t) => sum + t.points_cost, 0);
  return points;
}

/** Platzierung und Gesamtpunkte aus der Rangliste. */
export async function getRank(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ rank: number | null; totalPoints: number; participants: number }> {
  const { data: standings } = await supabase
    .from("standings")
    .select("user_id, total_points")
    .order("total_points", { ascending: false });

  const rows = standings ?? [];
  const mine = rows.find((r) => r.user_id === userId);
  if (!mine) return { rank: null, totalPoints: 0, participants: rows.length };

  // Gleichstand teilt sich denselben Rang.
  const rank = rows.filter((r) => r.total_points > mine.total_points).length + 1;
  return { rank, totalPoints: mine.total_points, participants: rows.length };
}
