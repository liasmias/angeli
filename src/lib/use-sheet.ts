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
 * Mit `wischen` schliesst auf dem Handy zusätzlich ein Wischen nach unten. Nur
 * für Sheets, deren Inhalt selbst scrollt: Der Spielermarkt hat eine innere
 * Liste, dort würde die Geste das Scrollen abfangen.
 *
 * Sheets dürfen übereinanderliegen (Spielerkarte über dem Spielermarkt). Jedes
 * merkt sich darum seine Tiefe im History-Eintrag, und Zurück oder Escape
 * schliessen nur das oberste. Vorher schloss das Zurückspringen beim Schliessen
 * der Karte auch den Markt darunter.
 *
 * Gibt eine Referenz zurück, die auf den Sheet-Inhalt gesetzt wird — dorthin
 * wandert der Fokus beim Öffnen, und von dort zurück auf den auslösenden
 * Knopf beim Schliessen.
 */
/** Wie viele Sheets gerade offen sind, laut aktuellem History-Eintrag. */
function aktuelleTiefe(): number {
  const tiefe = window.history.state?.angeliTiefe;
  return typeof tiefe === "number" ? tiefe : 0;
}

export function useSheet(offen: boolean, schliessen: () => void, { wischen = false } = {}) {
  const inhalt = useRef<HTMLDivElement | null>(null);
  // Über eine Referenz: Der Aufrufer übergibt bei jedem Rendern eine neue
  // Funktion. Als Abhängigkeit lief der Zurück-Effekt dann jedes Mal neu, und
  // dessen history.back() schloss das Sheet bei jedem Neuzeichnen, etwa wenn
  // ein Toast auslief.
  const schliessenAktuell = useRef(schliessen);
  useEffect(() => {
    schliessenAktuell.current = schliessen;
  });
  const vorherFokussiert = useRef<HTMLElement | null>(null);
  // Merkt, ob der Zurück-Knopf geschlossen hat — dann darf die Aufräumroutine
  // nicht noch einmal zurückspringen.
  const durchZurueck = useRef(false);

  useEffect(() => {
    if (!offen) return;
    // Liegt schon ein Sheet darunter, ist der Body bereits fixiert. Ein zweites
    // Fixieren läse scrollY als 0 und verschöbe die Seite dahinter.
    if (document.body.style.position === "fixed") return;
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
    const tiefe = aktuelleTiefe() + 1;

    const aufTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aktuelleTiefe() === tiefe) schliessenAktuell.current();
    };
    const aufZurueck = () => {
      // Nur schliessen, wenn der eigene Eintrag weg ist — nicht, wenn bloss
      // ein Sheet darüber zurückgesprungen ist.
      if (aktuelleTiefe() >= tiefe) return;
      durchZurueck.current = true;
      schliessenAktuell.current();
    };

    window.history.pushState({ angeliSheet: true, angeliTiefe: tiefe }, "");
    document.addEventListener("keydown", aufTaste);
    window.addEventListener("popstate", aufZurueck);

    return () => {
      document.removeEventListener("keydown", aufTaste);
      window.removeEventListener("popstate", aufZurueck);
      // Wurde anders geschlossen (✕, Auswahl, Hintergrund), liegt der eigene
      // History-Eintrag noch obenauf und muss weg — sonst bräuchte es zwei
      // Mal Zurück, um die Seite zu verlassen.
      if (!durchZurueck.current && aktuelleTiefe() === tiefe) {
        window.history.back();
      }
    };
  }, [offen]);

  useEffect(() => {
    const el = inhalt.current;
    if (!offen || !wischen || !el) return;
    const AB_DISTANZ = 100;
    const AB_TEMPO = 0.5; // px pro ms
    let startY = 0;
    let startZeit = 0;
    let weg = 0;
    let verfolgt = false;
    let zieht = false;
    let timer: number | undefined;
    const hintergrund = el.previousElementSibling as HTMLElement | null;

    // `translate` statt `transform`: Das setzt schon die Einblend-Animation.
    const setzen = (y: number) => {
      el.style.translate = `0 ${y}px`;
      if (hintergrund) hintergrund.style.opacity = String(Math.max(0, 1 - y / el.offsetHeight));
    };
    const start = (e: TouchEvent) => {
      // Nur am oberen Rand des Inhalts, sonst scrollt der Daumen die Karte.
      verfolgt = window.matchMedia("(max-width: 639px)").matches && el.scrollTop <= 0;
      if (!verfolgt) return;
      startY = e.touches[0].clientY;
      startZeit = e.timeStamp;
      weg = 0;
      zieht = false;
      el.style.transition = "none";
    };
    const bewegen = (e: TouchEvent) => {
      if (!verfolgt) return;
      weg = e.touches[0].clientY - startY;
      if (!zieht) {
        if (weg < 0) verfolgt = false; // Nach oben: normales Scrollen.
        if (weg < 8) return;
        zieht = true;
      }
      e.preventDefault();
      setzen(Math.max(0, weg - 8));
    };
    const ende = (e: TouchEvent) => {
      if (!zieht) return;
      verfolgt = zieht = false;
      el.style.transition = "translate 180ms ease-out";
      if (hintergrund) hintergrund.style.transition = "opacity 180ms ease-out";
      if (weg > AB_DISTANZ || weg / (e.timeStamp - startZeit) > AB_TEMPO) {
        setzen(el.offsetHeight);
        timer = window.setTimeout(() => schliessenAktuell.current(), 180);
      } else {
        setzen(0);
      }
    };
    el.addEventListener("touchstart", start, { passive: true });
    // Nicht passiv: preventDefault verhindert, dass die Seite mitzieht.
    el.addEventListener("touchmove", bewegen, { passive: false });
    el.addEventListener("touchend", ende);
    el.addEventListener("touchcancel", ende);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", bewegen);
      el.removeEventListener("touchend", ende);
      el.removeEventListener("touchcancel", ende);
    };
  }, [offen, wischen]);

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
