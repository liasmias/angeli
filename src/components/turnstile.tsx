"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { reset: (container?: HTMLElement) => void };
  }
}

/**
 * Cloudflare-Turnstile-Widget (Bot-Schutz für Registrierung und Login).
 *
 * Rendert nur, wenn NEXT_PUBLIC_TURNSTILE_SITE_KEY gesetzt ist — solange der
 * Key fehlt, ist der Bot-Schutz inaktiv und die Formulare laufen unverändert.
 * Das Widget fügt dem umgebenden <form> automatisch ein verstecktes Feld
 * `cf-turnstile-response` mit dem Token hinzu.
 *
 * `resetSignal`: Turnstile-Token sind EINMALIG gültig. Nach einem
 * fehlgeschlagenen Versuch (falsches Passwort o. ä.) bleibt das verbrauchte
 * Token im Formular stehen, und jeder weitere Versuch scheitert am
 * Bot-Schutz — der Nutzer käme ohne Neuladen nicht mehr hinein. Ändert sich
 * dieser Wert, holt das Widget deshalb ein frisches Token.
 */
export default function Turnstile({ resetSignal }: { resetSignal?: unknown }) {
  const container = useRef<HTMLDivElement>(null);
  const ersterLauf = useRef(true);

  useEffect(() => {
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    if (container.current && window.turnstile) {
      window.turnstile.reset(container.current);
    }
  }, [resetSignal]);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        async
        defer
        strategy="afterInteractive"
      />
      <div
        ref={container}
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="light"
        data-refresh-expired="auto"
      />
    </>
  );
}
