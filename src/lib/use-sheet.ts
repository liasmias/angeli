"use client";

import { useEffect, useRef } from "react";

/**
 * Gemeinsames Verhalten für Sheets und Popover.
 *
 * Drei Dinge, die ein Overlay im Web haben muss, damit es sich wie in einer
 * App anfühlt — und die den drei Sheets der Aufstellung bisher fehlten,
 * obwohl das mobile Menü sie längst hatte:
 *
 *   1. Der Hintergrund darf nicht mitscrollen. `overflow: hidden` reicht auf
 *      iOS Safari nicht (Scroll-Chaining aufs Wurzelelement), deshalb wird
 *      der Body fixiert und die Position beim Schliessen wiederhergestellt.
 *   2. Escape schliesst — und mit `role="dialog"` am Inhalt ist es für
 *      Screenreader ein eigener Kontext statt loser Elemente auf der Seite.
 *   3. Der Zurück-Knopf schliesst das Sheet, statt die Seite zu verlassen.
 *      Auf Android ist das die erwartete Geste, auf iOS das Wischen vom Rand.
 *
 * Gibt eine Referenz zurück, die auf den Sheet-Inhalt gesetzt wird — dorthin
 * wandert der Fokus beim Öffnen, und von dort zurück auf den auslösenden
 * Knopf beim Schliessen.
 */
export function useSheet(offen: boolean, schliessen: () => void) {
  const inhalt = useRef<HTMLDivElement | null>(null);
  const vorherFokussiert = useRef<HTMLElement | null>(null);
  // Merkt, ob der Zurück-Knopf geschlossen hat — dann darf die Aufräumroutine
  // nicht noch einmal zurückspringen.
  const durchZurueck = useRef(false);

  useEffect(() => {
    if (!offen) return;
    const scrollY = window.scrollY;
    const { position, top, width } = document.body.style;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      window.scrollTo(0, scrollY);
    };
  }, [offen]);

  useEffect(() => {
    if (!offen) return;
    durchZurueck.current = false;

    const aufTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen();
    };
    const aufZurueck = () => {
      durchZurueck.current = true;
      schliessen();
    };

    window.history.pushState({ angeliSheet: true }, "");
    document.addEventListener("keydown", aufTaste);
    window.addEventListener("popstate", aufZurueck);

    return () => {
      document.removeEventListener("keydown", aufTaste);
      window.removeEventListener("popstate", aufZurueck);
      // Wurde anders geschlossen (✕, Auswahl, Hintergrund), liegt der eigene
      // History-Eintrag noch obenauf und muss weg — sonst bräuchte es zwei
      // Mal Zurück, um die Seite zu verlassen.
      if (!durchZurueck.current && window.history.state?.angeliSheet) {
        window.history.back();
      }
    };
  }, [offen, schliessen]);

  useEffect(() => {
    if (!offen) return;
    vorherFokussiert.current = document.activeElement as HTMLElement | null;
    // Erst nach dem Einblenden fokussieren, sonst springt Safari beim
    // Hereinfahren an den Seitenanfang.
    const id = window.setTimeout(() => inhalt.current?.focus({ preventScroll: true }), 40);
    return () => {
      window.clearTimeout(id);
      vorherFokussiert.current?.focus?.({ preventScroll: true });
    };
  }, [offen]);

  return inhalt;
}
