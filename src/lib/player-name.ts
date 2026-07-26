/** Namensbestandteile, die zum Nachnamen gehören und nicht abgetrennt werden. */
const PARTICLES = new Set([
  "van", "von", "de", "del", "della", "di", "da", "das", "dos", "du",
  "la", "le", "ten", "ter", "bin", "al", "el", "st",
]);

/**
 * Kürzt einen Spielernamen auf "Initiale. Nachname".
 *
 * Die Rohdaten sind uneinheitlich: API-Football liefert teils schon
 * "L. Watkowiak", teils volle Namen wie "João Victor Schlickmann Carbone".
 * Beides landet hier bei "L. Watkowiak" bzw. "J. Carbone".
 *
 * Einzelnamen (etwa "Marquinhos") bleiben unverändert — sie haben keinen
 * Nachnamen zum Abkürzen.
 */
export function shortenPlayerName(firstName: string | null, lastName: string): string {
  const full = [firstName, lastName].filter(Boolean).join(" ").trim().replace(/\s+/g, " ");
  if (!full) return "";

  // Bereits in Kurzform, z. B. "L. Watkowiak" oder "M. Di Giusto".
  if (/^\p{Lu}\.\s/u.test(full)) return full;

  const parts = full.split(" ");
  if (parts.length === 1) return full;

  // Partikel vor dem letzten Wort gehören zum Nachnamen ("de Boer", "Di Giusto").
  let surnameStart = parts.length - 1;
  while (surnameStart > 1 && PARTICLES.has(parts[surnameStart - 1].toLowerCase())) {
    surnameStart--;
  }

  return `${parts[0][0].toUpperCase()}. ${parts.slice(surnameStart).join(" ")}`;
}
