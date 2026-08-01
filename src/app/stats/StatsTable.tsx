"use client";

import { useMemo, useState } from "react";
import type { Position } from "@/lib/database.types";
import { getDictionary, type Lang } from "@/lib/i18n";

export interface StatsRow {
  id: number;
  name: string;
  position: Position;
  price: number;
  club: string;
  totalPoints: number;
  latestPoints: number | null;
  goals: number;
  assists: number;
  /** Summe der Bonuspunkte (Top 3 je Partie) über die Saison. */
  bonus: number;
  /** In wie viel Prozent der gespeicherten Teams der Spieler steckt. */
  owned: number;
  /** Zu-null-Spiele; null bei MID/FWD (Wertung gilt dort nicht). */
  cleanSheets: number | null;
  /** Schnitt der API-Bewertung; null, wenn nie bewertet. */
  rating: number | null;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

type SortKey = "totalPoints" | "latestPoints" | "price" | "name" | "rating" | "goals" | "assists" | "cleanSheets" | "bonus" | "owned";

export default function StatsTable({
  rows,
  latestGameweekNumber,
  lang,
}: {
  rows: StatsRow[];
  latestGameweekNumber: number | null;
  lang: Lang;
}) {
  const t = getDictionary(lang).stats;
  const [filterPos, setFilterPos] = useState<Position | "ALL">("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalPoints");
  const [sortDesc, setSortDesc] = useState(true);

  const clubs = useMemo(() => [...new Set(rows.map((r) => r.club))].sort(), [rows]);

  const visible = useMemo(() => {
    const filtered = rows.filter(
      (r) =>
        (filterPos === "ALL" || r.position === filterPos) &&
        (filterClub === "ALL" || r.club === filterClub) &&
        (search === "" || r.name.toLowerCase().includes(search.toLowerCase()))
    );
    const dir = sortDesc ? -1 : 1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      const av = (a[sortKey] ?? -Infinity) as number;
      const bv = (b[sortKey] ?? -Infinity) as number;
      return dir * (av - bv);
    });
  }, [rows, filterPos, filterClub, search, sortKey, sortDesc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((d) => !d);
    else {
      setSortKey(key);
      setSortDesc(key !== "name");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDesc ? " ↓" : " ↑";
  }

  return (
    <div className="overflow-hidden chamfer bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-brand-deep/10 p-3 sm:flex-row sm:items-center">
        <div className="flex gap-1">
          {(["ALL", ...POSITIONS] as const).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setFilterPos(pos)}
              className={`pressable-subtle rounded-full px-3 py-1 text-xs font-bold ${
                filterPos === pos
                  ? "bg-brand-deep text-brand-accent"
                  : "bg-brand-deep/5 text-brand-deep/70 hover:bg-brand-deep/10"
              }`}
            >
              {pos === "ALL" ? t.all : pos}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2">
          <input
            type="search"
            style={{ WebkitAppearance: "none" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            className="min-w-0 flex-1 rounded-lg border border-brand-deep/15 px-3 py-1.5 text-base outline-none focus:border-brand-magenta sm:text-sm"
          />
          <select
            value={filterClub}
            onChange={(e) => setFilterClub(e.target.value)}
            className="rounded-lg border border-brand-deep/15 px-2 py-1.5 text-base outline-none focus:border-brand-magenta sm:text-sm"
          >
            <option value="ALL">{t.club}</option>
            {clubs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {/* Auf dem Handy sind Preis- und Rating-Spalten ausgeblendet, ihre
              klickbaren Köpfe damit unerreichbar — dieses Feld übernimmt dort
              die Sortierung. Ab sm reichen die Spaltenköpfe. */}
          <select
            value={sortKey}
            onChange={(e) => {
              const key = e.target.value as SortKey;
              setSortKey(key);
              setSortDesc(key !== "name");
            }}
            className="rounded-lg border border-brand-deep/15 px-2 py-1.5 text-base outline-none focus:border-brand-magenta sm:text-sm sm:hidden"
            aria-label={t.sortBy}
          >
            <option value="totalPoints">{t.sortPoints}</option>
            <option value="latestPoints">{t.sortLatest}</option>
            <option value="price">{t.sortPrice}</option>
            <option value="rating">{t.sortRating}</option>
            <option value="goals">{t.sortGoals}</option>
            <option value="assists">{t.sortAssists}</option>
            <option value="cleanSheets">{t.sortCleanSheets}</option>
            <option value="bonus">{t.sortBonus}</option>
            <option value="owned">{t.sortOwned}</option>
            <option value="name">{t.sortName}</option>
          </select>
        </div>
      </div>

      {/*
        Auf dem Handy passen acht Spalten nicht nebeneinander — die Punkte,
        also die wichtigste Zahl, lagen ausserhalb des Bildschirms. Club,
        Position, Preis und Rating wandern dort unter den Namen; ab `sm`
        erscheint wieder die volle Tabelle.
      */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm sm:min-w-[36rem]">
          <thead>
            <tr className="border-b border-brand-deep/10 text-left text-xs font-bold uppercase tracking-wide text-brand-deep/50">
              <th className="px-2 py-2 sm:px-3">#</th>
              <th className="px-2 py-2 sm:px-3">
                <button type="button" onClick={() => toggleSort("name")} className="uppercase">
                  {t.player}{sortIndicator("name")}
                </button>
              </th>
              <th className="hidden px-3 py-2 sm:table-cell">{t.club}</th>
              <th className="hidden px-3 py-2 sm:table-cell">{t.pos}</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("price")} className="uppercase">
                  {t.price}{sortIndicator("price")}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("rating")} className="uppercase" title={t.ratingTitle}>
                  {t.rating}{sortIndicator("rating")}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("goals")} className="uppercase">
                  {t.goals}{sortIndicator("goals")}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("assists")} className="uppercase">
                  {t.assists}{sortIndicator("assists")}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("cleanSheets")} className="uppercase">
                  {t.cleanSheets}{sortIndicator("cleanSheets")}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("bonus")} className="uppercase">
                  {t.bonus}{sortIndicator("bonus")}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("owned")} className="uppercase" title={t.ownedTitle}>
                  {t.owned}{sortIndicator("owned")}
                </button>
              </th>
              {latestGameweekNumber !== null && (
                <th className="px-2 py-2 text-right sm:px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("latestPoints")}
                    className="uppercase"
                  >
                    {t.gwCol(latestGameweekNumber)}
                    {sortIndicator("latestPoints")}
                  </button>
                </th>
              )}
              <th className="px-2 py-2 text-right sm:px-3">
                <button type="button" onClick={() => toggleSort("totalPoints")} className="uppercase">
                  {t.points}{sortIndicator("totalPoints")}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-deep/5">
            {visible.map((r, i) => (
              <tr key={r.id} className="hover:bg-brand-deep/5">
                <td className="px-2 py-2 tabular-nums text-brand-deep/40 sm:px-3">{i + 1}</td>
                <td className="px-2 py-2 sm:px-3">
                  <span className="flex items-center gap-2 font-semibold text-brand-deep">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/jerseys/${r.club}.png`}
                      alt=""
                      width={22}
                      height={22}
                      className="shrink-0 select-none"
                    />
                    <span className="min-w-0">
                      <span className="block truncate">{r.name}</span>
                      {/* Nur auf dem Handy: die ausgeblendeten Spalten kompakt. */}
                      <span className="block text-[11px] font-medium text-brand-deep/50 sm:hidden">
                        {r.club} · {r.position} · {r.price.toFixed(1)}
                        {r.rating !== null && ` · Ø★ ${r.rating.toFixed(1)}`}
                        {r.goals > 0 && ` · ⚽ ${r.goals}`}
                        {r.assists > 0 && ` · 🅰 ${r.assists}`}
                        {(r.cleanSheets ?? 0) > 0 && ` · 🛡 ${r.cleanSheets}`}
                        {r.bonus > 0 && ` · ⭐ ${r.bonus}`}
                        {r.owned > 0 && ` · 👥 ${r.owned}%`}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="hidden px-3 py-2 text-brand-deep/60 sm:table-cell">{r.club}</td>
                <td className="hidden px-3 py-2 text-brand-deep/60 sm:table-cell">{r.position}</td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-deep/80 sm:table-cell">
                  {r.price.toFixed(1)}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-deep/60 sm:table-cell">
                  {r.rating === null ? "—" : r.rating.toFixed(1)}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-deep/60 sm:table-cell">
                  {r.goals}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-deep/60 sm:table-cell">
                  {r.assists}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-deep/60 sm:table-cell">
                  {r.cleanSheets ?? "—"}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-deep/60 sm:table-cell">
                  {r.bonus}
                </td>
                <td className="hidden px-3 py-2 text-right tabular-nums text-brand-deep/60 sm:table-cell">
                  {r.owned} %
                </td>
                {latestGameweekNumber !== null && (
                  <td className="px-2 py-2 text-right tabular-nums text-brand-deep/80 sm:px-3">
                    {r.latestPoints ?? "—"}
                  </td>
                )}
                <td className="px-2 py-2 text-right sm:px-3">
                  <span className="rounded-full bg-brand-accent/20 px-2.5 py-0.5 font-bold tabular-nums text-brand-deep">
                    {r.totalPoints}
                  </span>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={latestGameweekNumber !== null ? 13 : 12} className="px-3 py-8 text-center text-brand-deep/50">
                  {t.noneFound}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
