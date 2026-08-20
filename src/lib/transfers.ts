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
  /**
   * Einstiegsrunde: In dem Spieltag, in dem jemand sein Team zum ersten Mal
   * aufstellt, kosten Transfers nichts. Sonst würde ein Neuzugang beim
   * Zusammenstellen des ersten Kaders mit zweistelligen Minuspunkten starten.
   */
  unlimited: boolean;
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
 *
 * Ausnahme Wildcard: In einer Wildcard-Runde steht das Konto still. Weder
 * werden die dort gebuchten Transfers abgezogen, noch kommt der Zuwachs der
 * Runde hinzu — wer mit drei angesparten Transfers die Wildcard spielt, hat
 * danach wieder drei. Ohne das fräßen die Wildcard-Transfers das Angesparte
 * auf, obwohl sie nichts kosten: Sie werden mit `points_cost: 0` gebucht,
 * zählten aber trotzdem als Verbrauch. FPL handhabt es genauso.
 */
export async function getTransferBudget(
  supabase: SupabaseClient<Database>,
  squadId: number,
  currentGameweek: { id: number; number: number },
  settings: { free_transfers_per_gameweek: number; max_banked_transfers: number }
): Promise<TransferBudget> {
  const allowance = settings.free_transfers_per_gameweek;
  const cap = Math.max(allowance, settings.max_banked_transfers);

  const [{ data: gameweeks }, { data: transfers }, { data: firstSnapshot }, { data: wildcards }] =
    await Promise.all([
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
      supabase
        .from("chip_usages")
        .select("gameweek_id")
        .eq("squad_id", squadId)
        .eq("chip", "wildcard"),
    ]);

  const wildcardRunden = new Set((wildcards ?? []).map((w) => w.gameweek_id));

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
    // Wildcard-Runde: Guthaben unverändert in die nächste Runde tragen.
    if (wildcardRunden.has(gw.id)) continue;
    const rest = Math.max(0, banked - (usedByGameweek.get(gw.id) ?? 0));
    banked = Math.min(cap, rest + allowance);
  }

  // Einstiegsrunde: noch nie aufgestellt, oder der erste Spieltag mit
  // Aufstellung ist genau der aktuelle. Gilt für die ganze Runde, nicht nur
  // für das erste Speichern — sonst würde jede Korrektur davor bestraft.
  const unlimited = !firstSnapshot || firstGw === currentGameweek.number;

  const usedThisGameweek = usedByGameweek.get(currentGameweek.id) ?? 0;
  // Läuft die Wildcard gerade, bleibt das Guthaben auch in der Anzeige
  // unangetastet — sonst zählte es beim Umbauen sichtbar auf null herunter,
  // obwohl kein einziger dieser Transfers etwas kostet.
  const wildcardAktiv = wildcardRunden.has(currentGameweek.id);
  return {
    bankedAtStart: banked,
    usedThisGameweek,
    freeAvailable: wildcardAktiv ? banked : Math.max(0, banked - usedThisGameweek),
    unlimited,
  };
}
