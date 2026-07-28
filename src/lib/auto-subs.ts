import type { Position } from "@/lib/database.types";
import { MAX_STARTERS, MIN_STARTERS, emptyCounts } from "@/lib/formation";

export interface AutoSubPlayer {
  playerId: number;
  position: Position;
  isStarting: boolean;
  /** 0 = Torhüter (Bankplatz 1), 1..3 = Feldspieler in gewählter Reihenfolge. */
  benchOrder: number;
  /** Gespielte Minuten an diesem Spieltag; 0, wenn nicht eingesetzt. */
  minutes: number;
}

export interface AutoSub {
  outPlayerId: number;
  inPlayerId: number;
}

/** Formation nach einem Tausch noch erlaubt? */
function formationOk(counts: Record<Position, number>): boolean {
  return (["GK", "DEF", "MID", "FWD"] as Position[]).every(
    (p) => counts[p] >= MIN_STARTERS[p] && counts[p] <= MAX_STARTERS[p]
  );
}

/**
 * Automatische Einwechslungen nach Spielende.
 *
 * Wer in der Startelf keine Minute gespielt hat, wird durch den ersten
 * Bankspieler ersetzt, mit dem die Formation gültig bleibt — in der vom
 * Mitglied gewählten Bank-Reihenfolge. Ein Torhüter kann nur durch den
 * Bank-Torhüter ersetzt werden, und wer selbst nicht gespielt hat, rückt
 * nicht nach.
 *
 * Reine Rechenfunktion ohne Datenbankzugriff — dadurch prüfbar, ohne einen
 * Spieltag zu simulieren.
 */
export function computeAutoSubs(lineup: AutoSubPlayer[]): AutoSub[] {
  const starters = lineup.filter((p) => p.isStarting);
  const bench = lineup
    .filter((p) => !p.isStarting)
    .sort((a, b) => a.benchOrder - b.benchOrder);

  // Laufende Startelf, auf der die Formationsprüfung arbeitet.
  const aktuell = new Map(starters.map((p) => [p.playerId, p.position]));
  const genutzt = new Set<number>();
  const subs: AutoSub[] = [];

  const zaehle = () => {
    const c = emptyCounts();
    for (const pos of aktuell.values()) c[pos]++;
    return c;
  };

  // Torhüter zuerst: er lässt sich nur durch den Bank-Torhüter ersetzen.
  const startGk = starters.find((p) => p.position === "GK");
  const benchGk = bench.find((p) => p.position === "GK");
  if (startGk && startGk.minutes === 0 && benchGk && benchGk.minutes > 0) {
    aktuell.delete(startGk.playerId);
    aktuell.set(benchGk.playerId, benchGk.position);
    genutzt.add(benchGk.playerId);
    subs.push({ outPlayerId: startGk.playerId, inPlayerId: benchGk.playerId });
  }

  // Feldspieler in stabiler Reihenfolge abarbeiten, damit das Ergebnis
  // unabhängig von der Zeilenreihenfolge aus der Datenbank ist.
  const reihenfolge: Position[] = ["DEF", "MID", "FWD"];
  const ausfaelle = starters
    .filter((p) => p.position !== "GK" && p.minutes === 0)
    .sort(
      (a, b) =>
        reihenfolge.indexOf(a.position) - reihenfolge.indexOf(b.position) ||
        a.playerId - b.playerId
    );

  for (const raus of ausfaelle) {
    const kandidaten = bench.filter(
      (b) => b.position !== "GK" && b.minutes > 0 && !genutzt.has(b.playerId)
    );
    for (const rein of kandidaten) {
      aktuell.delete(raus.playerId);
      aktuell.set(rein.playerId, rein.position);
      if (formationOk(zaehle())) {
        genutzt.add(rein.playerId);
        subs.push({ outPlayerId: raus.playerId, inPlayerId: rein.playerId });
        break;
      }
      // Passt nicht — zurücknehmen und den nächsten Bankplatz versuchen.
      aktuell.delete(rein.playerId);
      aktuell.set(raus.playerId, raus.position);
    }
  }

  return subs;
}
