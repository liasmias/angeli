"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Position } from "@/lib/database.types";
import { saveSquad } from "./actions";

export interface PlayerOption {
  id: number;
  name: string;
  position: Position;
  price: number;
  club: string;
  points: number;
}

export interface SquadPick {
  playerId: number;
  isStarting: boolean;
  isCaptain: boolean;
}

interface Settings {
  budgetCap: number;
  squadSize: number;
  startingSize: number;
  gkSlots: number;
  defSlots: number;
  midSlots: number;
  fwdSlots: number;
}

const POSITIONS: Position[] = ["GK", "DEF", "MID", "FWD"];

const POSITION_LABEL: Record<Position, string> = {
  GK: "Torhüter",
  DEF: "Verteidiger",
  MID: "Mittelfeld",
  FWD: "Sturm",
};

/** Trikots liegen als PNG in public/jerseys/<KÜRZEL>.png — einfach ersetzen für eigene Designs. */
function Jersey({ club, size = 46 }: { club: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
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
      width={size}
      height={size}
      draggable={false}
      onError={() => setFailed(true)}
      className="select-none drop-shadow-sm"
    />
  );
}

function PlayerCard({
  player,
  pick,
  onCaptain,
  onToggleStarting,
  onRemove,
}: {
  player: PlayerOption;
  pick: SquadPick;
  onCaptain: () => void;
  onToggleStarting: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="pop-in group relative flex w-[4.9rem] flex-col items-center sm:w-[5.6rem]">
      {pick.isCaptain && (
        <span className="pop-in absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-black text-brand-green ring-2 ring-white">
          C
        </span>
      )}
      <div className="flex flex-col items-center transition-transform duration-150 group-hover:scale-105">
        <Jersey club={player.club} />
        <div className="w-full overflow-hidden rounded-t bg-white px-1 text-center text-[10px] font-bold leading-4 text-brand-deep shadow sm:text-[11px]">
          <span className="block truncate">{player.name}</span>
        </div>
        <div className="w-full rounded-b bg-brand-deep px-1 text-center text-[10px] font-medium leading-4 text-white/90">
          {player.club} · {player.price.toFixed(1)}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={onCaptain}
          title="Zum Captain machen"
          aria-label={`${player.name} zum Captain machen`}
          className={`pressable h-6 w-6 rounded-md text-[11px] font-black leading-none shadow-sm ${
            pick.isCaptain
              ? "bg-black text-brand-green"
              : "bg-white text-brand-deep hover:bg-black hover:text-brand-green"
          }`}
        >
          C
        </button>
        <button
          type="button"
          onClick={onToggleStarting}
          title={pick.isStarting ? "Auf die Bank" : "In die Startelf"}
          aria-label={
            pick.isStarting ? `${player.name} auf die Bank` : `${player.name} in die Startelf`
          }
          className="pressable h-6 w-6 rounded-md bg-white text-[11px] font-black leading-none text-brand-deep shadow-sm hover:bg-brand-cyan"
        >
          {pick.isStarting ? "↓" : "↑"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Aus dem Kader entfernen"
          aria-label={`${player.name} entfernen`}
          className="pressable h-6 w-6 rounded-md bg-white text-[11px] font-black leading-none text-brand-pink shadow-sm hover:bg-brand-pink hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function EmptySlot({
  label,
  missing,
  onClick,
}: {
  label: string;
  missing: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} im Spielermarkt anzeigen`}
      className="pressable flex h-[5.4rem] w-[4.9rem] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-white/60 text-center text-[10px] font-bold text-white/90 hover:border-brand-green hover:text-brand-green sm:w-[5.6rem]"
    >
      <span className="text-xl leading-none">+</span>
      {label}
      <span className="font-medium text-white/60">noch {missing}</span>
    </button>
  );
}

export default function TeamBuilder({
  players,
  initialSquad,
  settings,
  gameweekOpen,
  gameweekNumber,
  deadline,
  freeTransfers,
}: {
  players: PlayerOption[];
  initialSquad: SquadPick[];
  settings: Settings;
  gameweekOpen: boolean;
  gameweekNumber: number | null;
  deadline: string | null;
  freeTransfers: number;
}) {
  const [squad, setSquad] = useState<SquadPick[]>(initialSquad);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [filterPos, setFilterPos] = useState<Position | "ALL">("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  // Toast automatisch ausblenden — Fehler bleiben etwas länger lesbar
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === "error" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const clubs = useMemo(() => [...new Set(players.map((p) => p.club))].sort(), [players]);

  const slotsByPosition: Record<Position, number> = {
    GK: settings.gkSlots,
    DEF: settings.defSlots,
    MID: settings.midSlots,
    FWD: settings.fwdSlots,
  };

  const spent = squad.reduce((sum, s) => sum + (playersById.get(s.playerId)?.price ?? 0), 0);
  const budgetLeft = settings.budgetCap - spent;
  const countByPosition: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const s of squad) {
    const pos = playersById.get(s.playerId)?.position;
    if (pos) countByPosition[pos]++;
  }
  const startingCount = squad.filter((s) => s.isStarting).length;
  const hasCaptain = squad.some((s) => s.isCaptain);

  const starters = (pos: Position) =>
    squad.filter((s) => s.isStarting && playersById.get(s.playerId)?.position === pos);
  const bench = squad.filter((s) => !s.isStarting);

  function togglePlayer(player: PlayerOption) {
    setSquad((prev) => {
      const exists = prev.find((s) => s.playerId === player.id);
      if (exists) return prev.filter((s) => s.playerId !== player.id);
      if (prev.length >= settings.squadSize) {
        setToast({ kind: "error", text: `Kader ist voll (${settings.squadSize} Spieler).` });
        return prev;
      }
      if (countByPosition[player.position] >= slotsByPosition[player.position]) {
        setToast({
          kind: "error",
          text: `Alle ${POSITION_LABEL[player.position]}-Plätze sind besetzt.`,
        });
        return prev;
      }
      if (spent + player.price > settings.budgetCap) {
        setToast({ kind: "error", text: "Zu teuer — Budget reicht nicht." });
        return prev;
      }
      // Neue Spieler landen in der Startelf, solange dort Platz ist (max. 1 startender GK).
      const startersNow = prev.filter((s) => s.isStarting).length;
      const gkStarting = prev.some(
        (s) => s.isStarting && playersById.get(s.playerId)?.position === "GK"
      );
      const autoStart =
        startersNow < settings.startingSize && !(player.position === "GK" && gkStarting);
      return [...prev, { playerId: player.id, isStarting: autoStart, isCaptain: false }];
    });
  }

  function toggleStarting(playerId: number) {
    setSquad((prev) =>
      prev.map((s) => (s.playerId === playerId ? { ...s, isStarting: !s.isStarting } : s))
    );
  }

  function setCaptain(playerId: number) {
    setSquad((prev) =>
      prev.map((s) => ({
        ...s,
        isCaptain: s.playerId === playerId,
        isStarting: s.playerId === playerId ? true : s.isStarting,
      }))
    );
  }

  function removePlayer(playerId: number) {
    setSquad((prev) => prev.filter((s) => s.playerId !== playerId));
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveSquad(squad);
      if (result?.error) {
        setToast({ kind: "error", text: result.error });
      } else {
        // Spieltag mitnennen: nach einer verstrichenen Deadline gilt die
        // Aufstellung automatisch für den nächsten Spieltag.
        const gw = result?.savedForGameweek;
        setToast({
          kind: "success",
          text: gw ? `Team für Spieltag ${gw} gespeichert. Viel Glück! 🍀` : "Team gespeichert. 🍀",
        });
      }
    });
  }

  const filtered = players.filter(
    (p) =>
      (filterPos === "ALL" || p.position === filterPos) &&
      (filterClub === "ALL" || p.club === filterClub) &&
      (search === "" || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  const deadlineDate = deadline ? new Date(deadline) : null;
  const hoursLeft = deadlineDate
    ? Math.max(0, Math.round((deadlineDate.getTime() - Date.now()) / 3_600_000))
    : null;
  const countdown =
    hoursLeft === null
      ? null
      : hoursLeft >= 48
        ? `in ${Math.round(hoursLeft / 24)} Tagen`
        : `in ${hoursLeft} Std.`;

  const budgetRatio = Math.min(1, Math.max(0, spent / settings.budgetCap));

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Toast */}
      {toast && (
        <p
          role="status"
          className={`toast rounded-full px-5 py-2.5 text-sm font-bold shadow-lg ${
            toast.kind === "error"
              ? "bg-brand-pink text-white"
              : "bg-brand-green text-brand-deep"
          }`}
        >
          {toast.text}
        </p>
      )}

      {/* ===== Spielfeld ===== */}
      <section className="min-w-0 flex-1">
        {/* Status-Kacheln */}
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">
              Restbudget
            </div>
            <div
              className={`text-xl font-black tabular-nums ${
                budgetLeft < 0 ? "text-brand-pink" : "text-brand-deep"
              }`}
            >
              {budgetLeft.toFixed(1)}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-deep/10">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  budgetRatio > 0.95 ? "bg-brand-pink" : "bg-brand-green"
                }`}
                style={{ width: `${budgetRatio * 100}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">
              Kader
            </div>
            <div className="text-xl font-black tabular-nums text-brand-deep">
              {squad.length}/{settings.squadSize}
            </div>
            <div className="mt-1 text-[11px] font-medium text-brand-deep/50">
              {POSITIONS.map((p) => `${p} ${countByPosition[p]}/${slotsByPosition[p]}`).join(" · ")}
            </div>
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">
              Startelf
            </div>
            <div className="text-xl font-black tabular-nums text-brand-deep">
              {startingCount}/{settings.startingSize}
            </div>
            {!hasCaptain && squad.length > 0 && (
              <div className="mt-1 text-[11px] font-bold text-brand-pink">Captain fehlt</div>
            )}
          </div>
          <div className="rounded-lg bg-white p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">
              {gameweekNumber ? `Spieltag ${gameweekNumber}` : "Spieltag"}
              {countdown && <span className="ml-1 normal-case text-brand-magenta">· {countdown}</span>}
            </div>
            <div className="text-sm font-bold text-brand-deep">
              {deadlineDate
                ? deadlineDate.toLocaleString("de-CH", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "—"}
              <span className="block text-[11px] font-medium text-brand-deep/50">
                Freie Transfers: {freeTransfers}
              </span>
            </div>
          </div>
        </div>

        {/* Rasen */}
        <div className="pitch px-2 py-6 sm:px-6">
          <div className="relative z-10 flex flex-col gap-5">
            {POSITIONS.map((pos) => {
              const row = starters(pos);
              const missing = slotsByPosition[pos] - countByPosition[pos];
              return (
                <div key={pos} className="flex flex-wrap items-start justify-center gap-2 sm:gap-4">
                  {row.map((pick) => {
                    const player = playersById.get(pick.playerId);
                    if (!player) return null;
                    return (
                      <PlayerCard
                        key={pick.playerId}
                        player={player}
                        pick={pick}
                        onCaptain={() => setCaptain(pick.playerId)}
                        onToggleStarting={() => toggleStarting(pick.playerId)}
                        onRemove={() => removePlayer(pick.playerId)}
                      />
                    );
                  })}
                  {missing > 0 && (
                    <EmptySlot
                      label={POSITION_LABEL[pos]}
                      missing={missing}
                      onClick={() => {
                        setFilterPos(pos);
                        setFilterClub("ALL");
                        setSearch("");
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bank */}
        <div className="mt-3 rounded-xl bg-brand-deep/95 px-4 py-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
            Bank
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {bench.length === 0 && (
              <p className="text-sm text-white/50">
                Keine Bankspieler — Spieler mit ↓ auf die Bank setzen.
              </p>
            )}
            {bench.map((pick) => {
              const player = playersById.get(pick.playerId);
              if (!player) return null;
              return (
                <PlayerCard
                  key={pick.playerId}
                  player={player}
                  pick={pick}
                  onCaptain={() => setCaptain(pick.playerId)}
                  onToggleStarting={() => toggleStarting(pick.playerId)}
                  onRemove={() => removePlayer(pick.playerId)}
                />
              );
            })}
          </div>
        </div>

        {/* Speichern */}
        <div className="sticky bottom-4 z-20 mt-4 flex justify-center">
          <button
            type="button"
            disabled={isPending || !gameweekOpen}
            onClick={handleSave}
            className="pressable w-full max-w-xs rounded-full bg-brand-green px-6 py-3 font-bold text-brand-deep shadow-lg shadow-brand-deep/20 disabled:opacity-40"
          >
            {isPending ? "Speichert…" : gameweekOpen ? "Team speichern" : "Spieltag gesperrt"}
          </button>
        </div>
      </section>

      {/* ===== Spielermarkt ===== */}
      <aside className="w-full shrink-0 lg:w-[22rem]">
        <div className="overflow-hidden rounded-xl bg-white shadow-sm lg:sticky lg:top-4">
          <div className="brand-gradient px-4 py-3 text-sm font-bold text-white">
            Spieler wählen
          </div>
          <div className="flex flex-col gap-2 border-b border-brand-deep/10 p-3">
            <div className="flex gap-1">
              {(["ALL", ...POSITIONS] as const).map((pos) => {
                const full =
                  pos !== "ALL" && countByPosition[pos] >= slotsByPosition[pos];
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setFilterPos(pos)}
                    className={`pressable-subtle flex-1 rounded-full px-1 py-1 text-xs font-bold ${
                      filterPos === pos
                        ? "bg-brand-deep text-brand-green"
                        : "bg-brand-deep/5 text-brand-deep/70 hover:bg-brand-deep/10"
                    }`}
                  >
                    {pos === "ALL" ? "Alle" : pos}
                    {pos !== "ALL" && (
                      <span
                        className={`ml-1 text-[10px] font-semibold ${
                          filterPos === pos
                            ? "text-brand-green/70"
                            : full
                              ? "text-emerald-600"
                              : "text-brand-deep/40"
                        }`}
                      >
                        {countByPosition[pos]}/{slotsByPosition[pos]}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
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
          <div className="max-h-[34rem] overflow-y-auto">
            {filtered.map((p) => {
              const picked = squad.some((s) => s.playerId === p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p)}
                  className={`pressable-subtle flex w-full items-center gap-3 border-b border-brand-deep/5 px-3 py-2 text-left text-sm ${
                    picked ? "bg-brand-green/15" : "hover:bg-brand-deep/5"
                  }`}
                >
                  <Jersey club={p.club} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-brand-deep">{p.name}</span>
                    <span className="block text-xs text-brand-deep/50">
                      {p.club} · {p.position}
                    </span>
                  </span>
                  <span className="w-10 text-right">
                    <span className="block text-[10px] font-semibold uppercase text-brand-deep/40">
                      Pkt.
                    </span>
                    <span className="block font-bold tabular-nums text-brand-deep">{p.points}</span>
                  </span>
                  <span className="w-9 text-right font-bold tabular-nums text-brand-deep">
                    {p.price.toFixed(1)}
                  </span>
                  <span
                    className={`pressable flex h-6 w-6 items-center justify-center rounded-full text-sm font-black ${
                      picked ? "bg-brand-pink text-white" : "bg-brand-green text-brand-deep"
                    }`}
                  >
                    {picked ? "−" : "+"}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-brand-deep/50">
                Keine Spieler gefunden.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
