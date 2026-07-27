"use client";

import { useMemo, useState } from "react";
import type { Position } from "@/lib/database.types";

export interface StatsRow {
  id: number;
  name: string;
  position: Position;
  price: number;
  club: string;
  totalPoints: number;
  latestPoints: number | null;
  /** Schnitt der API-Bewertung; null, wenn nie bewertet. */
  rating: number | null;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

type SortKey = "totalPoints" | "latestPoints" | "price" | "name" | "rating";

export default function StatsTable({
  rows,
  latestGameweekNumber,
}: {
  rows: StatsRow[];
  latestGameweekNumber: number | null;
}) {
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
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
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
              {pos === "ALL" ? "Alle" : pos}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Spieler suchen…"
            className="min-w-0 flex-1 rounded-lg border border-brand-deep/15 px-3 py-1.5 text-sm outline-none focus:border-brand-magenta"
          />
          <select
            value={filterClub}
            onChange={(e) => setFilterClub(e.target.value)}
            className="rounded-lg border border-brand-deep/15 px-2 py-1.5 text-sm outline-none focus:border-brand-magenta"
          >
            <option value="ALL">Club</option>
            {clubs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
                  Spieler{sortIndicator("name")}
                </button>
              </th>
              <th className="hidden px-3 py-2 sm:table-cell">Club</th>
              <th className="hidden px-3 py-2 sm:table-cell">Pos.</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("price")} className="uppercase">
                  Preis{sortIndicator("price")}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">
                <button type="button" onClick={() => toggleSort("rating")} className="uppercase" title="Bewertung der Datenquelle — zählt nicht für die Punkte">
                  Rating{sortIndicator("rating")}
                </button>
              </th>
              {latestGameweekNumber !== null && (
                <th className="px-2 py-2 text-right sm:px-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("latestPoints")}
                    className="uppercase"
                  >
                    GW {latestGameweekNumber}
                    {sortIndicator("latestPoints")}
                  </button>
                </th>
              )}
              <th className="px-2 py-2 text-right sm:px-3">
                <button type="button" onClick={() => toggleSort("totalPoints")} className="uppercase">
                  Punkte{sortIndicator("totalPoints")}
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
                        {r.rating !== null && ` · ★ ${r.rating.toFixed(1)}`}
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
                <td colSpan={latestGameweekNumber !== null ? 8 : 7} className="px-3 py-8 text-center text-brand-deep/50">
                  Keine Spieler gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
