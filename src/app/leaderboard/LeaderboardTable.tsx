"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDictionary, type Lang } from "@/lib/i18n";
import { Suchfeld } from "@/components/feld";

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
      <span className="w-9 shrink-0 text-center text-xs font-bold text-brand-deep/55" aria-hidden>
        –
      </span>
    );
  }
  const hoch = wert > 0;
  return (
    <span
      className={`w-9 shrink-0 text-center text-xs font-bold tabular-nums ${
        hoch ? "text-brand-grass-text" : "text-brand-magenta"
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

/**
 * Eine Ranglistenzeile — bewusst ausserhalb von LeaderboardTable.
 *
 * Vorher war sie innerhalb definiert. Damit war "Zeile" bei jedem Render ein
 * neuer Komponententyp, und React baute bei jedem Tastendruck in der Suche
 * und jedem Stern alle Zeilen vollständig ab und neu auf — samt Verlust von
 * Fokus und Hover-Zustand. Mit memo wird eine Zeile nur neu gezeichnet, wenn
 * sich ihre eigenen Werte ändern.
 */
const Zeile = memo(function Zeile({
  row,
  istFavorit,
  onToggle,
  t,
}: {
  row: StandingRow;
  istFavorit: boolean;
  onToggle: (username: string) => void;
  t: ReturnType<typeof getDictionary>["leaderboard"];
}) {
  return (
    <li className="flex items-center">
      <button
        type="button"
        onClick={() => onToggle(row.username)}
        aria-label={istFavorit ? t.removeFavorite(row.username) : t.addFavorite(row.username)}
        title={istFavorit ? t.removeFavorite(row.username) : t.addFavorite(row.username)}
        className={`pressable ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
          istFavorit ? "text-amber-400" : "text-brand-deep/55 hover:text-amber-400"
        }`}
      >
        {istFavorit ? "★" : "☆"}
      </button>
      <Link
        href={`/squad/${encodeURIComponent(row.username)}`}
        className="pressable-subtle flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-1 pr-5 hover:bg-brand-deep/5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="w-8 shrink-0 text-center font-bold tabular-nums text-brand-deep/65">
            {MEDALS[row.rank - 1] ?? row.rank}
          </span>
          <span className="truncate font-semibold text-brand-deep">{row.username}</span>
        </span>
        <span className="ml-auto flex shrink-0 items-center">
          <Bewegung wert={row.movement} />
        </span>
        {/* Ohne Pfeil: Die ganze Zeile ist bereits ein Link, das Zeichen war
            nur Dekoration — auf dem Handy brachen dafuer die Namen ab. */}
        <span className="flex shrink-0 items-center">
          <span className="rounded-full bg-brand-accent/20 px-3 py-1 font-bold tabular-nums text-brand-deep">
            {row.total_points}
          </span>
        </span>
      </Link>
    </li>
  );
});

export default function LeaderboardTable({ rows, lang }: { rows: StandingRow[]; lang: Lang }) {
  const t = getDictionary(lang).leaderboard;
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  // localStorage gibt es erst im Browser — nach dem ersten Render laden.
  useEffect(() => setFavorites(loadFavorites()), []);

  // Stabile Referenz, sonst hebelt eine neue Funktion je Render das memo aus.
  const toggleFavorite = useCallback((username: string) => {
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
  }, []);

  const favoriteRows = useMemo(
    () => rows.filter((r) => favorites.includes(r.username)),
    [rows, favorites]
  );
  // Das Eingabefeld folgt sofort, die Liste darf einen Moment hinterher sein —
  // so blockiert das Filtern nie das Tippen.
  const suche = useDeferredValue(search);
  const visible = useMemo(
    () =>
      suche === ""
        ? rows
        : rows.filter((r) => r.username.toLowerCase().includes(suche.toLowerCase())),
    [rows, suche]
  );

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
              <Zeile key={row.user_id} row={row} istFavorit={favorites.includes(row.username)} onToggle={toggleFavorite} t={t} />
            ))}
          </ol>
        </div>
      )}

      <Suchfeld
        aufSeite
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t.search}
      />

      <div className="overflow-hidden chamfer bg-white shadow-sm">
        <div className="brand-gradient flex items-center justify-between px-5 py-3 text-sm font-bold text-white">
          <span>{t.team}</span>
          <span>{t.points}</span>
        </div>
        <ol className="divide-y divide-brand-deep/5">
          {visible.map((row) => (
            <Zeile key={row.user_id} row={row} istFavorit={favorites.includes(row.username)} onToggle={toggleFavorite} t={t} />
          ))}
          {rows.length > 0 && visible.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-brand-deep/65">{t.noMatch}</li>
          )}
          {rows.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-brand-deep/65">{t.empty}</li>
          )}
        </ol>
      </div>

      {favoriteRows.length === 0 && rows.length > 0 && (
        <p className="text-xs text-brand-deep/65">{t.favoritesHint}</p>
      )}
    </div>
  );
}
