import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

/**
 * Eingabefelder im App-Stil: hellgraue Fläche ohne Rahmen, Fokus als
 * dezenter Ring. Eine Vorlage für Statistik, Rangliste und Transfermarkt,
 * damit sie nicht wieder auseinanderlaufen.
 *
 * Auf weissen Karten genügt 5 % Grün; direkt auf dem hellgrauen
 * Seitenhintergrund (Rangliste) braucht es 8 %, sonst verschwimmt das Feld.
 */
function flaeche(aufSeite: boolean) {
  return aufSeite ? "bg-brand-deep/[0.08] focus:bg-brand-deep/[0.1]" : "bg-brand-deep/5 focus:bg-brand-deep/[0.07]";
}

const GEMEINSAM =
  "rounded-lg text-brand-deep outline-none focus:ring-2 focus:ring-brand-magenta/30";

export function Suchfeld({
  aufSeite = false,
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { aufSeite?: boolean }) {
  return (
    <input
      type="search"
      style={{ WebkitAppearance: "none" }}
      className={`w-full min-w-0 px-3 py-2 text-base placeholder:text-brand-deep/50 sm:py-1.5 sm:text-sm ${GEMEINSAM} ${flaeche(aufSeite)} ${className}`}
      {...rest}
    />
  );
}

/**
 * Auswahlfeld mit eigenem Pfeil. Der Systempfeil sass je nach Browser direkt
 * am Rand und ragte in schmalen Feldern fast hinaus; dieser hat einen festen
 * Platz mit Abstand und lässt Klicks durch.
 */
export function Auswahl({
  aufSeite = false,
  className = "",
  huelle = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { aufSeite?: boolean; huelle?: string }) {
  return (
    <div className={`relative min-w-0 ${huelle}`}>
      <select
        className={`w-full min-w-0 appearance-none py-2 pl-2.5 pr-6 text-[15px] sm:py-1.5 sm:text-sm ${GEMEINSAM} ${flaeche(aufSeite)} ${className}`}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-brand-deep/55"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
