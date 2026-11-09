"use client";

import { useState, useTransition } from "react";
import { getDictionary, type Lang } from "@/lib/i18n";
import { abstimmen } from "./umfrage-actions";

type Antwort = "phone" | "web" | "both";
const ANTWORTEN: Antwort[] = ["phone", "web", "both"];

/**
 * Kleine Umfrage oben auf der Team-Seite, nur solange dieses Konto noch nicht
 * abgestimmt hat. Danach ein kurzes Danke; die Ergebnisse sieht nur der Admin.
 */
export default function Umfrage({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).umfrage;
  const [fertig, setFertig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starten] = useTransition();

  const waehlen = (antwort: Antwort) =>
    starten(async () => {
      const res = await abstimmen(antwort);
      if (res.ok) setFertig(true);
      else setFehler(res.error ?? null);
    });

  return (
    <section className="mb-4 chamfer bg-white px-4 py-3 shadow-sm" aria-label={t.frage}>
      {fertig ? (
        <p role="status" className="text-sm font-semibold text-status-ok">
          {t.danke}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <p className="text-sm font-bold text-brand-deep">{t.frage}</p>
          <div className="flex flex-1 gap-2">
            {ANTWORTEN.map((a) => (
              <button
                key={a}
                type="button"
                disabled={laeuft}
                onClick={() => waehlen(a)}
                className="pressable min-h-11 flex-1 fase-knopf bg-brand-deep/5 px-3 text-sm font-bold text-brand-deep hover:bg-brand-accent/30 disabled:opacity-50 sm:min-h-9"
              >
                {t.antworten[a]}
              </button>
            ))}
          </div>
        </div>
      )}
      {fehler && <p className="mt-1 text-xs font-semibold text-brand-danger">{fehler}</p>}
    </section>
  );
}
