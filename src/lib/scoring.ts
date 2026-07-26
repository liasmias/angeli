import type { Position, StatFields } from "@/lib/database.types";

export interface PointsBreakdown {
  minutes: number;
  goals: number;
  assists: number;
  goals_conceded: number;
  clean_sheet: number;
  saves: number;
  penalties_saved: number;
  penalties_conceded: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
}

const GOALS_PER_POSITION: Record<Position, number> = {
  GK: 6,
  DEF: 6,
  MID: 5,
  FWD: 4,
};

/**
 * Implements the league's scoring table. One assumption baked in that isn't
 * spelled out 1:1 in the original table: minutes are treated the standard
 * (FPL) way — 1 point for 1-59 minutes, 2 points (not 1) once a player
 * reaches 60+ minutes — since a flat "+1 either way" would make the 60-minute
 * threshold meaningless. Adjust `scoreMinutes` below if that's not what you want.
 */
function scoreMinutes(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 60) return 1;
  return 2;
}

export function computeFantasyPoints(
  position: Position,
  stats: StatFields
): { points: number; breakdown: PointsBreakdown } {
  const isDefensivePosition = position === "GK" || position === "DEF";

  const breakdown: PointsBreakdown = {
    minutes: scoreMinutes(stats.minutes),
    goals: stats.goals * GOALS_PER_POSITION[position],
    assists: stats.assists * 3,
    goals_conceded: isDefensivePosition ? -Math.floor(stats.goals_conceded / 2) : 0,
    clean_sheet: isDefensivePosition && stats.minutes >= 60 && stats.goals_conceded === 0 ? 4 : 0,
    saves: position === "GK" ? Math.floor(stats.saves / 2) : 0,
    penalties_saved: stats.penalties_saved * 5,
    penalties_conceded: stats.penalties_conceded * -2,
    yellow_cards: stats.yellow_cards * -1,
    red_cards: stats.red_cards * -3,
    own_goals: stats.own_goals * -2,
  };

  const points = Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  return { points, breakdown };
}

/** Merges synced stats with admin overrides — any non-null override field wins. */
export function applyOverride(
  synced: StatFields,
  override: Partial<Record<keyof StatFields, number | null>> | null
): StatFields {
  if (!override) return synced;
  const merged = { ...synced };
  for (const key of Object.keys(synced) as (keyof StatFields)[]) {
    const value = override[key];
    if (value !== null && value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}
