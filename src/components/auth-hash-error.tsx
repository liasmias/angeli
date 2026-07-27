"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Fängt Fehler ab, die Supabase im URL-Fragment zurückmeldet.
 *
 * Schlägt ein E-Mail-Link fehl (abgelaufen, schon benutzt, Ziel nicht in der
 * Erlaubnisliste), leitet Supabase auf die Site URL um und hängt den Grund
 * als `#error=…` an. Fragmente erreichen den Server nie — ohne diese
 * Auswertung landet man auf einer scheinbar normalen Seite und weiss nicht,
 * warum nichts passiert ist.
 */
const TEXTE: Record<string, string> = {
  otp_expired:
    "Der Link ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen an — Links gelten nur einmal.",
  access_denied: "Der Link ist nicht mehr gültig. Fordere einen neuen an.",
};

export default function AuthHashError() {
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!window.location.hash.includes("error")) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const code = params.get("error_code") ?? params.get("error");
    if (!code) return;

    setFehler(TEXTE[code] ?? "Der Link konnte nicht verarbeitet werden.");
    // Fragment entfernen, damit die Meldung beim Neuladen nicht wiederkommt.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  if (!fehler) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-amber-900">{fehler}</span>
        <Link
          href="/passwort-vergessen"
          className="pressable shrink-0 rounded-full bg-amber-900 px-4 py-1.5 text-xs font-bold text-white"
        >
          Neuen Link anfordern
        </Link>
      </div>
    </div>
  );
}
