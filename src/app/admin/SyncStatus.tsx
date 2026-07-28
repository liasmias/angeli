"use client";

import { useState, useTransition } from "react";
import { triggerSync } from "./actions";

/**
 * System-Status: Heartbeat des letzten Sync-Laufs plus manueller Anstoss.
 * Rot, wenn der letzte Lauf länger als 35 Minuten zurückliegt — der Cron
 * kommt alle 15 Minuten, zwei verpasste Läufe sind ein echtes Signal.
 */
export default function SyncStatus({
  lastSyncAt,
  lastSyncNote,
}: {
  lastSyncAt: string | null;
  lastSyncNote: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<{ ok: boolean; message: string } | null>(null);

  const alterMin = lastSyncAt
    ? Math.round((Date.now() - new Date(lastSyncAt).getTime()) / 60000)
    : null;
  const gesund = alterMin !== null && alterMin <= 35;

  return (
    <section
      className={`mb-6 chamfer border-2 p-4 ${
        gesund ? "border-emerald-200 bg-emerald-50" : "border-brand-danger/30 bg-brand-danger/5"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-brand-deep">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                gesund ? "bg-emerald-500" : "animate-pulse bg-brand-danger"
              }`}
              aria-hidden
            />
            {gesund
              ? `Sync läuft — letzter Lauf vor ${alterMin} Min.`
              : alterMin === null
                ? "Noch kein Sync-Heartbeat — Migration 0011 ausgeführt?"
                : `Letzter Sync vor ${alterMin} Min. — Cron prüfen!`}
          </div>
          {lastSyncNote && (
            <p className="mt-0.5 text-xs text-brand-deep/60">{lastSyncNote}</p>
          )}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMeldung(null);
              setMeldung(await triggerSync());
            })
          }
          className="pressable rounded-full bg-brand-deep px-5 py-2 text-sm font-bold text-brand-accent disabled:opacity-50"
        >
          {pending ? "Synchronisiert…" : "Jetzt synchronisieren"}
        </button>
      </div>
      {meldung && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
            meldung.ok ? "bg-emerald-100 text-emerald-800" : "bg-brand-danger/10 text-brand-danger"
          }`}
        >
          {meldung.message}
        </p>
      )}
    </section>
  );
}
