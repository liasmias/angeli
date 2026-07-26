import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export interface TransferBudget {
  /** Gratis-Transfers, die für den aktuellen Spieltag noch übrig sind. */
  freeAvailable: number;
  /** In diesem Spieltag bereits gebuchte Transfers. */
  usedThisGameweek: number;
  /** Gratis-Transfers, mit denen der Spieltag gestartet ist (inkl. Angespartem). */
  bankedAtStart: number;
}

/**
 * Ermittelt das Transferguthaben für einen Spieltag.
 *
 * Bewusst aus der Transferhistorie hergeleitet statt aus einem Zählerfeld:
 * Ein Feld lässt sich beim Speichern überschreiben, die gebuchten Transfers
 * nicht. Regel pro Spieltag:
 *
 *     guthaben(n+1) = min(cap, max(0, guthaben(n) − genutzt(n)) + zuwachs)
 *
 * Gezählt wird ab dem Spieltag, an dem der Kader das erste Mal aufgestellt
 * wurde — wer später einsteigt, sammelt nicht rückwirkend an.
 */
export async function getTransferBudget(
  supabase: SupabaseClient<Database>,
  squadId: number,
  currentGameweek: { id: number; number: number },
  settings: { free_transfers_per_gameweek: number; max_banked_transfers: number }
): Promise<TransferBudget> {
  const allowance = settings.free_transfers_per_gameweek;
  const cap = Math.max(allowance, settings.max_banked_transfers);

  const [{ data: gameweeks }, { data: transfers }, { data: firstSnapshot }] = await Promise.all([
    supabase
      .from("gameweeks")
      .select("id, number")
      .lte("number", currentGameweek.number)
      .order("number", { ascending: true }),
    supabase.from("transfers").select("gameweek_id").eq("squad_id", squadId),
    supabase
      .from("gameweek_squads")
      .select("gameweek_id, gameweeks(number)")
      .eq("squad_id", squadId)
      .order("gameweek_id", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const usedByGameweek = new Map<number, number>();
  for (const t of transfers ?? []) {
    usedByGameweek.set(t.gameweek_id, (usedByGameweek.get(t.gameweek_id) ?? 0) + 1);
  }

  const firstGw = firstSnapshot
    ? (Array.isArray(firstSnapshot.gameweeks)
        ? firstSnapshot.gameweeks[0]
        : firstSnapshot.gameweeks
      )?.number ?? currentGameweek.number
    : currentGameweek.number;

  let banked = allowance;
  for (const gw of gameweeks ?? []) {
    if (gw.number < firstGw) continue;
    if (gw.id === currentGameweek.id) break;
    const rest = Math.max(0, banked - (usedByGameweek.get(gw.id) ?? 0));
    banked = Math.min(cap, rest + allowance);
  }

  const usedThisGameweek = usedByGameweek.get(currentGameweek.id) ?? 0;
  return {
    bankedAtStart: banked,
    usedThisGameweek,
    freeAvailable: Math.max(0, banked - usedThisGameweek),
  };
}
