"use client";

import { useMemo, useState } from "react";
import type { Position } from "@/lib/database.types";
import { updatePlayer } from "./actions";

export interface AdminPlayerRow {
  id: number;
  /** Zusammengesetzt, nur für die Suche. */
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  price: number;
  club: string;
  clubId: number | null;
  isActive: boolean;
}

export interface ClubOption {
  id: number;
  name: string;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

export default function PlayerAdminTable({
  rows,
  clubs: clubOptions,
}: {
  rows: AdminPlayerRow[];
  clubs: ClubOption[];
}) {
  const [filterPos, setFilterPos] = useState<Position | "ALL">("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const clubs = useMemo(() => [...new Set(rows.map((r) => r.club))].sort(), [rows]);

  const visible = rows.filter(
    (r) =>
      (filterPos === "ALL" || r.position === filterPos) &&
      (filterClub === "ALL" || r.club === filterClub) &&
      (showInactive || r.isActive) &&
      (search === "" || r.name.toLowerCase().includes(search.toLowerCase()))
  );

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
        <div className="flex flex-1 flex-wrap items-center gap-2">
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
          <label className="flex items-center gap-1.5 text-xs font-semibold text-brand-deep/70">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Inaktive zeigen
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-deep/10 text-left text-xs font-bold uppercase tracking-wide text-brand-deep/50">
              <th className="px-3 py-2">Vorname</th>
              <th className="px-3 py-2">Nachname</th>
              <th className="px-2 py-2 sm:px-3">Club</th>
              <th className="hidden px-3 py-2 sm:table-cell">Pos.</th>
              <th className="px-3 py-2">Preis</th>
              <th className="px-3 py-2">Aktiv</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-deep/5">
            {visible.map((r) => (
              <tr key={r.id} className={r.isActive ? "" : "opacity-50"}>
                <td className="px-3 py-1.5">
                  <input
                    form={`player-${r.id}`}
                    name="firstName"
                    defaultValue={r.firstName}
                    placeholder="—"
                    className="w-24 rounded border border-brand-deep/15 px-2 py-1 outline-none focus:border-brand-magenta sm:w-28"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    form={`player-${r.id}`}
                    name="lastName"
                    defaultValue={r.lastName}
                    required
                    className="w-28 rounded border border-brand-deep/15 px-2 py-1 font-semibold outline-none focus:border-brand-magenta sm:w-40"
                  />
                </td>
                <td className="px-2 py-1.5 sm:px-3">
                  <select
                    form={`player-${r.id}`}
                    name="clubId"
                    defaultValue={r.clubId ?? ""}
                    className="rounded border border-brand-deep/15 px-1.5 py-1 text-xs outline-none focus:border-brand-magenta"
                  >
                    {clubOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="hidden px-3 py-1.5 text-brand-deep/60 sm:table-cell">{r.position}</td>
                <td className="px-2 py-1.5 sm:px-3">
                  <input
                    form={`player-${r.id}`}
                    name="price"
                    type="number"
                    step="0.1"
                    min="0"
                    defaultValue={r.price.toFixed(1)}
                    className="w-16 rounded border border-brand-deep/15 px-2 py-1 tabular-nums outline-none focus:border-brand-magenta sm:w-20"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    form={`player-${r.id}`}
                    name="isActive"
                    type="checkbox"
                    defaultChecked={r.isActive}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <form id={`player-${r.id}`} action={updatePlayer}>
                    <input type="hidden" name="playerId" value={r.id} />
                    <button
                      type="submit"
                      className="pressable rounded bg-brand-deep px-2.5 py-1 text-xs font-bold text-brand-accent"
                    >
                      Speichern
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-brand-deep/50">
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
