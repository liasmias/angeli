/**
 * Kleine einfarbige Symbole in currentColor. Sie ersetzen Emojis (👥 🚀 🃏),
 * die je nach Gerät anders aussahen und wie Platzhalter wirkten.
 */
type Props = { className?: string };

const basis = "inline-block shrink-0 align-[-0.125em]";

/** Besitzquote: zwei Köpfe. */
export function SymbolBesitzer({ className = "h-3 w-3" }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={`${basis} ${className}`}>
      <circle cx="6" cy="5" r="2.6" />
      <path d="M1 13.5c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6V14H1z" />
      <circle cx="11.5" cy="5.6" r="2.1" opacity=".6" />
      <path d="M12 9.2c1.9.3 3 1.8 3 4.1V14h-3.2v-.5c0-1.7-.6-3.1-1.6-4.1.6-.2 1.2-.3 1.8-.2z" opacity=".6" />
    </svg>
  );
}

/** Wildcard: Spielkarte mit Stern. */
export function SymbolWildcard({ className = "h-4 w-4" }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className={`${basis} ${className}`}>
      <rect x="3" y="1.75" width="10" height="12.5" rx="1.5" />
      <path d="M8 5.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Bench Boost: Pfeil nach oben über einer Bank. */
export function SymbolBenchBoost({ className = "h-4 w-4" }: Props) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`${basis} ${className}`}>
      <path d="M8 10V2.5M4.8 5.6 8 2.5l3.2 3.1" />
      <path d="M2.5 12.5h11M4 12.5V15M12 12.5V15" />
    </svg>
  );
}
