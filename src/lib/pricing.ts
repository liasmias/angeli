/**
 * Automatische Preisanpassung.
 *
 * An einer Stelle definiert und von Sync (Erhöhung) *und* Regelseite
 * (Anzeige) importiert — sonst driften Regeltext und Verhalten auseinander.
 */

/**
 * Frühester Spieltag, der in ein Bewertungspaar einfliessen darf.
 *
 * Spieltag 1 fand vor dem Beitritt aller Mitglieder statt und ist in den
 * Startpreisen bereits eingepreist — das erste Paar ist deshalb 2+3, die
 * ersten Preisänderungen kommen nach Ende von Spieltag 3.
 */
export const PREIS_AB_SPIELTAG = 2;

/** Ab diesem Rating zählt ein Spieltag als Top-Leistung. */
export const PREIS_RATING_SCHWELLE = 7.5;

/** Preisanstieg nach zwei Top-Leistungen in Folge, in Mio. */
export const PREIS_ANSTIEG = 0.3;

/** Unter diesem Rating zählt ein Spieltag als schwache Leistung. */
export const PREIS_SENKUNG_SCHWELLE = 6.5;

/** Preissenkung nach zwei schwachen Leistungen in Folge, in Mio. */
export const PREIS_SENKUNG = 0.3;

/** Unter dieses Minimum fällt kein Preis — entspricht dem günstigsten
 *  Einstiegspreis der Liga. */
export const PREIS_MINIMUM = 4.0;
