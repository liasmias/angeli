"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Jersey from "@/components/jersey";
import type { PlayerFlag, Position } from "@/lib/database.types";
import {
  MAX_PER_CLUB,
  MAX_STARTERS,
  MIN_STARTERS,
  canStart,
  emptyCounts,
  formationLabel,
  validateFormation,
} from "@/lib/formation";
import { saveSquad } from "./actions";
import { getDictionary, type Lang } from "@/lib/i18n";
import { activateChip, deactivateChip } from "./chip-actions";
import type { ChipName } from "@/lib/database.types";

export interface ChipState {
  chip: ChipName;
  activeNow: boolean;
  usedInGameweek: number | null;
}

const CHIP_META: Record<ChipName, { name: string; icon: string }> = {
  wildcard: { name: "Wildcard", icon: "🃏" },
  bench_boost: { name: "Bench Boost", icon: "🚀" },
};

export interface PlayerOption {
  id: number;
  name: string;
  position: Position;
  price: number;
  club: string;
  points: number;
  goals: number;
  assists: number;
  /** In wie viel Prozent der gespeicherten Teams der Spieler steckt. */
  owned: number;
  /** Zu-null-Spiele; null bei MID/FWD (Wertung gilt dort nicht). */
  cleanSheets: number | null;
  /** Verfügbarkeit: gelb = fraglich, rot = fällt aus. */
  flag: PlayerFlag | null;
  flagNote: string | null;
  /** Statistik wird von Hand nachgetragen — Punkte erscheinen verzögert. */
  manualStats: boolean;
  /** Gegner am kommenden Spieltag, z. B. "ZUR (A)" — null bei spielfrei.
   *  Bei zwei Partien nur die Kuerzel, etwa "GC·SIO". */
  nextOpponent: string | null;
  /** Alle Partien des Spieltags, je "GC (H)". Zwei bei einer Double Gameweek. */
  nextFixtures: string[];
  /** Saisonwerte fuer die Spielerkarte. */
  minutes: number;
  appearances: number;
  yellowCards: number;
  redCards: number;
}

export interface SquadPick {
  playerId: number;
  isStarting: boolean;
  isCaptain: boolean;
  /** Übernimmt die Binde, falls der Captain nicht zum Einsatz kommt. */
  isViceCaptain: boolean;
  /** Preis beim Kauf; nur für bereits gespeicherte Spieler gesetzt. */
  purchasePrice?: number;
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




type BuilderDict = ReturnType<typeof getDictionary>["builder"];

/**
 * Spielerkarte nach dem FPL-Muster: Die Karte selbst ist die einzige
 * Interaktion — ein Tipp öffnet das Aktionsmenü (bzw. führt im Tauschmodus
 * den Tausch aus). Es gibt keine Knöpfe unter der Karte mehr.
 */
function PlayerCard({
  player,
  pick,
  onTap,
  dimmed = false,
  highlight = false,
  showPrice = false,
  onQuickRemove,
  onUndo,
  imStapel = false,
  t,
}: {
  player: PlayerOption;
  pick: SquadPick;
  /** Tipp auf die Karte; im Tauschmodus nur für gültige Ziele gesetzt. */
  onTap?: () => void;
  /** Tauschmodus: kein gültiger Tauschpartner — ausgegraut, nicht tippbar. */
  dimmed?: boolean;
  /** Tauschmodus: dieser Spieler ist die Quelle des Tauschs. */
  highlight?: boolean;
  /** Transfer-Modus: Preis statt Gegner in der unteren Zeile. */
  showPrice?: boolean;
  /** Transfer-Modus: kleines ✕ oben rechts entfernt den Spieler direkt. */
  onQuickRemove?: () => void;
  /** Geisterkarte eines Entfernten: ↩ oben rechts holt ihn zurück. */
  onUndo?: () => void;
  /** Im Tauschstapel gibt der Rahmen die Breite vor, nicht die Karte selbst. */
  imStapel?: boolean;
  t: BuilderDict;
}) {
  return (
    <div
      id={`spieler-karte-${player.id}`}
      className={`${onUndo ? "" : "pop-in "}group relative flex min-w-0 flex-col items-center transition-opacity duration-150 ${
        imStapel ? "w-full" : "max-w-[7.4rem] flex-1"
      } ${dimmed ? "opacity-35" : ""}`}
    >
      {(pick.isCaptain || pick.isViceCaptain) && (
        <span
          className={`pop-in absolute top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white sm:h-6 sm:w-6 sm:text-xs ${
            onQuickRemove || player.flag ? "left-0.5" : "right-0.5"
          } ${pick.isCaptain ? "bg-black text-brand-accent" : "bg-white text-brand-deep"}`}
        >
          {pick.isCaptain ? "C" : "V"}
        </span>
      )}
      {/* Verfügbarkeits-Markierung — gelb: fraglich, rot: fällt aus. */}
      {player.flag && !onQuickRemove && !onUndo && (
        <span
          title={player.flagNote ?? undefined}
          aria-label={`${player.name}: ${player.flagNote ?? (player.flag === "red" ? t.flagRed : t.flagYellow)}`}
          className={`absolute right-0.5 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold leading-none ring-2 ring-white sm:h-6 sm:w-6 ${
            player.flag === "red" ? "bg-brand-danger text-white" : "bg-amber-400 text-amber-950"
          }`}
        >
          !
        </span>
      )}
      {onQuickRemove && (
        <button
          type="button"
          onClick={onQuickRemove}
          title={t.remove(player.name)}
          aria-label={t.remove(player.name)}
          className="pressable absolute right-0.5 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand-danger text-[10px] font-bold leading-none text-white ring-2 ring-white before:absolute before:-inset-2.5 before:content-[''] sm:h-6 sm:w-6 sm:text-xs"
        >
          ✕
        </button>
      )}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          title={t.undoTitle(player.name)}
          aria-label={t.undoTitle(player.name)}
          className="pressable absolute right-0.5 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand-lime text-[10px] font-bold leading-none text-brand-deep ring-2 ring-white before:absolute before:-inset-2.5 before:content-[''] sm:h-6 sm:w-6 sm:text-xs"
        >
          ↩
        </button>
      )}
      <button
        type="button"
        onClick={onTap}
        disabled={!onTap}
        aria-label={t.playerActions(player.name)}
        className={`flex w-full cursor-pointer flex-col items-center rounded-lg transition-transform duration-150 group-hover:scale-105 disabled:cursor-default ${
          highlight ? "ring-2 ring-brand-accent" : ""
        }`}
      >
        <Jersey club={player.club} fluid />
        <div className="w-full overflow-hidden rounded-t bg-white px-1 py-0.5 text-center text-[10px] font-bold leading-4 text-brand-deep shadow sm:px-1.5 sm:text-sm sm:leading-5">
          <span className="block truncate">{player.name}</span>
        </div>
        {/* Normal der nächste Gegner — im Transfer-Modus der Preis, denn
            dann ist das die Information, die zählt. */}
        {/* Ohne Partie am angezeigten Spieltag steht hier kein Gegner. Das
            war bisher ein Bindestrich und ging auf dem Handy unter — bei
            verschobenen Runden ist es aber die wichtigste Information vor
            der Deadline. Darum als Wort und in Magenta. */}
        {/* Zwei Partien sehen aus wie eine, nur enger gesetzt — beide passen
            dadurch vollstaendig hinein, samt Heim/Auswaerts. */}
        <div
          className={`w-full truncate rounded-b px-1 py-0.5 text-center leading-4 sm:px-1.5 ${
            showPrice
              ? "bg-brand-accent text-[9px] font-bold text-brand-deep sm:text-xs"
              : player.nextFixtures.length > 1
                ? "bg-brand-deep text-[8px] font-medium text-white/90 sm:text-[11px]"
                : player.nextOpponent
                  ? "bg-brand-deep text-[10px] font-medium text-white/90 sm:text-xs"
                  : "bg-brand-magenta text-[8px] font-bold uppercase tracking-wide text-white sm:text-[11px]"
          }`}
        >
          {showPrice ? player.price.toFixed(1) : (player.nextOpponent ?? t.blank)}
        </div>
      </button>
    </div>
  );
}

/**
 * Kleine Spielerkarte: Trikot, Herkunft, nächste Partie und die Saisonwerte.
 *
 * Steckt sowohl im Aktionsmenü der Aufstellung als auch im Spielermarkt —
 * dort war bisher nur zu sehen, wonach gerade sortiert wird. Wer Tore gegen
 * Vorlagen abwägen wollte, musste die Sortierung umstellen und die Zeile
 * wiederfinden.
 */
function SpielerKarte({ player, t }: { player: PlayerOption; t: BuilderDict }) {
  const werte: [string, string][] = [
    [t.cardPoints, String(player.points)],
    [t.cardGoals, String(player.goals)],
    [t.cardAssists, String(player.assists)],
    ...(player.cleanSheets !== null
      ? ([[t.cardCleanSheets, String(player.cleanSheets)]] as [string, string][])
      : []),
    [t.cardApps, String(player.appearances)],
    [t.cardMinutes, String(player.minutes)],
    [t.cardOwned, `${player.owned}%`],
    [t.cardCards, `${player.yellowCards}\u2009/\u2009${player.redCards}`],
  ];
  return (
    <div>
      <div className="flex items-center gap-3">
        <Jersey club={player.club} size={44} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-bold text-brand-deep">
            {player.flag && (
              <span
                title={player.flagNote ?? undefined}
                className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                  player.flag === "red" ? "bg-brand-danger" : "bg-amber-400"
                }`}
              />
            )}
            <span className="truncate">{player.name}</span>
          </p>
          <p className="text-xs text-brand-deep/60">
            {player.club} · {t.positions[player.position]} · {player.price.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-brand-deep/5 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand-deep/45">
            {player.nextFixtures.length > 1 ? t.cardTwoGames : t.cardNextGame}
          </span>
          <span
            className={`truncate text-xs font-bold ${
              player.nextFixtures.length > 1
                ? "text-brand-grass"
                : player.nextOpponent
                  ? "text-brand-deep"
                  : "text-brand-magenta"
            }`}
          >
            {player.nextFixtures.length === 0 ? t.cardNoGame : player.nextFixtures.join("  ·  ")}
          </span>
        </div>
      </div>

      {player.flagNote && (
        <p className="mt-2 text-[11px] leading-snug text-brand-deep/60">{player.flagNote}</p>
      )}

      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-brand-deep/45">
        {t.cardSeason}
      </p>
      <dl className="mt-1.5 grid grid-cols-4 gap-1.5">
        {werte.map(([label, wert]) => (
          <div key={label} className="rounded-lg bg-brand-deep/5 px-1.5 py-1.5 text-center">
            <dt className="truncate text-[9px] font-semibold uppercase leading-tight text-brand-deep/45">
              {label}
            </dt>
            <dd className="text-sm font-bold tabular-nums text-brand-deep">{wert}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Ein Platz, auf dem gerade getauscht wird: der neu geholte Spieler vorne,
 * der ausgetauschte blass und leicht versetzt dahinter. Beide teilen sich
 * eine Spalte, damit die Reihe nicht breiter wird — bei fünf Mittelfeld-
 * karten war das der Grund, warum es unübersichtlich wurde.
 */
function TauschStapel({
  alt,
  altPick,
  neu,
  neuPick,
  onUndo,
  onTap,
  t,
}: {
  alt: PlayerOption;
  altPick: SquadPick;
  neu: PlayerOption;
  neuPick: SquadPick;
  onUndo: () => void;
  onTap?: () => void;
  t: BuilderDict;
}) {
  return (
    <div className="relative flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center">
      {/* Vorgänger: nur noch Andeutung, nimmt keine Klicks entgegen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-y-1.5 translate-x-2 opacity-25"
      >
        <PlayerCard t={t} player={alt} pick={{ ...altPick, isCaptain: false, isViceCaptain: false }} showPrice imStapel />
      </div>
      <PlayerCard t={t} player={neu} pick={neuPick} showPrice imStapel onTap={onTap} onUndo={onUndo} />
      <span className="pointer-events-none mt-0.5 max-w-full truncate text-[9px] font-semibold text-white/45">
        ↔ {alt.name}
      </span>
    </div>
  );
}

function EmptySlot({
  label,
  missing,
  onClick,
  t,
}: {
  label: string;
  missing: number;
  onClick: () => void;
  t: BuilderDict;
}) {
  return (
    // Kompakter, runder Platzhalter: nimmt nur so viel Fläche wie nötig,
    // damit die belegten Karten die Aufstellung dominieren.
    <button
      type="button"
      onClick={onClick}
      title={t.addSlot(label, missing)}
      aria-label={t.addSlot(label, missing)}
      className="pressable flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center justify-start gap-1 self-start pt-1"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-white/60 text-xl font-bold leading-none text-white/90 sm:h-12 sm:w-12 sm:text-2xl">
        +
      </span>
      <span className="w-full truncate text-center text-[10px] font-bold leading-tight text-white/85 sm:text-[11px]">
        {label}
      </span>
      <span className="text-[10px] font-medium text-white/55">{t.slotMissing(missing)}</span>
    </button>
  );
}

export default function TeamBuilder({
  lang,
  players,
  initialSquad,
  realisedGains,
  settings,
  gameweekOpen,
  gameweekNumber,
  deadline,
  freeTransfers,
  transfersUsed,
  unlimitedTransfers,
  extraTransferCost,
  chips,
}: {
  lang: Lang;
  players: PlayerOption[];
  initialSquad: SquadPick[];
  /** Bereits realisierte Kursgewinne dieses Kaders. */
  realisedGains: number;
  settings: Settings;
  gameweekOpen: boolean;
  gameweekNumber: number | null;
  deadline: string | null;
  freeTransfers: number;
  transfersUsed: number;
  /** Einstiegsrunde: Transfers kosten in dieser Runde nichts. */
  unlimitedTransfers: boolean;
  extraTransferCost: number;
  chips: ChipState[];
}) {
  const t = getDictionary(lang).builder;
  const [squad, setSquad] = useState<SquadPick[]>(initialSquad);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  // FPL-Muster: Tipp auf eine Karte öffnet das Aktionsmenü; "Auswechseln"
  // startet den Tauschmodus, in dem nur gültige Partner tippbar bleiben.
  const [sheetSpieler, setSheetSpieler] = useState<number | null>(null);
  // Spielerkarte aus dem Markt — dort ist der Spieler noch nicht im Kader,
  // deshalb ein eigener Zustand statt `sheetSpieler`.
  const [marktSpieler, setMarktSpieler] = useState<number | null>(null);
  // Auf dem Handy liegt der Markt als Overlay ueber der Seite statt als
  // Abschnitt darunter: Er begann erst bei 1138 px, und seine eigene
  // Scrollflaeche fing den Daumen ab, statt die Seite weiterzuschieben.
  const [marktOffen, setMarktOffen] = useState(false);
  const [tauschAus, setTauschAus] = useState<number | null>(null);
  // Transfer-Modus: Karten zeigen Preise und ein ✕ zum direkten Entfernen.
  const [transferModus, setTransferModus] = useState(false);
  // Zuletzt entfernte Spieler samt Originalposition im Kader-Array —
  // Grundlage für "Rückgängig" und dafür, dass die Geisterkarte an
  // ihrem Platz stehen bleibt statt ans Reihenende zu springen.
  const [entfernt, setEntfernt] = useState<{ pick: SquadPick; idx: number }[]>([]);
  // Zuordnung Geisterkarte -> Nachfolger. Ohne sie landete der neu geholte
  // Spieler am Reihenende neben dem ausgeblassten Vorgaenger; im Mittelfeld
  // mit fuenf Karten wurde daraus schnell ein Durcheinander. Mit der
  // Zuordnung teilen sich beide einen Platz: der Neue vorne, der Alte blass
  // dahinter.
  const [ersatz, setErsatz] = useState<{ rausId: number; reinId: number }[]>([]);
  const [filterPos, setFilterPos] = useState<Position | "ALL">("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  // Standard: die punktbesten Spieler zuoberst; umschaltbar auf Preis.
  const [sortiere, setSortiere] = useState<"points" | "price" | "goals" | "assists" | "cleanSheets" | "owned">("points");
  const marketRef = useRef<HTMLElement | null>(null);
  // Was die Statistik-Spalte im Markt zeigt: die gewaehlte Sortierung —
  // ausser bei Preis (eigene Spalte) und Aufgestellt % (bleibt in der
  // Unterzeile), dort Punkte als Standard.
  const marktSpalte: "points" | "goals" | "assists" | "cleanSheets" =
    sortiere === "price" || sortiere === "owned" ? "points" : sortiere;

  // Auf dem Handy liegt der Spielermarkt unterhalb des Spielfelds — ein Tipp
  // auf einen leeren Slot würde sonst sichtbar nichts bewirken. Im breiten
  // Layout (ab lg) steht der Markt daneben, dort wäre der Sprung störend.
  /**
   * Ersatz fuer einen herausgenommenen Spieler suchen: Markt auf dessen
   * Position filtern und oeffnen. Dieselbe Geste wie beim leeren Slot —
   * die ausgeblasste Karte war bisher nur ueber ihr kleines ↩ ansprechbar,
   * ein Tipp darauf tat nichts.
   */
  function ersatzSuchen(position: Position) {
    setFilterPos(position);
    setFilterClub("ALL");
    setSearch("");
    jumpToMarket();
  }

  function jumpToMarket() {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    setMarktOffen(true);
  }

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

  // Budget — spiegelt exakt die Rechnung des Servers: gehaltene Spieler zaehlen
  // mit ihrem Einkaufspreis, neu geholte mit dem Tagespreis. Wer verkauft wird,
  // bringt die Differenz zum Tagespreis als realisierten Gewinn ein.
  const einkaufBisher = new Map(initialSquad.map((s) => [s.playerId, s.purchasePrice ?? 0]));
  const spent = squad.reduce((sum, s) => {
    const gehalten = einkaufBisher.get(s.playerId);
    return sum + (gehalten ?? playersById.get(s.playerId)?.price ?? 0);
  }, 0);
  const imKader = new Set(squad.map((s) => s.playerId));
  let realisiert = 0;
  for (const [id, einkauf] of einkaufBisher) {
    if (imKader.has(id)) continue;
    realisiert += (playersById.get(id)?.price ?? einkauf) - einkauf;
  }
  const effectiveCap = settings.budgetCap + realisedGains + realisiert;
  const budgetLeft = effectiveCap - spent;
  const countByPosition: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const s of squad) {
    const pos = playersById.get(s.playerId)?.position;
    if (pos) countByPosition[pos]++;
  }
  const startingCount = squad.filter((s) => s.isStarting).length;
  // Double Gameweek: mindestens ein Verein hat zwei Partien in dieser Runde.
  const doubleGameweek = players.some((p) => p.nextFixtures.length > 1);
  const hasCaptain = squad.some((s) => s.isCaptain);

  /** Positionsverteilung der aktuellen Startelf. */
  function starterCounts(picks: SquadPick[] = squad) {
    const counts = emptyCounts();
    for (const s of picks) {
      if (!s.isStarting) continue;
      const pos = playersById.get(s.playerId)?.position;
      if (pos) counts[pos]++;
    }
    return counts;
  }

  const startingCounts = starterCounts();
  const formationError = validateFormation(startingCounts, settings.startingSize);

  // Vorschau der Transferkosten: alles, was gegenüber dem gespeicherten Kader
  // neu dazugekommen ist, zählt als Transfer.
  const savedIds = useMemo(() => new Set(initialSquad.map((s) => s.playerId)), [initialSquad]);
  const wildcardActive = chips.some((c) => c.chip === "wildcard" && c.activeNow);
  const pendingTransfers = squad.filter((s) => !savedIds.has(s.playerId)).length;
  const pendingCost =
    wildcardActive || unlimitedTransfers
      ? 0
      : Math.max(0, pendingTransfers - freeTransfers) * extraTransferCost;

  function handleChip(chip: ChipName, isActive: boolean) {
    startTransition(async () => {
      const res = isActive ? await deactivateChip(chip) : await activateChip(chip);
      if (res.error) setToast({ kind: "error", text: res.error });
      else if (res.message) setToast({ kind: "success", text: res.message });
    });
  }

  const starters = (pos: Position) =>
    squad.filter((s) => s.isStarting && playersById.get(s.playerId)?.position === pos);
  // Bank: Torhüter fix auf Platz 1, danach die Feldspieler in der Reihenfolge,
  // in der sie bei einer automatischen Einwechslung nachrücken.
  const bench = squad.filter((s) => !s.isStarting);
  // Wer als Nachfolger im Tauschstapel steckt, erscheint dort — nicht
  // zusaetzlich als eigene Bankkarte.
  const imStapelAufBank = new Set(
    ersatz
      .filter((r) => entfernt.some((e) => e.pick.playerId === r.rausId && !e.pick.isStarting))
      .map((r) => r.reinId)
  );
  const benchGk = bench.filter(
    (s) => playersById.get(s.playerId)?.position === "GK" && !imStapelAufBank.has(s.playerId)
  );
  const benchFeld = bench.filter(
    (s) => playersById.get(s.playerId)?.position !== "GK" && !imStapelAufBank.has(s.playerId)
  );

  /** Verschiebt einen Feldspieler auf der Bank um eine Position. */
  function moveBench(playerId: number, richtung: -1 | 1) {
    setSquad((prev) => {
      const feld = prev.filter(
        (s) => !s.isStarting && playersById.get(s.playerId)?.position !== "GK"
      );
      const i = feld.findIndex((s) => s.playerId === playerId);
      const j = i + richtung;
      if (i < 0 || j < 0 || j >= feld.length) return prev;
      // Die beiden Einträge in der Gesamtliste tauschen — die Reihenfolge
      // dort ist es, die beim Speichern zu bench_order wird.
      const aId = feld[i].playerId;
      const bId = feld[j].playerId;
      const next = [...prev];
      const ai = next.findIndex((s) => s.playerId === aId);
      const bi = next.findIndex((s) => s.playerId === bId);
      [next[ai], next[bi]] = [next[bi], next[ai]];
      return next;
    });
  }

  function togglePlayer(player: PlayerOption) {
    // Freie Geisterkarte derselben Position: Der Neue uebernimmt ihren Platz.
    const geist = transferModus
      ? entfernt.find(
          (e) =>
            playersById.get(e.pick.playerId)?.position === player.position &&
            !squad.some((s) => s.playerId === e.pick.playerId) &&
            !ersatz.some((r) => r.rausId === e.pick.playerId)
        )
      : undefined;
    setSquad((prev) => {
      const exists = prev.find((s) => s.playerId === player.id);
      if (exists) return prev.filter((s) => s.playerId !== player.id);
      if (prev.length >= settings.squadSize) {
        setToast({ kind: "error", text: t.errSquadFull(settings.squadSize) });
        return prev;
      }
      if (countByPosition[player.position] >= slotsByPosition[player.position]) {
        setToast({ kind: "error", text: t.errPosFull(t.positions[player.position]) });
        return prev;
      }
      if (spent + player.price > effectiveCap + 1e-9) {
        setToast({ kind: "error", text: t.errTooExpensive });
        return prev;
      }
      // Höchstens MAX_PER_CLUB Spieler desselben Clubs — der Server prüft
      // dieselbe Regel beim Speichern nochmals.
      const gleicherClub = prev.filter(
        (s) => playersById.get(s.playerId)?.club === player.club
      ).length;
      if (gleicherClub >= MAX_PER_CLUB) {
        setToast({ kind: "error", text: t.errClubFull(MAX_PER_CLUB, player.club) });
        return prev;
      }
      // Neue Spieler rücken nur dann in die Startelf, wenn die Formation das
      // hergibt — sonst auf die Bank.
      const autoStart = canStart(starterCounts(prev), player.position, settings.startingSize).ok;
      const neuerPick = { playerId: player.id, isStarting: autoStart, isCaptain: false, isViceCaptain: false };
      if (!geist) return [...prev, neuerPick];
      // An die Stelle des Vorgaengers setzen, damit die Reihenfolge im
      // Kader-Array und damit die Bankreihenfolge stabil bleibt.
      setErsatz((st) =>
        st.some((r) => r.rausId === geist.pick.playerId)
          ? st
          : [...st, { rausId: geist.pick.playerId, reinId: player.id }]
      );
      const naechste = [...prev];
      naechste.splice(Math.min(geist.idx, naechste.length), 0, neuerPick);
      return naechste;
    });
  }

  function toggleStarting(playerId: number) {
    setSquad((prev) => {
      const pick = prev.find((s) => s.playerId === playerId);
      const pos = playersById.get(playerId)?.position;
      if (!pick || !pos) return prev;

      if (pick.isStarting) {
        // Auf die Bank: immer erlaubt (die Startelf ist dann eben unvollständig),
        // nur der Captain muss in der Startelf bleiben.
        if (pick.isCaptain) {
          setToast({ kind: "error", text: t.errCaptainStart });
          return prev;
        }
        return prev.map((s) => (s.playerId === playerId ? { ...s, isStarting: false } : s));
      }

      const check = canStart(starterCounts(prev), pos, settings.startingSize);
      if (!check.ok) {
        setToast({ kind: "error", text: check.reason });
        return prev;
      }
      return prev.map((s) => (s.playerId === playerId ? { ...s, isStarting: true } : s));
    });
  }

  function setCaptain(playerId: number) {
    setSquad((prev) => {
      const pick = prev.find((s) => s.playerId === playerId);
      const pos = playersById.get(playerId)?.position;
      if (!pick || !pos) return prev;

      // Ein Bankspieler wird zum Captain nur, wenn er auch in die Startelf passt.
      if (!pick.isStarting) {
        const check = canStart(starterCounts(prev), pos, settings.startingSize);
        if (!check.ok) {
          setToast({
            kind: "error",
            text: `Nur Spieler aus der Startelf können Captain sein. ${check.reason}`,
          });
          return prev;
        }
      }
      return prev.map((s) => ({
        ...s,
        isCaptain: s.playerId === playerId,
        // Captain und Vize dürfen nicht dieselbe Person sein.
        isViceCaptain: s.playerId === playerId ? false : s.isViceCaptain,
        isStarting: s.playerId === playerId ? true : s.isStarting,
      }));
    });
  }

  /** Vize-Captain setzen — muss in der Startelf stehen und darf nicht der
   *  Captain sein. */
  function setVice(playerId: number) {
    setSquad((prev) => {
      const pick = prev.find((s) => s.playerId === playerId);
      const pos = playersById.get(playerId)?.position;
      if (!pick || !pos) return prev;
      if (pick.isCaptain) {
        setToast({ kind: "error", text: t.errViceIsCaptain });
        return prev;
      }
      if (!pick.isStarting) {
        const check = canStart(starterCounts(prev), pos, settings.startingSize);
        if (!check.ok) {
          setToast({ kind: "error", text: `${t.errViceStart} ${check.reason}` });
          return prev;
        }
      }
      return prev.map((s) => ({
        ...s,
        isViceCaptain: s.playerId === playerId,
        isStarting: s.playerId === playerId ? true : s.isStarting,
      }));
    });
  }

  function removePlayer(playerId: number) {
    // War der Spieler Nachfolger einer Geisterkarte, wird deren Platz wieder
    // frei — sonst haenge die Zuordnung an einem Spieler, der weg ist.
    setErsatz((st) => st.filter((r) => r.reinId !== playerId && r.rausId !== playerId));
    // Bewusst ausserhalb des setSquad-Updaters: React ruft Updater im Strict
    // Mode zweimal auf. Stand der Eintrag darin, landete jeder entfernte
    // Spieler doppelt in `entfernt` — und damit zweimal auf dem Spielfeld.
    const idx = squad.findIndex((s) => s.playerId === playerId);
    if (idx >= 0) {
      const pick = squad[idx];
      setEntfernt((st) =>
        st.some((e) => e.pick.playerId === playerId) ? st : [...st, { pick, idx }]
      );
    }
    setSquad((prev) => prev.filter((s) => s.playerId !== playerId));
  }

  /**
   * Macht einen ganzen Tausch rückgängig: Der Nachfolger fliegt raus, der
   * Vorgänger kehrt an seinen Platz zurück. Bewusst in einem einzigen
   * `setSquad`, weil `transferRueckgaengig` sonst gegen den alten Kader
   * prüfen würde — der Nachfolger stünde dort noch drin und die Positions-
   * grenze schlüge fehl.
   */
  function tauschRueckgaengig(rausId: number) {
    const paar = ersatz.find((r) => r.rausId === rausId);
    if (!paar) {
      transferRueckgaengig(rausId);
      return;
    }
    const eintrag = entfernt.find((e) => e.pick.playerId === rausId);
    const alt = eintrag?.pick;
    const player = alt ? playersById.get(alt.playerId) : undefined;
    if (!eintrag || !alt || !player) return;

    setSquad((prev) => {
      const ohneNeuen = prev.filter((s) => s.playerId !== paar.reinId);
      const darfStarten =
        alt.isStarting &&
        canStart(starterCounts(ohneNeuen), player.position, settings.startingSize).ok;
      const naechste = [...ohneNeuen];
      naechste.splice(Math.min(eintrag.idx, naechste.length), 0, {
        ...alt,
        isStarting: darfStarten,
        isCaptain: alt.isCaptain && !ohneNeuen.some((s) => s.isCaptain) && darfStarten,
        isViceCaptain: alt.isViceCaptain && !ohneNeuen.some((s) => s.isViceCaptain) && darfStarten,
      });
      return naechste;
    });
    setEntfernt((st) => st.filter((e) => e.pick.playerId !== rausId));
    setErsatz((st) => st.filter((r) => r.rausId !== rausId));
    setToast({ kind: "success", text: t.undoDone(player.name) });
  }

  /** Macht einen "Transfer out" rückgängig — mit denselben Prüfungen
   *  wie beim normalen Hinzufügen (Kader-, Positions- und Club-Limit). */
  function transferRueckgaengig(playerId: number) {
    const eintrag = entfernt.find((e) => e.pick.playerId === playerId);
    if (!eintrag) return;
    const letzter = eintrag.pick;
    const player = playersById.get(letzter.playerId);
    if (!player) return;
    if (squad.some((s) => s.playerId === letzter.playerId)) {
      setEntfernt((st) => st.filter((e) => e.pick.playerId !== playerId));
      return;
    }
    if (squad.length >= settings.squadSize) {
      setToast({ kind: "error", text: t.errSquadFull(settings.squadSize) });
      return;
    }
    if (countByPosition[player.position] >= slotsByPosition[player.position]) {
      setToast({ kind: "error", text: t.errPosFull(t.positions[player.position]) });
      return;
    }
    const gleicherClub = squad.filter(
      (s) => playersById.get(s.playerId)?.club === player.club
    ).length;
    if (gleicherClub >= MAX_PER_CLUB) {
      setToast({ kind: "error", text: t.errClubFull(MAX_PER_CLUB, player.club) });
      return;
    }
    // Startelf-Platz nur, wenn die Formation es noch hergibt; Rollen (C/V)
    // nur zurück, wenn sie inzwischen nicht neu vergeben wurden.
    const darfStarten =
      letzter.isStarting && canStart(starterCounts(), player.position, settings.startingSize).ok;
    const captainFrei = !squad.some((s) => s.isCaptain);
    const vizeFrei = !squad.some((s) => s.isViceCaptain);
    setSquad((prev) => {
      const neu = [...prev];
      neu.splice(Math.min(eintrag.idx, neu.length), 0, {
        ...letzter,
        isStarting: darfStarten,
        isCaptain: letzter.isCaptain && captainFrei && darfStarten,
        isViceCaptain: letzter.isViceCaptain && vizeFrei && darfStarten,
      });
      return neu;
    });
    setEntfernt((st) => st.filter((e) => e.pick.playerId !== playerId));
    setToast({ kind: "success", text: t.undoDone(player.name) });
  }

  /**
   * Bleibt die Formation gültig, wenn Startelf-Spieler `raus` durch
   * Bankspieler `rein` ersetzt wird? Grundlage für das Ausgrauen im
   * Tauschmodus — ungültige Ziele lassen sich gar nicht erst antippen.
   */
  function tauschGueltig(rausId: number, reinId: number): boolean {
    const rausPos = playersById.get(rausId)?.position;
    const reinPos = playersById.get(reinId)?.position;
    if (!rausPos || !reinPos) return false;
    const counts = { ...starterCounts() };
    counts[rausPos]--;
    counts[reinPos]++;
    return POSITIONS.every((p) => counts[p] >= MIN_STARTERS[p] && counts[p] <= MAX_STARTERS[p]);
  }

  /** Führt den Tausch Startelf ↔ Bank aus; Binde wandert mit dem Platz. */
  function tauschen(startelfId: number, bankId: number) {
    setSquad((prev) => {
      const raus = prev.find((s) => s.playerId === startelfId);
      const rein = prev.find((s) => s.playerId === bankId);
      if (!raus || !rein) return prev;
      // Captain/Vize bleiben in der Startelf: Die Rolle geht auf den
      // Hereinkommenden über — sonst wäre der Kader nicht speicherbar.
      if (raus.isCaptain || raus.isViceCaptain) {
        const player = playersById.get(bankId);
        setToast({
          kind: "success",
          text: raus.isCaptain ? t.captainMoved(player?.name ?? "?") : t.viceMoved(player?.name ?? "?"),
        });
      }
      return prev.map((s) => {
        if (s.playerId === startelfId) {
          return { ...s, isStarting: false, isCaptain: false, isViceCaptain: false };
        }
        if (s.playerId === bankId) {
          return {
            ...s,
            isStarting: true,
            isCaptain: raus.isCaptain,
            isViceCaptain: raus.isViceCaptain,
          };
        }
        return s;
      });
    });
    setTauschAus(null);
  }

  /** Tipp auf eine Karte: im Tauschmodus tauschen, sonst Menü öffnen. */
  function karteAngetippt(playerId: number) {
    if (tauschAus === null) {
      setSheetSpieler(playerId);
      return;
    }
    if (playerId === tauschAus) {
      setTauschAus(null); // Quelle nochmal angetippt → abbrechen
      return;
    }
    const quelle = squad.find((s) => s.playerId === tauschAus);
    const ziel = squad.find((s) => s.playerId === playerId);
    if (!quelle || !ziel || quelle.isStarting === ziel.isStarting) return;
    const [startelfId, bankId] = quelle.isStarting
      ? [quelle.playerId, ziel.playerId]
      : [ziel.playerId, quelle.playerId];
    if (!tauschGueltig(startelfId, bankId)) return;
    tauschen(startelfId, bankId);
  }

  /** Ist `playerId` im Tauschmodus ein gültiges Ziel? */
  function istTauschZiel(playerId: number): boolean {
    if (tauschAus === null) return false;
    const quelle = squad.find((s) => s.playerId === tauschAus);
    const ziel = squad.find((s) => s.playerId === playerId);
    if (!quelle || !ziel || quelle.isStarting === ziel.isStarting) return false;
    const [startelfId, bankId] = quelle.isStarting
      ? [quelle.playerId, ziel.playerId]
      : [ziel.playerId, quelle.playerId];
    return tauschGueltig(startelfId, bankId);
  }

  function handleSave() {
    // Vorprüfung im Client, damit der Fehler sofort kommt — der Server
    // validiert dieselben Regeln nochmals verbindlich.
    if (squad.length !== settings.squadSize) {
      setToast({ kind: "error", text: t.errSquadSize(settings.squadSize) });
      return;
    }
    if (formationError) {
      setToast({ kind: "error", text: formationError });
      return;
    }
    if (!hasCaptain) {
      setToast({ kind: "error", text: t.errNoCaptain });
      return;
    }
    if (!squad.some((s) => s.isViceCaptain)) {
      setToast({ kind: "error", text: t.errNoVice });
      return;
    }
    startTransition(async () => {
      const result = await saveSquad(squad);
      if (result?.error) {
        setToast({ kind: "error", text: result.error });
      } else {
        // Gespeichert heisst: Der Tausch ist vollzogen. Geisterkarten und
        // ihre Zuordnungen sind damit erledigt, sonst blieben sie als
        // Stapel stehen, obwohl es nichts mehr rueckgaengig zu machen gibt.
        setEntfernt([]);
        setErsatz([]);
        setTransferModus(false);
        // Spieltag mitnennen: nach einer verstrichenen Deadline gilt die
        // Aufstellung automatisch für den nächsten Spieltag.
        setToast({ kind: "success", text: t.saved(result?.savedForGameweek) });
      }
    });
  }

  const filtered = players
    .filter(
      (p) =>
        (filterPos === "ALL" || p.position === filterPos) &&
        (filterClub === "ALL" || p.club === filterClub) &&
        (search === "" || p.name.toLowerCase().includes(search.toLowerCase()))
    )
    .sort(
      (a, b) =>
        ((b[sortiere] ?? -1) as number) - ((a[sortiere] ?? -1) as number) ||
        b.points - a.points ||
        b.price - a.price
    );

  // Erst nach dem Mounten berechnet: `Date.now()` im Render würde beim
  // Hydrieren vom Server-Wert abweichen können (React-Hydration-Mismatch).
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) return;
    const rechne = () =>
      setHoursLeft(Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000)));
    rechne();
    const id = setInterval(rechne, 60_000);
    return () => clearInterval(id);
  }, [deadline]);
  const countdown =
    hoursLeft === null
      ? null
      : hoursLeft >= 48
        ? t.inDays(Math.round(hoursLeft / 24))
        : t.inHours(hoursLeft);

  return (
    // pb-28: Platz fuer die feste Aktionsleiste, damit sie nichts verdeckt.
    <div className="flex flex-col gap-6 pb-28 lg:flex-row lg:justify-center lg:pb-0">
      {/* Toast */}
      {toast && (
        <p
          role="status"
          className={`toast rounded-full px-5 py-2.5 text-sm font-bold shadow-lg ${
            toast.kind === "error"
              ? "bg-brand-danger text-white"
              : "bg-brand-accent text-brand-deep"
          }`}
        >
          {toast.text}
        </p>
      )}

      {/* Aktionsmenü (Bottom Sheet) — öffnet sich beim Tipp auf eine Karte. */}
      {sheetSpieler !== null && (() => {
        const pick = squad.find((s) => s.playerId === sheetSpieler);
        const player = playersById.get(sheetSpieler);
        if (!pick || !player) return null;
        const zu = () => setSheetSpieler(null);
        // Desktop: Popover an der Karte ausrichten (fixed, damit die
        // clip-path-Kanten von Spielfeld und Bank nichts abschneiden).
        // Mobil bleibt es das Bottom Sheet.
        let popoverStyle: React.CSSProperties | undefined;
        if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
          const anker = document.getElementById(`spieler-karte-${sheetSpieler}`);
          if (anker) {
            const r = anker.getBoundingClientRect();
            const links = Math.min(Math.max(r.left + r.width / 2, 160), window.innerWidth - 160);
            // Seite nach dem tatsaechlich freien Platz waehlen und die Hoehe
            // darauf begrenzen. Mit der Spielerkarte ist das Menue deutlich
            // hoeher als frueher — eine feste Schwelle liess es oben aus dem
            // Bild laufen, und die Werte waren abgeschnitten.
            const platzOben = r.top - 16;
            const platzUnten = window.innerHeight - r.bottom - 16;
            popoverStyle =
              platzOben > platzUnten
                ? {
                    left: links,
                    bottom: window.innerHeight - r.top + 8,
                    transform: "translateX(-50%)",
                    maxHeight: platzOben,
                  }
                : {
                    left: links,
                    top: r.bottom + 8,
                    transform: "translateX(-50%)",
                    maxHeight: platzUnten,
                  };
          }
        }
        return (
          <>
            <button
              type="button"
              aria-label={t.sheetClose}
              onClick={zu}
              className="fixed inset-0 z-40 cursor-default bg-black/40"
            />
            <div
              style={popoverStyle}
              className={
                popoverStyle
                  ? "fixed z-50 w-80 overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
                  : "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl"
              }
            >
              <div className="mb-3">
                <SpielerKarte player={player} t={t} />
              </div>
              {player.manualStats && (
                <div className="mb-3 rounded-xl bg-brand-deep/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-brand-deep">
                    <span aria-hidden>ℹ️</span> {t.manualTitle}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-brand-deep/70">{t.manualText}</p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                {pick.isStarting ? (
                  <>
                    <button
                      type="button"
                      disabled={pick.isCaptain}
                      onClick={() => { setCaptain(pick.playerId); zu(); }}
                      className="pressable-subtle flex items-center gap-3 rounded-xl bg-brand-deep/5 px-4 py-3 text-left text-sm font-semibold text-brand-deep disabled:opacity-40"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs font-bold text-brand-accent">C</span>
                      {t.captainTitle}
                    </button>
                    <button
                      type="button"
                      disabled={pick.isViceCaptain}
                      onClick={() => { setVice(pick.playerId); zu(); }}
                      className="pressable-subtle flex items-center gap-3 rounded-xl bg-brand-deep/5 px-4 py-3 text-left text-sm font-semibold text-brand-deep disabled:opacity-40"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-deep text-xs font-bold text-brand-accent">V</span>
                      {t.viceTitle}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTauschAus(pick.playerId); zu(); }}
                      className="pressable-subtle flex items-center gap-3 rounded-xl bg-brand-deep/5 px-4 py-3 text-left text-sm font-semibold text-brand-deep"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-lime text-xs font-bold text-brand-deep">⇄</span>
                      {t.swapOut}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setTauschAus(pick.playerId); zu(); }}
                    className="pressable-subtle flex items-center gap-3 rounded-xl bg-brand-deep/5 px-4 py-3 text-left text-sm font-semibold text-brand-deep"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-lime text-xs font-bold text-brand-deep">⇄</span>
                    {t.swapIn}
                  </button>
                )}
                {!pick.isStarting && playersById.get(pick.playerId)?.position !== "GK" && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => { moveBench(pick.playerId, -1); zu(); }}
                      className="pressable-subtle flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-deep/5 px-3 py-3 text-sm font-semibold text-brand-deep"
                    >
                      ▲ {t.benchUp}
                    </button>
                    <button
                      type="button"
                      onClick={() => { moveBench(pick.playerId, 1); zu(); }}
                      className="pressable-subtle flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-deep/5 px-3 py-3 text-sm font-semibold text-brand-deep"
                    >
                      ▼ {t.benchDown}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { removePlayer(pick.playerId); setTransferModus(true); zu(); }}
                  className="pressable-subtle flex items-center gap-3 rounded-xl bg-brand-danger/10 px-4 py-3 text-left text-sm font-semibold text-brand-danger"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-danger text-xs font-bold text-white">✕</span>
                  {t.transferOut}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Spielerkarte aus dem Markt — mobil als Bottom Sheet, auf dem Desktop
          mittig, weil die Marktzeile als Anker zu schmal waere. */}
      {marktSpieler !== null && (() => {
        const player = playersById.get(marktSpieler);
        if (!player) return null;
        const imKader = squad.some((s) => s.playerId === player.id);
        const zu = () => setMarktSpieler(null);
        return (
          <>
            <button
              type="button"
              aria-label={t.sheetClose}
              onClick={zu}
              className="fixed inset-0 z-40 cursor-default bg-black/40"
            />
            <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl bg-white p-4 shadow-2xl sm:inset-0 sm:m-auto sm:h-fit sm:w-80 sm:rounded-2xl">
              <SpielerKarte player={player} t={t} />
              {player.manualStats && (
                <div className="mt-3 rounded-xl bg-brand-deep/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-brand-deep">
                    <span aria-hidden>&#8505;&#65039;</span> {t.manualTitle}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-brand-deep/70">{t.manualText}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => { togglePlayer(player); zu(); }}
                className={`pressable mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold ${
                  imKader
                    ? "bg-brand-danger/10 text-brand-danger"
                    : "bg-brand-deep text-brand-accent"
                }`}
              >
                {imKader ? t.cardRemove : t.cardAdd}
              </button>
            </div>
          </>
        );
      })()}

      {/* Transfer-Modus-Hinweis mit Fertig-Knopf. */}
      {transferModus && tauschAus === null && (
        <div className="fixed inset-x-0 bottom-28 z-40 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-brand-deep px-4 py-2.5 text-xs font-semibold text-white shadow-2xl lg:bottom-4">
          <span className="truncate">{t.transferHint}</span>
          <button
            type="button"
            onClick={() => setTransferModus(false)}
            className="pressable shrink-0 rounded-full bg-brand-accent px-3 py-1 font-bold text-brand-deep"
          >
            {t.transferDone}
          </button>
        </div>
      )}

      {/* Tauschmodus-Hinweis mit Abbrechen — schwebt unten, bis getauscht wird. */}
      {tauschAus !== null && (
        <div className="fixed inset-x-0 bottom-28 z-40 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-brand-deep px-4 py-2.5 text-xs font-semibold text-white shadow-2xl lg:bottom-4">
          <span className="truncate">
            {t.swapHint(playersById.get(tauschAus)?.name ?? "?")}
          </span>
          <button
            type="button"
            onClick={() => setTauschAus(null)}
            className="pressable shrink-0 rounded-full bg-white/15 px-3 py-1 font-bold"
          >
            {t.swapCancel}
          </button>
        </div>
      )}

      {/* ===== Spielfeld ===== */}
      {/* Auf breiten Bildschirmen gedeckelt — sonst wachsen Spielfeld und
          Bank ins Riesige und wirken neben dem fixen Markt unzentriert. */}
      <section className="min-w-0 flex-1 lg:max-w-[44rem]">
        {/* Status-Leiste: eine schmale Zeile mit allen Kennzahlen statt
            vier hoher Kacheln — Warnungen darunter, nur wenn nötig. */}
        <div className="chamfer mb-3 bg-white px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span className="whitespace-nowrap">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">{t.budget} </span>
              <span
                className={`font-bold tabular-nums ${
                  budgetLeft < 0 ? "text-brand-danger" : "text-brand-deep"
                }`}
              >
                {budgetLeft.toFixed(1)}
              </span>
              {effectiveCap > settings.budgetCap && (
                <span
                  className="ml-1 text-[11px] font-medium text-brand-deep/50"
                  title={t.capHint}
                >
                  {t.of} {effectiveCap.toFixed(1)}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">{t.squad} </span>
              <span className="font-bold tabular-nums text-brand-deep">
                {squad.length}/{settings.squadSize}
              </span>
            </span>
            <span className="whitespace-nowrap">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">{t.starters} </span>
              <span className="font-bold tabular-nums text-brand-deep">
                {startingCount}/{settings.startingSize}
              </span>
              {startingCount === settings.startingSize && !formationError && (
                <span className="ml-1.5 rounded bg-brand-accent/25 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-brand-deep">
                  {formationLabel(startingCounts)}
                </span>
              )}
            </span>
            <span className="whitespace-nowrap">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-deep/50">{t.transfers} </span>
              {unlimitedTransfers ? (
                <span className="font-bold text-brand-magenta">{t.unlimited}</span>
              ) : wildcardActive ? (
                <span className="font-bold text-brand-magenta">Wildcard</span>
              ) : (
                <span className="font-bold tabular-nums text-brand-deep">
                  {freeTransfers} {t.free}
                  {transfersUsed > 0 && (
                    <span className="font-medium text-brand-deep/50"> · {transfersUsed} {t.used}</span>
                  )}
                </span>
              )}
            </span>
            {doubleGameweek && (
              <span className="whitespace-nowrap rounded-full bg-brand-lime px-2 py-0.5 text-[11px] font-bold text-brand-deep">
                {t.doubleGameweek}
              </span>
            )}
            {countdown && (
              <span className="whitespace-nowrap text-[11px] font-bold text-brand-magenta">
                {t.deadlineIn(countdown)}
              </span>
            )}
          </div>
          {/* Detail- und Warnzeile: nur zeigen, wenn etwas fehlt oder kostet. */}
          {squad.length < settings.squadSize && (
            <div className="mt-0.5 text-[11px] font-medium text-brand-deep/50">
              {POSITIONS.map((p) => `${p} ${countByPosition[p]}/${slotsByPosition[p]}`).join(" · ")}
            </div>
          )}
          {(formationError || (!hasCaptain && squad.length > 0) || pendingCost > 0) && (
            <div className="mt-0.5 text-[11px] font-bold text-brand-danger">
              {[
                squad.length > 0 && formationError
                  ? startingCount < settings.startingSize
                    ? // Konkret sagen, was noch fehlt, statt nur "unvollständig".
                      t.startersLabel + " " +
                      ((["GK", "DEF", "MID", "FWD"] as Position[])
                        .filter((p) => startingCounts[p] < MIN_STARTERS[p])
                        .map((p) => `${MIN_STARTERS[p] - startingCounts[p]}× ${p}`)
                        .join(", ") || t.stillNeeded(settings.startingSize - startingCount))
                    : formationError
                  : null,
                !hasCaptain && squad.length > 0 ? t.captainMissing : null,
                pendingCost > 0 ? t.pointsOnSave(pendingCost) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>

        {/* Rasen */}
        <div className="pitch px-2 py-8 sm:px-6">
          <div className="relative z-10 flex flex-col gap-7">
            {POSITIONS.map((pos) => {
              const row = starters(pos);
              // Geisterkarten (Transfer-Modus) belegen ihren Platz sichtbar —
              // fuer sie braucht es keinen "+"-Platzhalter mehr. Nach dem
              // Original-Index einsortiert, damit nichts in der Reihe springt.
              const geister = transferModus
                ? entfernt.filter(
                    (e) =>
                      e.pick.isStarting &&
                      playersById.get(e.pick.playerId)?.position === pos &&
                      !squad.some((s) => s.playerId === e.pick.playerId)
                  )
                : [];
              // Ersetzte Spieler erscheinen nicht als eigene Karte, sondern
              // als Stapel am Platz ihres Vorgaengers.
              const ersatzVon = new Map(ersatz.map((r) => [r.rausId, r.reinId]));
              const alsStapel = new Set(
                geister
                  .map((e) => ersatzVon.get(e.pick.playerId))
                  .filter((id): id is number => id !== undefined && row.some((p) => p.playerId === id))
              );
              const eintraege = [
                ...row
                  .filter((pick) => !alsStapel.has(pick.playerId))
                  .map((pick) => ({
                    pick,
                    geist: false,
                    idx: squad.findIndex((s) => s.playerId === pick.playerId),
                  })),
                ...geister.map((e) => ({ pick: e.pick, geist: true, idx: e.idx })),
              ].sort((a, b) => a.idx - b.idx);
              const missing = slotsByPosition[pos] - countByPosition[pos] - geister.length;
              return (
                // Nie umbrechen: pro Position genau eine Linie, egal ob drei
                // oder fünf Spieler. Die Karten teilen sich die Breite.
                <div key={pos} className="flex items-start justify-center gap-1.5 sm:gap-5">
                  {eintraege.map(({ pick, geist }) => {
                    const player = playersById.get(pick.playerId);
                    if (!player) return null;
                    if (geist) {
                      const reinId = ersatzVon.get(pick.playerId);
                      const nachfolger = reinId !== undefined ? playersById.get(reinId) : undefined;
                      const nachfolgerPick = reinId !== undefined
                        ? squad.find((s) => s.playerId === reinId)
                        : undefined;
                      if (nachfolger && nachfolgerPick) {
                        return (
                          <TauschStapel
                            key={`stapel-${pick.playerId}`}
                            t={t}
                            alt={player}
                            altPick={pick}
                            neu={nachfolger}
                            neuPick={nachfolgerPick}
                            onUndo={() => tauschRueckgaengig(pick.playerId)}
                            onTap={() => karteAngetippt(nachfolgerPick.playerId)}
                          />
                        );
                      }
                      return (
                        <PlayerCard
                          key={pick.playerId}
                          t={t}
                          player={player}
                          pick={{ ...pick, isCaptain: false, isViceCaptain: false }}
                          dimmed
                          showPrice
                          onTap={() => ersatzSuchen(player.position)}
                          onUndo={() => transferRueckgaengig(pick.playerId)}
                        />
                      );
                    }
                    return (
                      <PlayerCard
                        key={pick.playerId}
                        t={t}
                        player={player}
                        pick={pick}
                        highlight={tauschAus === pick.playerId}
                        dimmed={tauschAus !== null && tauschAus !== pick.playerId && !istTauschZiel(pick.playerId)}
                        showPrice={transferModus}
                        onQuickRemove={transferModus ? () => removePlayer(pick.playerId) : undefined}
                        onTap={
                          tauschAus === null || tauschAus === pick.playerId || istTauschZiel(pick.playerId)
                            ? () => karteAngetippt(pick.playerId)
                            : undefined
                        }
                      />
                    );
                  })}
                  {missing > 0 && (
                    <EmptySlot
                      t={t}
                      label={t.positions[pos]}
                      missing={missing}
                      onClick={() => ersatzSuchen(pos)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bank — Torhüter fix zuerst, danach die Einwechsel-Reihenfolge. */}
        <div className="mt-3 chamfer bg-brand-deep/95 px-4 py-4 sm:px-5 sm:py-5">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/60">
            {t.bank}
          </div>
          {/* Eingeklappt: Der Text stand bei jedem Aufruf ueber der Bank und
              kostete auf dem Handy drei Zeilen, obwohl man ihn einmal liest. */}
          <details className="mb-3 group">
            <summary className="cursor-pointer list-none text-[11px] font-semibold text-white/45 [&::-webkit-details-marker]:hidden">
              {t.benchHint} <span className="group-open:hidden">▾</span>
              <span className="hidden group-open:inline">▴</span>
            </summary>
            <p className="mt-1.5 text-[11px] leading-snug text-white/45">{t.benchOrderHint}</p>
          </details>
          {bench.length === 0 ? (
            <p className="text-sm text-white/50">{t.emptyBench}</p>
          ) : (
            <div className="flex items-start justify-center gap-2 sm:gap-6">
              {benchGk.map((pick) => {
                const player = playersById.get(pick.playerId);
                if (!player) return null;
                return (
                  <div key={pick.playerId} className="flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center gap-1.5">
                    <span className="rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/70">
                      {t.positions.GK}
                    </span>
                    <PlayerCard
                      t={t}
                      player={player}
                      pick={pick}
                      highlight={tauschAus === pick.playerId}
                      dimmed={tauschAus !== null && tauschAus !== pick.playerId && !istTauschZiel(pick.playerId)}
                      showPrice={transferModus}
                      onQuickRemove={transferModus ? () => removePlayer(pick.playerId) : undefined}
                      onTap={
                        tauschAus === null || tauschAus === pick.playerId || istTauschZiel(pick.playerId)
                          ? () => karteAngetippt(pick.playerId)
                          : undefined
                      }
                    />
                  </div>
                );
              })}
              {benchGk.length > 0 && benchFeld.length > 0 && (
                <span className="mt-6 h-16 w-px shrink-0 bg-white/15" aria-hidden />
              )}
              {benchFeld.map((pick, i) => {
                const player = playersById.get(pick.playerId);
                if (!player) return null;
                return (
                  <div key={pick.playerId} className="flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center gap-1.5">
                    <span className="rounded bg-brand-accent/25 px-1.5 py-0.5 text-[9px] font-bold text-brand-accent">
                      {i + 1}.
                    </span>
                    <PlayerCard
                      t={t}
                      player={player}
                      pick={pick}
                      highlight={tauschAus === pick.playerId}
                      dimmed={tauschAus !== null && tauschAus !== pick.playerId && !istTauschZiel(pick.playerId)}
                      showPrice={transferModus}
                      onQuickRemove={transferModus ? () => removePlayer(pick.playerId) : undefined}
                      onTap={
                        tauschAus === null || tauschAus === pick.playerId || istTauschZiel(pick.playerId)
                          ? () => karteAngetippt(pick.playerId)
                          : undefined
                      }
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveBench(pick.playerId, -1)}
                        disabled={i === 0}
                        aria-label={t.benchEarlier(player.name)}
                        title={t.benchEarlier(player.name)}
                        className="pressable relative h-5 w-5 rounded bg-white/15 text-[10px] font-bold leading-none text-white before:absolute before:-inset-2.5 before:content-[''] disabled:opacity-25 sm:h-6 sm:w-6"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBench(pick.playerId, 1)}
                        disabled={i === benchFeld.length - 1}
                        aria-label={t.benchLater(player.name)}
                        title={t.benchLater(player.name)}
                        className="pressable relative h-5 w-5 rounded bg-white/15 text-[10px] font-bold leading-none text-white before:absolute before:-inset-2.5 before:content-[''] disabled:opacity-25 sm:h-6 sm:w-6"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                );
              })}
              {transferModus &&
                entfernt
                  .filter((e) => !e.pick.isStarting && !squad.some((s) => s.playerId === e.pick.playerId))
                  .map(({ pick: e }) => {
                    const player = playersById.get(e.playerId);
                    if (!player) return null;
                    // Wie auf dem Spielfeld: Nachfolger vorne, Vorgaenger blass
                    // dahinter — nur wenn der Neue auch auf der Bank sitzt.
                    const reinId = ersatz.find((r) => r.rausId === e.playerId)?.reinId;
                    const nachfolgerPick = reinId !== undefined
                      ? squad.find((s) => s.playerId === reinId && !s.isStarting)
                      : undefined;
                    const nachfolger = nachfolgerPick ? playersById.get(nachfolgerPick.playerId) : undefined;
                    return (
                      <div key={`ghost-${e.playerId}`} className="flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center gap-1.5">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                          —
                        </span>
                        {nachfolger && nachfolgerPick ? (
                          <TauschStapel
                            t={t}
                            alt={player}
                            altPick={e}
                            neu={nachfolger}
                            neuPick={nachfolgerPick}
                            onUndo={() => tauschRueckgaengig(e.playerId)}
                            onTap={() => karteAngetippt(nachfolgerPick.playerId)}
                          />
                        ) : (
                          <PlayerCard
                            t={t}
                            player={player}
                            pick={{ ...e, isCaptain: false, isViceCaptain: false }}
                            dimmed
                            showPrice
                            onTap={() => ersatzSuchen(player.position)}
                            onUndo={() => transferRueckgaengig(e.playerId)}
                          />
                        )}
                      </div>
                    );
                  })}
            </div>
          )}
        </div>

        {/* Chips */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {chips.map((c) => {
            const info = CHIP_META[c.chip];
            const desc = c.chip === "wildcard" ? t.wildcardDesc : t.benchBoostDesc;
            const verbraucht = c.usedInGameweek !== null;
            return (
              <div
                key={c.chip}
                className={`chamfer border-2 p-3 transition-colors ${
                  c.activeNow
                    ? "border-brand-accent bg-brand-accent/10"
                    : verbraucht
                      ? "border-brand-deep/10 bg-white opacity-60"
                      : "border-brand-deep/10 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-bold text-brand-deep">
                      <span>
                        <span className="mr-1">{info.icon}</span>
                        {info.name}
                      </span>
                      {/* Verbleibende Einsätze diese Saison. Ein aktivierter
                          Chip gilt als belegt — bis zur Deadline aber
                          umkehrbar, dann steht wieder 1/1. */}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          verbraucht || c.activeNow
                            ? "bg-brand-deep/10 text-brand-deep/50"
                            : "bg-brand-accent/25 text-brand-deep"
                        }`}
                      >
                        {verbraucht || c.activeNow ? "0/1" : "1/1"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-brand-deep/60">
                      {verbraucht ? t.chipUsed(c.usedInGameweek ?? 0) : desc}
                    </p>
                  </div>
                  {!verbraucht && (
                    <button
                      type="button"
                      disabled={isPending || !gameweekOpen}
                      onClick={() => handleChip(c.chip, c.activeNow)}
                      className={`pressable shrink-0 rounded-full px-3 py-1 text-xs font-bold disabled:opacity-40 ${
                        c.activeNow
                          ? "bg-brand-deep text-brand-accent"
                          : "bg-brand-accent text-brand-deep"
                      }`}
                    >
                      {c.activeNow ? t.deactivate : t.activate}
                    </button>
                  )}
                </div>
                {c.activeNow && gameweekNumber !== null && (
                  <p className="mt-2 text-[11px] font-bold text-brand-deep">
                    {t.chipActive(gameweekNumber)}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Speichern — ab lg hier, darunter in der festen Leiste am
            unteren Rand. Vorher klebte dieser Knopf nur innerhalb der
            linken Spalte und war aus dem Markt heraus nicht erreichbar. */}
        <div className="sticky bottom-4 z-20 mt-4 hidden justify-center lg:flex">
          <button
            type="button"
            disabled={isPending || !gameweekOpen}
            onClick={handleSave}
            className="pressable w-full max-w-xs rounded-full bg-brand-accent px-6 py-3 font-bold text-brand-deep shadow-lg shadow-brand-deep/20 disabled:opacity-40"
          >
            {isPending ? t.saving : gameweekOpen ? t.save : t.locked}
          </button>
        </div>
      </section>

      {/* ===== Spielermarkt ===== */}
      {/* Feste Aktionsleiste (nur Handy).
          Der Speichern-Knopf klebte bisher innerhalb der linken Spalte und
          war aus dem Spielermarkt heraus nicht erreichbar — nach einem
          Transfer musste man rund 1100 px zurueckscrollen. Hier steht er
          immer im Daumenbereich, zusammen mit dem Kaderstand und dem
          Zugang zum Markt. */}
      <div className="fixed inset-x-0 bottom-0 z-30 lg:hidden">
        <div className="mx-auto max-w-md px-3 pb-3">
          <div className="chamfer bg-brand-deep px-3 py-2.5 shadow-2xl shadow-black/40">
            <div className="mb-2 flex items-baseline justify-between text-[11px] font-semibold text-white/60">
              <span>
                {t.squad} {squad.length}/{settings.squadSize} · {t.starters} {startingCount}/
                {settings.startingSize}
              </span>
              <span className={budgetLeft < -1e-9 ? "text-brand-accent" : ""}>
                {t.budget} {budgetLeft.toFixed(1)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMarktOffen(true)}
                className="pressable flex-1 rounded-full bg-white/10 px-3 py-3 text-sm font-bold text-white"
              >
                {t.openMarket}
              </button>
              <button
                type="button"
                disabled={isPending || !gameweekOpen}
                onClick={handleSave}
                className="pressable flex-[1.3] rounded-full bg-brand-accent px-3 py-3 text-sm font-bold text-brand-deep disabled:opacity-40"
              >
                {isPending ? t.saving : gameweekOpen ? t.save : t.locked}
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside
        ref={marketRef}
        className={`${
          marktOffen ? "fixed inset-0 z-40 flex flex-col bg-brand-deep/60 p-3" : "hidden"
        } lg:static lg:z-auto lg:block lg:w-[22rem] lg:shrink-0 lg:bg-transparent lg:p-0`}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden chamfer bg-white shadow-sm lg:sticky lg:top-4 lg:flex-none">
          <div className="brand-gradient flex items-center justify-between px-4 py-3 text-sm font-bold text-white">
            {t.pickPlayers}
            <button
              type="button"
              onClick={() => setMarktOffen(false)}
              aria-label={t.closeMarket}
              className="pressable relative -m-2 flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none text-white/80 lg:hidden"
            >
              ✕
            </button>
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
                    className={`pressable-subtle flex-1 rounded-full px-1 py-3 text-xs font-bold ${
                      filterPos === pos
                        ? "bg-brand-deep text-brand-accent"
                        : "bg-brand-deep/5 text-brand-deep/70 hover:bg-brand-deep/10"
                    }`}
                  >
                    {pos === "ALL" ? t.all : pos}
                    {pos !== "ALL" && (
                      <span
                        className={`ml-1 text-[10px] font-semibold ${
                          filterPos === pos
                            ? "text-brand-accent/70"
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
            {/* Suche auf eigener Zeile: geteilt mit den beiden Auswahlfeldern
                blieben ihr 108 px, der Platzhalter brach zu "Spieler s…" ab. */}
            <input
              type="search"
              style={{ WebkitAppearance: "none" }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full rounded-lg border border-brand-deep/15 px-3 py-2 text-base outline-none focus:border-brand-magenta sm:text-sm"
            />
            <div className="flex gap-2">
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
              <select
                value={sortiere}
                onChange={(e) => setSortiere(e.target.value as typeof sortiere)}
                aria-label={t.toggleSort}
                className="rounded-lg border border-brand-deep/15 px-2 py-1.5 text-base font-semibold text-brand-deep outline-none focus:border-brand-magenta sm:text-sm"
              >
                <option value="points">{t.sortPoints}</option>
                <option value="price">{t.sortPrice}</option>
                <option value="goals">{t.sortGoals}</option>
                <option value="assists">{t.sortAssists}</option>
                <option value="cleanSheets">{t.sortCleanSheets}</option>
                <option value="owned">{t.sortOwned}</option>
              </select>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-[34rem] lg:flex-none">
            {filtered.map((p) => {
              const picked = squad.some((s) => s.playerId === p.id);
              return (
                // Zwei Ziele in einer Zeile: die Flaeche oeffnet die
                // Spielerkarte, das +/- bleibt der schnelle Weg in den Kader.
                // Ein einziger Knopf wuerde das eine gegen das andere
                // eintauschen — vor der Deadline braucht es beides.
                <div
                  key={p.id}
                  className={`flex w-full items-center border-b border-brand-deep/5 pr-3 text-sm ${
                    picked ? "bg-brand-accent/15" : "hover:bg-brand-deep/5"
                  }`}
                >
                <button
                  type="button"
                  onClick={() => setMarktSpieler(p.id)}
                  aria-label={t.cardOpen(p.name)}
                  className="pressable-subtle flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-2 text-left"
                >
                  <Jersey club={p.club} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 truncate font-semibold text-brand-deep">
                      {p.flag && (
                        <span
                          title={p.flagNote ?? undefined}
                          className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                            p.flag === "red" ? "bg-brand-danger" : "bg-amber-400"
                          }`}
                        />
                      )}
                      {p.manualStats && (
                        <span
                          title={t.manualShort}
                          aria-label={t.manualShort}
                          className="shrink-0 text-[11px] leading-none"
                        >
                          ℹ️
                        </span>
                      )}
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="block truncate text-xs text-brand-deep/50">
                      {p.club} · {p.position}
                      {p.owned > 0 && ` · 👥 ${p.owned}%`}
                      {p.nextOpponent && (
                        <span className="text-brand-deep/40"> · {p.nextOpponent}</span>
                      )}
                    </span>
                  </span>
                  {/* Die Spalte zeigt, wonach sortiert ist — Punkte als Standard. */}
                  <span className="w-11 text-right">
                    <span className="block text-[10px] font-semibold uppercase text-brand-deep/40">
                      {t.statShort[marktSpalte]}
                    </span>
                    <span className="block font-bold tabular-nums text-brand-deep">
                      {marktSpalte === "cleanSheets" ? (p.cleanSheets ?? "—") : p[marktSpalte]}
                    </span>
                  </span>
                  <span className="w-9 text-right font-bold tabular-nums text-brand-deep">
                    {p.price.toFixed(1)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => togglePlayer(p)}
                  title={picked ? t.cardRemove : t.cardAdd}
                  aria-label={`${picked ? t.cardRemove : t.cardAdd}: ${p.name}`}
                  className={`pressable relative ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold before:absolute before:-inset-1.5 before:content-[''] ${
                    picked ? "bg-brand-danger text-white" : "bg-brand-accent text-brand-deep"
                  }`}
                >
                  {picked ? "−" : "+"}
                </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-brand-deep/50">
                {t.noneFound}
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
