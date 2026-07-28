"use client";

import { useState } from "react";
import Jersey from "@/components/jersey";
import { POSITIONS } from "@/lib/formation";
import type { Position } from "@/lib/database.types";
import { getDictionary, type Lang } from "@/lib/i18n";
import type { PlayerDetail } from "@/lib/player-detail";

export interface PastPlayer {
  playerId: number;
  name: string;
  club: string;
  position: Position;
  isStarting: boolean;
  isCaptain: boolean;
  pointsEarned: number | null;
  /** Bankplatz: 0 = Torhüter, 1..3 = Feldspieler in Einwechsel-Reihenfolge. */
  benchOrder: number;
  /** Nach Spielende automatisch getauscht (rein oder raus). */
  autoSubbed: boolean;
  /** Statistik und Punkte-Aufschlüsselung fürs Popup. */
  detail?: PlayerDetail;
}

type TeamDict = ReturnType<typeof getDictionary>["team"];

/** Reihenfolge der Zeilen im Popup — wie in der Regeltabelle. */
const KATEGORIEN = [
  "minutes", "goals", "assists", "clean_sheet", "goals_conceded", "saves",
  "penalties_saved", "penalties_conceded", "yellow_cards", "red_cards", "own_goals",
] as const;

function Popup({
  p, gameweekNumber, lang, onClose,
}: {
  p: PastPlayer;
  gameweekNumber: number;
  lang: Lang;
  onClose: () => void;
}) {
  const dict = getDictionary(lang);
  const t = dict.team;
  const posLabel = dict.builder.positions;
  const d = p.detail;

  // Nur Zeilen zeigen, die etwas hergeben — sonst elf Nullen. Minuten immer.
  const zeilen = d
    ? KATEGORIEN.map((k) => {
        const punkte = d.breakdown[k] ?? 0;
        const menge =
          k === "clean_sheet"
            ? punkte > 0 ? 1 : 0
            : (d.stats[k as keyof typeof d.stats] as number) ?? 0;
        return { k, menge, punkte };
      }).filter((z) => z.k === "minutes" || z.menge !== 0 || z.punkte !== 0)
    : [];
  const basis = zeilen.reduce((s, z) => s + z.punkte, 0);
  const total = basis * (p.isCaptain ? 2 : 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="chamfer max-h-full w-full max-w-md overflow-y-auto bg-white shadow-xl"
      >
        {/* Kopf: Name, Position/Club, Gegner */}
        <div className="brand-gradient relative flex items-center gap-4 px-5 py-5 text-white">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold leading-tight">{p.name}</h2>
            <p className="mt-1 text-sm font-semibold text-white/80">
              {posLabel[p.position]} / {p.club}
            </p>
            {d?.opponent && (
              <p className="mt-1 inline-block rounded bg-black/25 px-2 py-0.5 text-xs font-bold">
                v {d.opponent}
              </p>
            )}
          </div>
          <Jersey club={p.club} size={64} />
          <button
            type="button"
            onClick={onClose}
            aria-label={t.detailClose}
            className="pressable absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/30 text-lg font-bold leading-none hover:bg-black/50"
          >
            ✕
          </button>
        </div>

        {/* Spieltag, Anpfiff, Resultat */}
        <div className="flex items-center justify-between gap-3 border-b border-brand-deep/10 bg-brand-deep/5 px-5 py-2.5 text-sm">
          <span className="font-bold text-brand-deep">{t.detailGameweek(gameweekNumber)}</span>
          {d?.kickoff && (
            <span className="text-brand-deep/60">
              {new Date(d.kickoff).toLocaleString(lang === "en" ? "en-GB" : "de-CH", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                timeZone: "Europe/Zurich",
              })}
            </span>
          )}
        </div>

        {d?.score && (
          <div className="flex items-center justify-center gap-3 py-4">
            <span className="rounded-lg bg-brand-deep px-4 py-1.5 text-lg font-bold tabular-nums text-brand-accent">
              {d.score}
            </span>
          </div>
        )}

        {/* Punktetabelle */}
        {zeilen.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-brand-deep/50">{t.detailNoData}</p>
        ) : (
          <div className="px-5 pb-5">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-deep/10 text-left text-[11px] font-bold uppercase tracking-wide text-brand-deep/50">
                  <th className="py-2">{t.detailStat}</th>
                  <th className="py-2 text-right">{t.detailAmount}</th>
                  <th className="py-2 text-right">{t.detailPoints}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-deep/5">
                {zeilen.map((z) => (
                  <tr key={z.k}>
                    <td className="py-1.5 text-brand-deep/80">{t.statLabels[z.k]}</td>
                    <td className="py-1.5 text-right tabular-nums text-brand-deep/70">{z.menge}</td>
                    <td
                      className={`py-1.5 text-right font-bold tabular-nums ${
                        z.punkte < 0 ? "text-brand-danger" : z.punkte > 0 ? "text-emerald-600" : "text-brand-deep/40"
                      }`}
                    >
                      {z.punkte > 0 ? `+${z.punkte}` : z.punkte}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-brand-deep/15">
                  <td className="py-2 font-bold text-brand-deep" colSpan={2}>
                    {t.detailTotal}
                    {p.isCaptain && (
                      <span className="ml-2 rounded bg-black px-1.5 py-0.5 text-[10px] font-bold text-brand-accent">
                        C ×2
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right text-lg font-bold tabular-nums text-brand-deep">
                    {total}
                  </td>
                </tr>
              </tfoot>
            </table>
            {p.isCaptain && (
              <p className="mt-2 text-[11px] text-brand-deep/50">{t.detailCaptainNote}</p>
            )}
            {d?.rating !== null && d?.rating !== undefined && (
              <p className="mt-2 text-[11px] text-brand-deep/50">
                {t.detailRating}: ★ {d.rating.toFixed(1)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Karte({
  p, benchBoost, t, onOpen,
}: {
  p: PastPlayer;
  benchBoost: boolean;
  t: TeamDict;
  onOpen: () => void;
}) {
  // Getauschte Spieler kennzeichnen — sonst wundert man sich, warum jemand
  // auf der Bank Punkte bringt oder ein Startspieler plötzlich dort steht.
  const marke = p.autoSubbed ? (p.isStarting ? t.autoSubbedIn : t.autoSubbedOut) : null;
  // Der Captain zählt doppelt — deshalb hier auch doppelt anzeigen.
  const zaehlt = p.isStarting || benchBoost;
  const punkte = p.pointsEarned === null ? null : p.pointsEarned * (p.isCaptain ? 2 : 1);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={marke ? `${p.name} — ${marke}` : p.name}
      className="pressable relative flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center"
    >
      {p.isCaptain && (
        <span className="absolute -right-0.5 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-brand-accent ring-2 ring-white sm:h-6 sm:w-6 sm:text-xs">
          C
        </span>
      )}
      {marke && (
        <span
          className={`absolute -left-1 top-0 z-10 rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-none ring-1 ring-white/40 sm:text-[9px] ${
            p.isStarting ? "bg-emerald-500 text-white" : "bg-brand-danger text-white"
          }`}
        >
          {p.isStarting ? "↑" : "↓"}
        </span>
      )}
      <div className={`flex w-full flex-col items-center ${zaehlt ? "" : "opacity-60"}`}>
        <Jersey club={p.club} fluid />
        <div className="w-full overflow-hidden rounded-t bg-white px-1 py-0.5 text-center text-[10px] font-bold leading-4 text-brand-deep shadow sm:px-1.5 sm:text-sm sm:leading-5">
          <span className="block truncate">{p.name}</span>
        </div>
        <div className="w-full rounded-b bg-brand-deep px-1 py-0.5 text-center text-[11px] font-bold leading-4 tabular-nums text-brand-accent sm:text-xs">
          {punkte === null ? "—" : `${punkte} ${t.pts}`}
        </div>
      </div>
    </button>
  );
}

export default function PastGameweek({
  players,
  benchBoost,
  wildcard,
  lang,
  gameweekNumber,
}: {
  players: PastPlayer[];
  benchBoost: boolean;
  wildcard: boolean;
  lang: Lang;
  gameweekNumber: number;
}) {
  const dict = getDictionary(lang);
  const t = dict.team;
  const posLabel = dict.builder.positions;
  const [offen, setOffen] = useState<PastPlayer | null>(null);

  const starters = (pos: Position) =>
    players.filter((p) => p.isStarting && p.position === pos);
  // Bank in Einwechsel-Reihenfolge: Torhüter zuerst, dann 1..3.
  const bench = players
    .filter((p) => !p.isStarting)
    .sort((a, b) => a.benchOrder - b.benchOrder);

  return (
    <>
      {(benchBoost || wildcard) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {wildcard && (
            <span className="rounded-full bg-brand-magenta/10 px-3 py-1 text-xs font-bold text-brand-magenta">
              {t.wildcardWasActive}
            </span>
          )}
          {benchBoost && (
            <span className="rounded-full bg-brand-accent/20 px-3 py-1 text-xs font-bold text-brand-deep">
              {t.benchBoostWasActive}
            </span>
          )}
        </div>
      )}

      <div className="pitch px-2 py-8 sm:px-6">
        <div className="relative z-10 flex flex-col gap-7">
          {POSITIONS.map((pos) => {
            const reihe = starters(pos);
            return (
              <div key={pos} className="flex items-start justify-center gap-1.5 sm:gap-5">
                {reihe.length === 0 ? (
                  <span className="py-6 text-[11px] font-semibold text-white/60">
                    {posLabel[pos]}
                  </span>
                ) : (
                  reihe.map((p) => (
                    <Karte
                      key={p.playerId}
                      p={p}
                      benchBoost={benchBoost}
                      t={t}
                      onOpen={() => setOffen(p)}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 chamfer bg-brand-deep/95 px-4 py-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
          {t.bench} {benchBoost && <span className="text-brand-accent">{t.benchCounted}</span>}
        </div>
        <div className="flex items-start gap-1.5 sm:gap-5">
          {bench.length === 0 ? (
            <p className="text-sm text-white/50">—</p>
          ) : (
            bench.map((p) => (
              <Karte
                key={p.playerId}
                p={p}
                benchBoost={benchBoost}
                t={t}
                onOpen={() => setOffen(p)}
              />
            ))
          )}
        </div>
      </div>

      {offen && (
        <Popup
          p={offen}
          gameweekNumber={gameweekNumber}
          lang={lang}
          onClose={() => setOffen(null)}
        />
      )}
    </>
  );
}
