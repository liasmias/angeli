import type { Position } from "@/lib/database.types";

/**
 * Erlaubte Startelf-Formationen.
 *
 * Bewusst an einer Stelle definiert und von Client *und* Server importiert —
 * sonst driften Anzeige und Validierung auseinander.
 */
export const MIN_STARTERS: Record<Position, number> = { GK: 1, DEF: 3, MID: 3, FWD: 1 };
export const MAX_STARTERS: Record<Position, number> = { GK: 1, DEF: 5, MID: 5, FWD: 3 };

/** Höchstens so viele Spieler desselben Clubs im Kader. */
export const MAX_PER_CLUB = 3;

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Torhüter",
  DEF: "Verteidiger",
  MID: "Mittelfeldspieler",
  FWD: "Stürmer",
};

export const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

export type PositionCounts = Record<Position, number>;

export function emptyCounts(): PositionCounts {
  return { GK: 0, DEF: 0, MID: 0, FWD: 0 };
}

/**
 * Prüft eine vollständige Startelf. Gibt `null` zurück, wenn alles passt,
 * sonst eine Meldung im Klartext.
 */
export function validateFormation(counts: PositionCounts, startingSize: number): string | null {
  const total = POSITIONS.reduce((sum, p) => sum + counts[p], 0);
  if (total !== startingSize) {
    return `Startelf muss genau ${startingSize} Spieler haben (aktuell ${total}).`;
  }
  for (const pos of POSITIONS) {
    if (counts[pos] < MIN_STARTERS[pos]) {
      const min = MIN_STARTERS[pos];
      const verb = min === 1 ? "muss" : "müssen";
      return min === MAX_STARTERS[pos]
        ? `Genau ${min} ${POSITION_LABEL[pos]} ${verb} in der Startelf stehen.`
        : `Mindestens ${min} ${POSITION_LABEL[pos]} ${verb} in der Startelf stehen (aktuell ${counts[pos]}).`;
    }
    if (counts[pos] > MAX_STARTERS[pos]) {
      const max = MAX_STARTERS[pos];
      return `Höchstens ${max} ${POSITION_LABEL[pos]} ${max === 1 ? "darf" : "dürfen"} in der Startelf stehen (aktuell ${counts[pos]}).`;
    }
  }
  return null;
}

/**
 * Darf ein Spieler dieser Position zusätzlich in die Startelf?
 *
 * Neben Maximum und Elferlimit wird geprüft, ob danach überhaupt noch genug
 * Plätze für die Mindestanzahl der übrigen Positionen bleiben. Dadurch kann
 * eine Startelf nie in eine Sackgasse laufen: Sobald elf Spieler drin sind,
 * ist die Formation zwangsläufig gültig.
 */
export function canStart(
  counts: PositionCounts,
  pos: Position,
  startingSize: number
): { ok: true } | { ok: false; reason: string } {
  const total = POSITIONS.reduce((sum, p) => sum + counts[p], 0);
  if (total >= startingSize) {
    return { ok: false, reason: `Die Startelf ist mit ${startingSize} Spielern voll.` };
  }
  if (counts[pos] + 1 > MAX_STARTERS[pos]) {
    return {
      ok: false,
      reason:
        MAX_STARTERS[pos] === MIN_STARTERS[pos]
          ? `Es darf nur ${MAX_STARTERS[pos]} ${POSITION_LABEL[pos]} in der Startelf stehen.`
          : `Höchstens ${MAX_STARTERS[pos]} ${POSITION_LABEL[pos]} in der Startelf.`,
    };
  }

  const after = { ...counts, [pos]: counts[pos] + 1 };
  const freeSlots = startingSize - (total + 1);
  const stillNeeded = POSITIONS.reduce(
    (sum, p) => sum + Math.max(0, MIN_STARTERS[p] - after[p]),
    0
  );
  if (stillNeeded > freeSlots) {
    const fehlend = POSITIONS.filter((p) => MIN_STARTERS[p] - after[p] > 0)
      .map((p) => `${MIN_STARTERS[p] - after[p]} ${POSITION_LABEL[p]}`)
      .join(", ");
    return {
      ok: false,
      reason: `Dann fehlt der Platz für die Mindestbesetzung (${fehlend}).`,
    };
  }
  return { ok: true };
}

/** Formationskurzform wie "4-4-2" (ohne Torhüter). */
export function formationLabel(counts: PositionCounts): string {
  return `${counts.DEF}-${counts.MID}-${counts.FWD}`;
}
