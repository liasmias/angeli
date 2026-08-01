"use client";

import { useState } from "react";
import { Popup, type PastPlayer } from "@/app/team/PastGameweek";
import type { Lang } from "@/lib/i18n";

/**
 * Klickbare "Beste Spieler"-Chips im Spielplan. Ein Tipp öffnet dasselbe
 * Punkte-Popup wie in der Aufstellungs-Ansicht — mit vollständiger
 * Aufschlüsselung, Rating und Partie-Kontext.
 */
export default function BestPlayerChips({
  players,
  gameweekNumber,
  lang,
}: {
  players: PastPlayer[];
  gameweekNumber: number;
  lang: Lang;
}) {
  const [offen, setOffen] = useState<number | null>(null);
  const gewaehlt = players.find((p) => p.playerId === offen);

  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {players.map((p) => (
        <button
          key={p.playerId}
          type="button"
          onClick={() => setOffen(p.playerId)}
          className="pressable-subtle cursor-pointer rounded-full bg-brand-accent/20 px-2.5 py-0.5 text-xs font-bold text-brand-deep hover:bg-brand-accent/40"
        >
          {p.name} ({p.pointsEarned})
        </button>
      ))}
      {gewaehlt && (
        <Popup
          p={gewaehlt}
          gameweekNumber={gameweekNumber}
          lang={lang}
          onClose={() => setOffen(null)}
        />
      )}
    </div>
  );
}
