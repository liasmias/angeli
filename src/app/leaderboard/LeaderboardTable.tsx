"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDictionary, type Lang } from "@/lib/i18n";

export interface StandingRow {
  user_id: string;
  username: string;
  total_points: number;
  /** 1-basiert, aus der Gesamtwertung — bleibt auch in gefilterten Listen stehen. */
  rank: number;
  /** Plätze gegenüber der Vorrunde: positiv = gutgemacht. null = kein Vergleich. */
  movement: number | null;
}

/** Pfeil mit Platzdifferenz — nichts anzeigen, wo es nichts zu vergleichen gibt. */
function Bewegung({ wert }: { wert: number | null }) {
  if (wert === null) return <span className="w-9 shrink-0" aria-hidden />;
  if (wert === 0) {
    return (
      <span className="w-9 shrink-0 text-center text-xs font-bold text-brand-deep/25" aria-hidden>
        –
      </span>
    );
  }
  const hoch = wert > 0;
  return (
    <span
      className={`w-9 shrink-0 text-center text-xs font-bold tabular-nums ${
        hoch ? "text-brand-grass" : "text-brand-magenta"
      }`}
      title={`${hoch ? "+" : ""}${wert}`}
    >
      {hoch ? "▲" : "▼"}
      {Math.abs(wert)}
    </span>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];
const STORAGE_KEY = "angeli-favoriten";

/** Favoriten liegen bewusst im localStorage: kein Login-Zwang, keine Migration —
 *  dafür gelten sie nur auf dem jeweiligen Gerät. */
function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function LeaderboardTable({ rows, lang }: { rows: StandingRow[]; lang: Lang }) {
  const t = getDictionary(lang).leaderboard;
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  // localStorage gibt es erst im Browser — nach dem ersten Render laden.
  useEffect(() => setFavorites(loadFavorites()), []);

  function toggleFavorite(username: string) {
    setFavorites((prev) => {
      const next = prev.includes(username)
        ? prev.filter((f) => f !== username)
        : [...prev, username];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Speicher voll oder blockiert — Favoriten gelten dann nur bis zum Reload. */
      }
      return next;
    });
  }

  const favoriteRows = useMemo(
    () => rows.filter((r) => favorites.includes(r.username)),
    [rows, favorites]
  );
  const visible = useMemo(
    () =>
      search === ""
        ? rows
        : rows.filter((r) => r.username.toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  );

  function Zeile({ row }: { row: StandingRow }) {
    const istFavorit = favorites.includes(row.username);
    return (
      <li className="flex items-center">
        <button
          type="button"
          onClick={() => toggleFavorite(row.username)}
          aria-label={istFavorit ? t.removeFavorite(row.username) : t.addFavorite(row.username)}
          title={istFavorit ? t.removeFavorite(row.username) : t.addFavorite(row.username)}
          className={`pressable ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
            istFavorit ? "text-amber-400" : "text-brand-deep/25 hover:text-amber-400"
          }`}
        >
          {istFavorit ? "★" : "☆"}
        </button>
        <Link
          href={`/squad/${encodeURIComponent(row.username)}`}
          className="pressable-subtle flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-1 pr-5 hover:bg-brand-deep/5"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="w-8 shrink-0 text-center font-bold tabular-nums text-brand-deep/40">
              {MEDALS[row.rank - 1] ?? row.rank}
            </span>
            <span className="truncate font-semibold text-brand-deep">{row.username}</span>
          </span>
          <span className="ml-auto flex shrink-0 items-center">
            <Bewegung wert={row.movement} />
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-brand-accent/20 px-3 py-1 font-bold tabular-nums text-brand-deep">
              {row.total_points}
            </span>
            <span className="text-brand-deep/30" aria-hidden>
              ›
            </span>
          </span>
        </Link>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Favoriten: die markierten Teams kompakt zuoberst, saisonlang vergleichbar. */}
      {favoriteRows.length > 0 && (
        <div className="overflow-hidden chamfer bg-white shadow-sm">
          <div className="flex items-center gap-2 bg-brand-deep px-5 py-3 text-sm font-bold text-white">
            <span className="text-amber-400">★</span> {t.favorites}
          </div>
          <ol className="divide-y divide-brand-deep/5">
            {favoriteRows.map((row) => (
              <Zeile key={row.user_id} row={row} />
            ))}
          </ol>
        </div>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t.search}
        className="rounded-lg border border-brand-deep/15 bg-white px-3 py-2 text-sm outline-none focus:border-brand-magenta"
      />

      <div className="overflow-hidden chamfer bg-white shadow-sm">
        <div className="brand-gradient flex items-center justify-between px-5 py-3 text-sm font-bold text-white">
          <span>{t.team}</span>
          <span>{t.points}</span>
        </div>
        <ol className="divide-y divide-brand-deep/5">
          {visible.map((row) => (
            <Zeile key={row.user_id} row={row} />
          ))}
          {rows.length > 0 && visible.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-brand-deep/50">{t.noMatch}</li>
          )}
          {rows.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-brand-deep/50">{t.empty}</li>
          )}
        </ol>
      </div>

      {favoriteRows.length === 0 && rows.length > 0 && (
        <p className="text-xs text-brand-deep/50">{t.favoritesHint}</p>
      )}
    </div>
  );
}
