/**
 * Bonuspunkte nach FPL-Vorbild: Die drei Bestbewerteten jeder Partie
 * erhalten 3/2/1 Zusatzpunkte, auf Basis des API-Ratings.
 *
 * Reine Funktion ohne Datenbankzugriff — dadurch offline gegen echte
 * Spieltagsdaten prüfbar. Verwendet von der Punkteberechnung
 * (gameweek-scoring) und der Regelseite (Anzeige der Werte).
 */

/** Bonuspunkte gibt es erst ab diesem Spieltag (Ankündigung an die Liga). */
export const BONUS_AB_SPIELTAG = 2;

/** Punkte je Rang innerhalb einer Partie. */
export const BONUS_PUNKTE: Record<number, number> = { 1: 3, 2: 2, 3: 1 };

/** Partie gilt als beendet — vorher wird kein Bonus vergeben, sonst
 *  wechselte er während des Spiels laufend den Besitzer. */
export const BONUS_FINALE_STATUS = new Set(["FT", "AET", "PEN"]);

export interface BonusKandidat {
  playerId: number;
  /** API-Rating; null = nicht bewertet (kein Einsatz). */
  rating: number | null;
  minutes: number;
}

/**
 * Verteilt die Bonuspunkte einer Partie.
 *
 * Gleichstand = geteilter Rang nach FPL-Regel: Der Rang ist die Zahl der
 * strikt besser Bewerteten plus eins. Zwei geteilte Erste bekommen beide 3,
 * der Nächste ist Dritter und bekommt 1.
 */
export function computeBonus(kandidaten: BonusKandidat[]): Map<number, number> {
  const bewertet = kandidaten.filter((k) => k.rating !== null && k.minutes > 0);
  const bonus = new Map<number, number>();
  for (const k of bewertet) {
    const rang = bewertet.filter((x) => Number(x.rating) > Number(k.rating)).length + 1;
    const punkte = BONUS_PUNKTE[rang] ?? 0;
    if (punkte > 0) bonus.set(k.playerId, punkte);
  }
  return bonus;
}
