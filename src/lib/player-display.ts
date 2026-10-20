import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { shortenPlayerName, surnameKey, surnameOf } from "@/lib/player-name";

/**
 * Anzeigenamen aller Spieler: nur der Nachname — "Sanches" statt
 * "A. Sanches". Die Initiale bleibt, wo der Nachname sonst mehrdeutig wäre:
 *
 *   * Nachnamen, die unter den aktiven Spielern mehrfach vorkommen
 *     (Sow, Owusu, Di Giusto …). Akzente zählen dabei nicht.
 *   * Inaktive Spieler. Sie erscheinen nur noch in alten Aufstellungen und
 *     zählen für die Doppelprüfung bewusst nicht mit — sonst hiesse der
 *     aktive Louis wegen seines eigenen alten Eintrags "C. Louis".
 *
 * `cache` sorgt dafür, dass die Spielerliste pro Seitenaufruf nur einmal
 * geladen wird, auch wenn mehrere Teile der Seite Namen brauchen.
 */
/**
 * Namen, bei denen die Regel "letztes Wort = Nachname" nicht greift — etwa
 * koreanische Namen, wo der Familienname vorne steht. Schlüssel ist der
 * gespeicherte Name, Wert die Anzeige.
 */
const AUSNAHMEN: Record<string, string> = {
  "Lee Young-Jun": "Lee",
};

export const getDisplayNames = cache(async (): Promise<Map<number, string>> => {
  const supabase = await createClient();
  const { data: spieler } = await supabase
    .from("players")
    .select("id, first_name, last_name, is_active");

  const anzahl = new Map<string, number>();
  for (const p of spieler ?? []) {
    if (!p.is_active) continue;
    const k = surnameKey(surnameOf(p.first_name, p.last_name));
    anzahl.set(k, (anzahl.get(k) ?? 0) + 1);
  }

  const namen = new Map<number, string>();
  for (const p of spieler ?? []) {
    const ausnahme = AUSNAHMEN[[p.first_name, p.last_name].filter(Boolean).join(" ")];
    if (ausnahme) {
      namen.set(p.id, ausnahme);
      continue;
    }
    const nachname = surnameOf(p.first_name, p.last_name);
    const eindeutig = p.is_active && (anzahl.get(surnameKey(nachname)) ?? 0) <= 1;
    namen.set(p.id, eindeutig ? nachname : shortenPlayerName(p.first_name, p.last_name));
  }
  return namen;
});
