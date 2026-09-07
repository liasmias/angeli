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

/**
 * Mindestens so viele Minuten, damit ein Spieltag überhaupt in ein Paar
 * einfliesst.
 *
 * Ohne diese Schwelle zählte jeder Kurzeinsatz als vollwertiger Spieltag.
 * L. Blum kam in Runde 6 dreizehn Minuten zum Einsatz, bekam dafür Rating
 * 6.3, und zusammen mit Runde 7 ergab das zwei schwache Runden in Folge —
 * Preissenkung für einen Einsatz, den er kaum beeinflussen konnte. Runden
 * unterhalb der Schwelle sind neutral: Sie zählen weder als stark noch als
 * schwach und unterbrechen auch keine Serie.
 */
export const PREIS_MIN_MINUTEN = 60;

/** Ab diesem Rating zählt ein Spieltag als Top-Leistung. */
export const PREIS_RATING_SCHWELLE = 7.5;

/**
 * Punkte-Vorbehalt: Das Rating allein soll nicht über den Preis entscheiden.
 *
 * Für einen Anstieg müssen die beiden Runden zusammen mindestens so viele
 * Punkte gebracht haben — ein hohes Rating ohne jede Ausbeute reicht nicht.
 * Umgekehrt bleibt eine Senkung aus, wenn der Spieler trotz schwacher
 * Bewertung geliefert hat.
 *
 * Gemessen an den bisherigen sieben Runden greift der Vorbehalt selten; die
 * Minutenschwelle trägt den Grossteil. Er sichert die Ausreisser ab, in
 * denen Bewertung und Ausbeute auseinanderlaufen.
 */
export const PREIS_PUNKTE_FUER_ANSTIEG = 6;
export const PREIS_PUNKTE_GEGEN_SENKUNG = 8;

/** Preisanstieg nach zwei Top-Leistungen in Folge, in Mio. */
export const PREIS_ANSTIEG = 0.3;

/** Unter diesem Rating zählt ein Spieltag als schwache Leistung. */
export const PREIS_SENKUNG_SCHWELLE = 6.5;

/** Preissenkung nach zwei schwachen Leistungen in Folge, in Mio. */
export const PREIS_SENKUNG = 0.3;

/** Unter dieses Minimum fällt kein Preis — entspricht dem günstigsten
 *  Einstiegspreis der Liga. */
export const PREIS_MINIMUM = 4.0;
