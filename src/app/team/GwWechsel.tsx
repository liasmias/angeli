"use client";

import { useLinkStatus } from "next/link";

/**
 * Markiert einen laufenden Spieltagwechsel. Bis die neue Runde geladen ist
 * (gemessen ~1 s), zeigte die Seite unverändert den alten Spieltag; über
 * `body:has([data-gw-wechsel])` (globals.css) wird der Inhalt gedimmt.
 */
export default function GwWechsel() {
  const { pending } = useLinkStatus();
  return pending ? <span data-gw-wechsel hidden /> : null;
}
