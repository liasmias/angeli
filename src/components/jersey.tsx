"use client";

import { useState } from "react";

/**
 * Trikots liegen als PNG in public/jerseys/<KÜRZEL>.png — einfach ersetzen für
 * eigene Designs.
 *
 * `fluid` skaliert das Trikot mit der Kartenbreite statt fester Pixelgrösse.
 * Auf dem Spielfeld nötig, damit auch fünf Spieler nebeneinander in eine
 * Reihe passen.
 */
export default function Jersey({
  club,
  size = 46,
  fluid = false,
}: {
  club: string;
  size?: number;
  fluid?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const className = fluid
    ? "aspect-square w-[62%] max-w-16 select-none drop-shadow-sm"
    : "select-none drop-shadow-sm";
  const dimensions = fluid ? {} : { width: size, height: size };

  if (failed) {
    return (
      <svg {...dimensions} viewBox="0 0 64 64" className={className} aria-hidden>
        <path
          d="M22 7 L8 15 L14 28 L19 24 L19 57 L45 57 L45 24 L50 28 L56 15 L42 7 C40 12 24 12 22 7 Z"
          fill="#e5e7eb"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- kleine statische Assets, kein next/image nötig
    <img
      src={`/jerseys/${club}.png`}
      alt=""
      {...dimensions}
      draggable={false}
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
