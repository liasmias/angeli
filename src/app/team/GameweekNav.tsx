import Link from "next/link";
import { getDictionary, type Lang } from "@/lib/i18n";

export interface GameweekNavProps {
  lang: Lang;
  username: string;
  gameweekNumber: number;
  /** Abgeschlossen = Deadline vorbei; sonst läuft die Aufstellungsphase. */
  isPast: boolean;
  /** Deadline vorbei, aber noch nicht alle Partien beendet — Live-Phase. */
  isLive?: boolean;
  deadline: string | null;
  points: number | null;
  totalPoints: number;
  rank: number | null;
  participants: number;
  prevGameweek: number | null;
  nextGameweek: number | null;
  /** Ziel der Blätter-Links — "/team" für den eigenen Kader, "/squad/<name>" für fremde. */
  basePath?: string;
}

/** Ein Pfeil zum Nachbar-Spieltag; als Platzhalter ausgegraut, wenn es keinen gibt. */
function Arrow({ to, dir, basePath, label }: { to: number | null; dir: "prev" | "next"; basePath: string; label: string }) {
  const glyph = dir === "prev" ? "‹" : "›";
  const base =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-2xl leading-none";

  if (to === null) {
    return (
      <span className={`${base} text-white/25`} aria-hidden>
        {glyph}
      </span>
    );
  }
  return (
    <Link
      href={`${basePath}?gw=${to}`}
      aria-label={label}
      title={`${label} (${to})`}
      className={`pressable ${base} text-white hover:bg-white/15`}
      scroll={false}
    >
      {glyph}
    </Link>
  );
}

function Kachel({
  wert,
  label,
  hervorgehoben = false,
}: {
  wert: string;
  label: string;
  hervorgehoben?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center overflow-hidden rounded-lg text-center sm:flex-none sm:w-28 ${
        hervorgehoben ? "bg-brand-deep text-white" : "bg-brand-deep/5 text-brand-deep"
      }`}
    >
      <span className="w-full px-2 pt-1.5 text-lg font-bold tabular-nums leading-tight">
        {wert}
      </span>
      <span
        className={`w-full truncate px-2 pb-1.5 text-[10px] font-semibold ${
          hervorgehoben ? "bg-brand-magenta/90 py-1 text-white" : "text-brand-deep/50"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function GameweekNav(props: GameweekNavProps) {
  const {
    lang,
    username,
    gameweekNumber,
    isPast,
    isLive = false,
    deadline,
    points,
    totalPoints,
    rank,
    participants,
    prevGameweek,
    nextGameweek,
    basePath = "/team",
  } = props;

  const t = getDictionary(lang).gwnav;
  const deadlineDatum = deadline ? new Date(deadline) : null;
  const status = isLive
    ? t.gameweekLive(gameweekNumber)
    : isPast
      ? t.gameweekDone(gameweekNumber)
      : t.gameweek(gameweekNumber);

  return (
    <section className="mb-4 overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="brand-gradient flex items-center justify-between gap-2 px-2 py-2 sm:px-3">
        <Arrow to={prevGameweek} dir="prev" basePath={basePath} label={t.prevGw} />
        <h2 className="min-w-0 flex-1 truncate text-center text-sm font-bold text-white sm:text-base">
          {status}
        </h2>
        <Arrow to={nextGameweek} dir="next" basePath={basePath} label={t.nextGw} />
      </div>

      {isLive && (
        <p className="border-b border-brand-deep/5 px-4 py-1.5 text-center text-xs text-brand-deep/60">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-brand-magenta align-middle" aria-hidden />
          {t.liveHint}
        </p>
      )}

      {!isPast && deadlineDatum && (
        <p className="border-b border-brand-deep/5 px-4 py-1.5 text-center text-xs text-brand-deep/60">
          {t.deadline}{" "}
          <span className="font-semibold text-brand-deep">
            {deadlineDatum.toLocaleString(lang === "en" ? "en-GB" : "de-CH", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
              // Server rendert in UTC — ohne explizite Zeitzone wären alle
              // Zeiten um zwei Stunden verschoben.
              timeZone: "Europe/Zurich",
            })}
          </span>
        </p>
      )}

      {/* Name und Punkte-Kacheln mittig auf einer Zeile; auf sehr schmalen
          Bildschirmen bricht die Gruppe um, bleibt aber zentriert. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-3 sm:p-4">
        <span className="max-w-full truncate text-lg font-bold text-brand-deep sm:text-xl">{username}</span>
        <div className="flex items-stretch justify-center gap-2">
          <Kachel wert={String(totalPoints)} label={t.totalPoints} />
          <Kachel
            wert={points === null ? "—" : String(points)}
            label={t.gwPoints(gameweekNumber)}
            hervorgehoben
          />
          <Kachel
            wert={rank === null ? "—" : String(rank)}
            label={participants > 0 ? t.rankOf(participants) : t.rank}
          />
        </div>
      </div>
    </section>
  );
}
