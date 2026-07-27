/**
 * Wortmarke von Angeli: offene Ecke oben links, Kreis unten rechts.
 *
 * Nutzt `currentColor` statt einer festen Farbe, damit dasselbe Logo auf
 * dunklem wie hellem Grund funktioniert — die Farbe kommt von der
 * Textfarbe des umgebenden Elements.
 */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 319.9 302.69"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="Angeli"
    >
      <polygon points="319.9 0 319.9 17.22 20.08 17.22 20.08 302.69 0 302.69 0 0 319.9 0" />
      <circle cx="200.15" cy="182.94" r="119.76" />
    </svg>
  );
}
