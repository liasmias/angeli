/**
 * Accountnamen sind ohne Gross-/Kleinschreibung eindeutig: „Olympique_Jambon“
 * und „olympique_jambon“ sähen in der Rangliste fast gleich aus. Die Datenbank
 * sichert das mit einem Index auf lower(username) ab (Migration 0028); diese
 * Hilfe liefert vorab eine verständliche Meldung.
 *
 * `ilike` statt `eq`, und `_` / `%` maskiert — sonst wären sie Platzhalter,
 * und „a_b“ träfe auch „axb“.
 */
export function usernameMuster(name: string): string {
  return name.replace(/[\\%_]/g, (z) => `\\${z}`);
}
