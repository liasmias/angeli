import "server-only";

/**
 * Holt eine Tabelle vollstaendig, seitenweise.
 *
 * PostgREST liefert hoechstens 1000 Zeilen und meldet das nicht als Fehler —
 * der Rest fehlt einfach. `player_stats` und `fantasy_points` wachsen um rund
 * 230 Zeilen pro Spieltag und reissen die Grenze im Lauf der Saison. Ohne
 * diese Schleife waeren ab dann Saisonpunkte, Tore und Vorlagen im
 * Spielermarkt fuer einen Teil der Spieler stumm auf null gefallen.
 */
export async function alleZeilen<T>(
  seite: (von: number, bis: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const GROESSE = 1000;
  const alle: T[] = [];
  for (let von = 0; ; von += GROESSE) {
    const { data } = await seite(von, von + GROESSE - 1);
    if (!data?.length) break;
    alle.push(...data);
    if (data.length < GROESSE) break;
  }
  return alle;
}
