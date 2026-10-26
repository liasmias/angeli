"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Umschalter aus zwei oder mehr Links mit gleitender Markierung.
 *
 * Die Markierung springt sofort beim Tippen an die neue Stelle — nicht erst,
 * wenn der Server die neue Ansicht geliefert hat. Sonst stünde sie bei
 * mobilem Netz eine Sekunde lang falsch und spränge dann. Es bleiben Links,
 * damit die Ansicht teilbar ist und ohne JavaScript funktioniert.
 */
export default function SegmentUmschalter({
  optionen,
  aktiv,
}: {
  optionen: { href: string; label: string }[];
  aktiv: number;
}) {
  const router = useRouter();
  const [gewaehlt, setGewaehlt] = useState(aktiv);
  const [, startTransition] = useTransition();
  // Kommt eine andere Ansicht vom Server (Zurück-Taste), folgt die Markierung.
  const [zuletzt, setZuletzt] = useState(aktiv);
  if (aktiv !== zuletzt) {
    setZuletzt(aktiv);
    setGewaehlt(aktiv);
  }

  const breite = 100 / optionen.length;
  return (
    <div className="relative my-4 flex fase-knopf bg-brand-deep/5 p-1">
      <span
        aria-hidden
        className="segment-markierung absolute inset-y-1 left-1 fase-knopf bg-brand-deep"
        style={{
          width: `calc(${breite}% - ${(2 * 4) / optionen.length}px)`,
          transform: `translateX(${gewaehlt * 100}%)`,
        }}
      />
      {optionen.map((o, i) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={i === aktiv ? "page" : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            setGewaehlt(i);
            startTransition(() => router.push(o.href, { scroll: false }));
          }}
          className={`relative flex-1 px-4 py-1.5 text-center text-sm font-bold transition-colors duration-200 ${
            i === gewaehlt ? "text-brand-accent" : "text-brand-deep/70 hover:text-brand-deep"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
