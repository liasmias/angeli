"use client";

import { useCallback, useEffect, useRef } from "react";

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
 * Schliessen blendet aus: `zu()` setzt `data-raus` auf Sheet und Verdunkelung,
 * die passende Ausfahrt steht in globals.css (unten hinaus, Panel zur Seite,
 * Dialog verblassen). Erst nach deren Ende wird wirklich geschlossen. ✕,
 * Hintergrund, Escape und Zurück nutzen alle denselben Weg.
 *
 * Gibt `[ref, zu]` zurück: `ref` gehört auf den Sheet-Inhalt — dorthin
 * wandert der Fokus beim Öffnen, und von dort zurück auf den auslösenden
 * Knopf beim Schliessen. `zu` schliesst mit Ausfahrt.
 */
/** Wie viele Sheets gerade offen sind. */
let offeneSheets = 0;
function aktuelleTiefe(): number {
  return offeneSheets;
}

// Eigene Rücksprünge (history.back() beim Aufräumen) lösen ebenfalls popstate
// aus. Sie sind kein Zurück des Nutzers und dürfen kein Sheet schliessen —
// sonst schloss ein gleich wieder geöffnetes Sheet sich selbst.
let eigeneRueckspruenge = 0;
const eigeneEreignisse = new WeakSet<Event>();
if (typeof window !== "undefined") {
  window.addEventListener("popstate", (e) => {
    if (eigeneRueckspruenge > 0) {
      eigeneRueckspruenge--;
      eigeneEreignisse.add(e);
    }
  });
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

  // Ausfahrt läuft: weitere Schliess-Versuche lösen nichts doppelt aus.
  const faehrtAus = useRef(false);
  const zu = useCallback(() => {
    if (faehrtAus.current) return;
    const el = inhalt.current;
    if (!el) return schliessenAktuell.current();
    faehrtAus.current = true;
    // Verdunkelung: Geschwister davor (Sheets) oder Eltern (Markt, Dialog).
    const hintergruende = [el.previousElementSibling, el.parentElement].filter(
      (h): h is HTMLElement => h instanceof HTMLElement && h.classList.contains("fade-in")
    );
    el.setAttribute("data-raus", "");
    for (const h of hintergruende) h.setAttribute("data-raus", "");
    // Falls animationend ausbleibt (Tab im Hintergrund), trotzdem schliessen.
    const notfall = { id: 0 };
    const fertig = () => {
      window.clearTimeout(notfall.id);
      el.removeEventListener("animationend", ende);
      schliessenAktuell.current();
    };
    const ende = (e: AnimationEvent) => {
      if (e.target === el) fertig();
    };
    // Keine Ausfahrt definiert (Desktop-Spalte, reduzierte Bewegung): sofort zu.
    if (getComputedStyle(el).animationName === "none") return fertig();
    el.addEventListener("animationend", ende);
    notfall.id = window.setTimeout(fertig, 400);
  }, []);
  // Nach dem Schliessen aufräumen — der Markt bleibt im DOM und öffnet wieder.
  useEffect(() => {
    if (!offen) return;
    const el = inhalt.current;
    return () => {
      faehrtAus.current = false;
      el?.removeAttribute("data-raus");
      if (el) el.style.translate = "";
      el?.previousElementSibling?.removeAttribute("data-raus");
      el?.parentElement?.removeAttribute("data-raus");
    };
  }, [offen]);
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
    // Tiefe aus einem eigenen Zähler, nicht aus history.state: Der hinkt nach
    // einem eigenen history.back() einen Moment hinterher.
    const tiefe = ++offeneSheets;

    const aufTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aktuelleTiefe() === tiefe) zu();
    };
    const aufZurueck = (e: PopStateEvent) => {
      if (eigeneEreignisse.has(e)) return;
      // Nur schliessen, wenn der eigene Eintrag weg ist — nicht, wenn bloss
      // ein Sheet darüber zurückgesprungen ist.
      if (aktuelleTiefe() !== tiefe) return;
      durchZurueck.current = true;
      zu();
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
      offeneSheets--;
      if (!durchZurueck.current && window.history.state?.angeliSheet) {
        eigeneRueckspruenge++;
        window.history.back();
      }
    };
  }, [offen, zu]);

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
        // Das Wegwischen ist bereits die Ausfahrt — zu() soll nicht dazwischenfunken.
        faehrtAus.current = true;
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
    // Bricht iOS die Geste ab (Anruf, Systemgeste), hat der Daumen nicht
    // losgelassen — dann zurückschnappen statt schliessen.
    const abbruch = () => {
      if (!zieht) return;
      verfolgt = zieht = false;
      el.style.transition = "translate 180ms ease-out";
      if (hintergrund) hintergrund.style.transition = "opacity 180ms ease-out";
      setzen(0);
    };
    el.addEventListener("touchcancel", abbruch);
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", bewegen);
      el.removeEventListener("touchend", ende);
      el.removeEventListener("touchcancel", abbruch);
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

  return [inhalt, zu] as const;
}
