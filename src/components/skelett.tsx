/**
 * Platzhalter, solange eine Seite auf dem Server entsteht.
 *
 * Ohne sie blieb nach einem Tipp die alte Seite stehen, bis die neue fertig
 * war — bei mobilem Netz ein, zwei Sekunden ohne jedes Zeichen, dass etwas
 * passiert. Die iOS-Richtlinien verlangen, so früh wie möglich etwas zu
 * zeigen, und zwar in der Form des kommenden Inhalts: Dann springt beim
 * Eintreffen nichts, und das Auge ist schon dort, wo die Daten erscheinen.
 *
 * Bewusst ohne Text und ohne Spinner. Das sanfte Pulsieren entfällt bei
 * "Bewegung reduzieren" (siehe globals.css).
 */

function Balken({ className = "" }: { className?: string }) {
  return <div className={`skelett rounded-md bg-brand-deep/10 ${className}`} />;
}

function Rahmen({ children, breit = false }: { children: React.ReactNode; breit?: boolean }) {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Lädt"
      className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 ${breit ? "max-w-4xl" : "max-w-2xl"}`}
    >
      <Balken className="mb-2 h-7 w-40" />
      <Balken className="mb-6 h-4 w-64 max-w-full" />
      {children}
    </main>
  );
}

/** Rangliste: Liste mit Rang, Name und Punkteblase. */
export function SkelettListe({ zeilen = 10 }: { zeilen?: number }) {
  return (
    <Rahmen>
      <Balken className="mb-4 h-10 w-full rounded-full" />
      <div className="overflow-hidden chamfer bg-white shadow-sm">
        <div className="h-11 bg-brand-deep/15" />
        {Array.from({ length: zeilen }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-brand-deep/5 px-5 py-3.5">
            <Balken className="h-5 w-6" />
            <Balken className="h-5 flex-1" />
            <Balken className="h-7 w-12 rounded-full" />
          </div>
        ))}
      </div>
    </Rahmen>
  );
}

/** Statistik: Filterzeile und Tabelle. */
export function SkelettTabelle({ zeilen = 12 }: { zeilen?: number }) {
  return (
    <Rahmen breit>
      <div className="overflow-hidden chamfer bg-white shadow-sm">
        <div className="flex gap-2 border-b border-brand-deep/10 p-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Balken key={i} className="h-7 w-12 rounded-full" />
          ))}
        </div>
        {Array.from({ length: zeilen }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-brand-deep/5 px-3 py-2.5">
            <Balken className="h-4 w-5" />
            <Balken className="h-6 w-6 rounded-full" />
            <Balken className="h-4 flex-1" />
            <Balken className="h-4 w-8" />
            <Balken className="h-6 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </Rahmen>
  );
}

/** Spieltage: Karten mit Partien. */
export function SkelettKarten({ karten = 2, partien = 6 }: { karten?: number; partien?: number }) {
  return (
    <Rahmen>
      <div className="flex flex-col gap-6">
        {Array.from({ length: karten }, (_, k) => (
          <div key={k} className="overflow-hidden chamfer bg-white shadow-sm">
            <div className="h-10 bg-brand-deep/15" />
            {Array.from({ length: partien }, (_, i) => (
              <div key={i} className="flex items-center gap-3 border-t border-brand-deep/5 px-5 py-3.5">
                <Balken className="h-4 flex-1" />
                <Balken className="h-7 w-14" />
                <Balken className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Rahmen>
  );
}

/** Team: Spielfeld mit vier Reihen. */
export function SkelettSpielfeld() {
  const reihen = [1, 4, 4, 2];
  return (
    <Rahmen>
      <div className="flex flex-col justify-around gap-6 chamfer bg-brand-grass/25 px-4 py-8">
        {reihen.map((n, r) => (
          <div key={r} className="flex justify-center gap-4">
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="skelett h-12 w-12 rounded-xl bg-white/50" />
                <div className="skelett h-4 w-14 rounded bg-white/50" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Rahmen>
  );
}
