import Jersey from "@/components/jersey";
import { POSITIONS } from "@/lib/formation";
import type { Position } from "@/lib/database.types";

export interface PastPlayer {
  playerId: number;
  name: string;
  club: string;
  position: Position;
  isStarting: boolean;
  isCaptain: boolean;
  pointsEarned: number | null;
}

const ROW_LABEL: Record<Position, string> = {
  GK: "Torhüter",
  DEF: "Verteidiger",
  MID: "Mittelfeld",
  FWD: "Sturm",
};

function Karte({ p, benchBoost }: { p: PastPlayer; benchBoost: boolean }) {
  // Der Captain zählt doppelt — deshalb hier auch doppelt anzeigen.
  const zaehlt = p.isStarting || benchBoost;
  const punkte = p.pointsEarned === null ? null : p.pointsEarned * (p.isCaptain ? 2 : 1);

  return (
    <div className="relative flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center">
      {p.isCaptain && (
        <span className="absolute -right-0.5 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] font-bold text-brand-accent ring-2 ring-white sm:h-6 sm:w-6 sm:text-xs">
          C
        </span>
      )}
      <div className={`flex w-full flex-col items-center ${zaehlt ? "" : "opacity-60"}`}>
        <Jersey club={p.club} fluid />
        <div className="w-full overflow-hidden rounded-t bg-white px-1 py-0.5 text-center text-[10px] font-bold leading-4 text-brand-deep shadow sm:px-1.5 sm:text-sm sm:leading-5">
          <span className="block truncate">{p.name}</span>
        </div>
        <div className="w-full rounded-b bg-brand-deep px-1 py-0.5 text-center text-[11px] font-bold leading-4 tabular-nums text-brand-accent sm:text-xs">
          {punkte === null ? "—" : `${punkte} Pkt.`}
        </div>
      </div>
    </div>
  );
}

export default function PastGameweek({
  players,
  benchBoost,
  wildcard,
}: {
  players: PastPlayer[];
  benchBoost: boolean;
  wildcard: boolean;
}) {
  const starters = (pos: Position) =>
    players.filter((p) => p.isStarting && p.position === pos);
  const bench = players.filter((p) => !p.isStarting);

  return (
    <>
      {(benchBoost || wildcard) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {wildcard && (
            <span className="rounded-full bg-brand-magenta/10 px-3 py-1 text-xs font-bold text-brand-magenta">
              🃏 Wildcard war aktiv
            </span>
          )}
          {benchBoost && (
            <span className="rounded-full bg-brand-accent/20 px-3 py-1 text-xs font-bold text-brand-deep">
              🚀 Bench Boost war aktiv — die Bank zählte mit
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
                    {ROW_LABEL[pos]}: keine Aufstellung
                  </span>
                ) : (
                  reihe.map((p) => (
                    <Karte key={p.playerId} p={p} benchBoost={benchBoost} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-brand-deep/95 px-4 py-4">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
          Bank {benchBoost && <span className="text-brand-accent">— zählte mit</span>}
        </div>
        <div className="flex items-start gap-1.5 sm:gap-5">
          {bench.length === 0 ? (
            <p className="text-sm text-white/50">Keine Bankspieler.</p>
          ) : (
            bench.map((p) => <Karte key={p.playerId} p={p} benchBoost={benchBoost} />)
          )}
        </div>
      </div>
    </>
  );
}
