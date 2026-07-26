import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeFantasyPoints, applyOverride } from "@/lib/scoring";
import type { Database, StatFields } from "@/lib/database.types";

/** Recomputes fantasy_points and the locked-in gameweek_squads snapshot for one player. */
export async function recomputePlayerPoints(
  supabase: SupabaseClient<Database>,
  playerId: number,
  gameweekId: number
) {
  const { data: player } = await supabase.from("players").select("position").eq("id", playerId).single();
  if (!player) return;

  const { data: synced } = await supabase
    .from("player_stats")
    .select("*")
    .eq("player_id", playerId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();
  const { data: override } = await supabase
    .from("player_stats_overrides")
    .select("*")
    .eq("player_id", playerId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();

  const base: StatFields = synced
    ? {
        minutes: synced.minutes,
        goals: synced.goals,
        assists: synced.assists,
        goals_conceded: synced.goals_conceded,
        saves: synced.saves,
        penalties_saved: synced.penalties_saved,
        penalties_conceded: synced.penalties_conceded,
        yellow_cards: synced.yellow_cards,
        red_cards: synced.red_cards,
        own_goals: synced.own_goals,
      }
    : {
        minutes: 0,
        goals: 0,
        assists: 0,
        goals_conceded: 0,
        saves: 0,
        penalties_saved: 0,
        penalties_conceded: 0,
        yellow_cards: 0,
        red_cards: 0,
        own_goals: 0,
      };

  const merged = applyOverride(base, override ?? null);
  const { points, breakdown } = computeFantasyPoints(player.position, merged);

  await supabase
    .from("fantasy_points")
    .upsert(
      {
        player_id: playerId,
        gameweek_id: gameweekId,
        points,
        breakdown: breakdown as unknown as Record<string, number>,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "player_id,gameweek_id" }
    );

  await supabase
    .from("gameweek_squads")
    .update({ points_earned: points })
    .eq("player_id", playerId)
    .eq("gameweek_id", gameweekId);
}
