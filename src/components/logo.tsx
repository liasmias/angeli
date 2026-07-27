/**
 * Wortmarke von Angeli: offene Ecke oben links mit Pfeil.
 *
 * Nutzt `currentColor` statt einer festen Farbe, damit sich das Logo über
 * die Textfarbe des umgebenden Elements steuern lässt — auf dunklem Grund
 * weiss, bei Bedarf anderswo auch anders.
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
      <path d="M319.9,0v17.22H20.08v285.47H0V8.28C0,3.71,3.71,0,8.28,0h311.62Z" />
      <path d="M9.45,20.15v20.88l44.78,13.28v59.97l-44.78,13.28v20.88l165.25-50.55c3.45-1.05,5.8-4.24,5.8-7.84v-11.63c0-3.54-2.31-6.66-5.69-7.7L9.45,20.15ZM73.84,108.47v-48.34l81.5,24.17-81.5,24.17Z" />
    </svg>
  );
}
