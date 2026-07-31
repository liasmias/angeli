"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Jersey from "@/components/jersey";
import type { Position } from "@/lib/database.types";
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
  /** Gegner am kommenden Spieltag, z. B. "ZUR (A)" — null bei spielfrei. */
  nextOpponent: string | null;
}

export interface SquadPick {
  playerId: number;
  isStarting: boolean;
  isCaptain: boolean;
  /** Übernimmt die Binde, falls der Captain nicht zum Einsatz kommt. */
  isViceCaptain: boolean;
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
  t: BuilderDict;
}) {
  return (
    <div
      id={`spieler-karte-${player.id}`}
      className={`pop-in group relative flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center transition-opacity duration-150 ${
        dimmed ? "opacity-35" : ""
      }`}
    >
      {(pick.isCaptain || pick.isViceCaptain) && (
        <span
          className={`pop-in absolute top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-white sm:h-6 sm:w-6 sm:text-xs ${
            onQuickRemove ? "left-0.5" : "right-0.5"
          } ${pick.isCaptain ? "bg-black text-brand-accent" : "bg-white text-brand-deep"}`}
        >
          {pick.isCaptain ? "C" : "V"}
        </span>
      )}
      {onQuickRemove && (
        <button
          type="button"
          onClick={onQuickRemove}
          title={t.remove(player.name)}
          aria-label={t.remove(player.name)}
          className="pressable absolute right-0.5 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand-danger text-[10px] font-bold leading-none text-white ring-2 ring-white sm:h-6 sm:w-6 sm:text-xs"
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
          className="pressable absolute right-0.5 top-0 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-brand-lime text-[10px] font-bold leading-none text-brand-deep ring-2 ring-white sm:h-6 sm:w-6 sm:text-xs"
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
        <div
          className={`w-full truncate rounded-b px-1 py-0.5 text-center text-[9px] font-medium leading-4 sm:px-1.5 sm:text-xs ${
            showPrice ? "bg-brand-accent font-bold text-brand-deep" : "bg-brand-deep text-white/90"
          }`}
        >
          {showPrice ? player.price.toFixed(1) : (player.nextOpponent ?? "—")}
        </div>
      </button>
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
  const [tauschAus, setTauschAus] = useState<number | null>(null);
  // Transfer-Modus: Karten zeigen Preise und ein ✕ zum direkten Entfernen.
  const [transferModus, setTransferModus] = useState(false);
  // Zuletzt entfernte Spieler — Grundlage für "Rückgängig" im Transfer-Modus.
  const [entfernt, setEntfernt] = useState<SquadPick[]>([]);
  const [filterPos, setFilterPos] = useState<Position | "ALL">("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  // Standard: die punktbesten Spieler zuoberst; umschaltbar auf Preis.
  const [sortiere, setSortiere] = useState<"points" | "price" | "goals" | "assists">("points");
  const marketRef = useRef<HTMLElement | null>(null);

  // Auf dem Handy liegt der Spielermarkt unterhalb des Spielfelds — ein Tipp
  // auf einen leeren Slot würde sonst sichtbar nichts bewirken. Im breiten
  // Layout (ab lg) steht der Markt daneben, dort wäre der Sprung störend.
  function jumpToMarket() {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    marketRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const spent = squad.reduce((sum, s) => sum + (playersById.get(s.playerId)?.price ?? 0), 0);
  // Persönliche Obergrenze: Basis-Budget oder aktueller Wert des gespeicherten
  // Teams — Preissteigerungen gehaltener Spieler sprengen die 100 legal.
  // Spiegelt dieselbe Rechnung wie der Server beim Speichern.
  const savedValue = initialSquad.reduce(
    (sum, s) => sum + (playersById.get(s.playerId)?.price ?? 0),
    0
  );
  const effectiveCap = Math.max(settings.budgetCap, savedValue);
  const budgetLeft = effectiveCap - spent;
  const countByPosition: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const s of squad) {
    const pos = playersById.get(s.playerId)?.position;
    if (pos) countByPosition[pos]++;
  }
  const startingCount = squad.filter((s) => s.isStarting).length;
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
  const benchGk = bench.filter((s) => playersById.get(s.playerId)?.position === "GK");
  const benchFeld = bench.filter((s) => playersById.get(s.playerId)?.position !== "GK");

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
      return [...prev, { playerId: player.id, isStarting: autoStart, isCaptain: false, isViceCaptain: false }];
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
    setSquad((prev) => {
      const pick = prev.find((s) => s.playerId === playerId);
      if (pick) setEntfernt((st) => [...st, pick]);
      return prev.filter((s) => s.playerId !== playerId);
    });
  }

  /** Macht einen "Transfer out" rückgängig — mit denselben Prüfungen
   *  wie beim normalen Hinzufügen (Kader-, Positions- und Club-Limit). */
  function transferRueckgaengig(playerId: number) {
    const letzter = entfernt.find((s) => s.playerId === playerId);
    if (!letzter) return;
    const player = playersById.get(letzter.playerId);
    if (!player) return;
    if (squad.some((s) => s.playerId === letzter.playerId)) {
      setEntfernt((st) => st.filter((s) => s.playerId !== playerId));
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
    setSquad((prev) => [
      ...prev,
      {
        ...letzter,
        isStarting: darfStarten,
        isCaptain: letzter.isCaptain && captainFrei && darfStarten,
        isViceCaptain: letzter.isViceCaptain && vizeFrei && darfStarten,
      },
    ]);
    setEntfernt((st) => st.filter((s) => s.playerId !== playerId));
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
    .sort((a, b) => (b[sortiere] - a[sortiere]) || b.points - a.points || b.price - a.price);

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
    <div className="flex flex-col gap-6 lg:flex-row">
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
            const links = Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150);
            popoverStyle =
              r.top > 300
                ? { left: links, bottom: window.innerHeight - r.top + 8, transform: "translateX(-50%)" }
                : { left: links, top: r.bottom + 8, transform: "translateX(-50%)" };
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
                  ? "fixed z-50 w-64 rounded-2xl bg-white p-4 shadow-2xl"
                  : "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl bg-white p-4 shadow-2xl"
              }
            >
              <div className="mb-3 flex items-center gap-3">
                <Jersey club={player.club} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-bold text-brand-deep">{player.name}</p>
                  <p className="text-xs text-brand-deep/60">
                    {player.club} · {t.positions[player.position]} · {player.price.toFixed(1)}
                  </p>
                </div>
              </div>
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

      {/* Transfer-Modus-Hinweis mit Fertig-Knopf. */}
      {transferModus && tauschAus === null && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-brand-deep px-4 py-2.5 text-xs font-semibold text-white shadow-2xl">
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
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[92vw] items-center gap-3 rounded-full bg-brand-deep px-4 py-2.5 text-xs font-semibold text-white shadow-2xl">
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
      <section className="min-w-0 flex-1">
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
              // fuer sie braucht es keinen "+"-Platzhalter mehr.
              const geister = transferModus
                ? entfernt.filter(
                    (e) =>
                      e.isStarting &&
                      playersById.get(e.playerId)?.position === pos &&
                      !squad.some((s) => s.playerId === e.playerId)
                  )
                : [];
              const missing = slotsByPosition[pos] - countByPosition[pos] - geister.length;
              return (
                // Nie umbrechen: pro Position genau eine Linie, egal ob drei
                // oder fünf Spieler. Die Karten teilen sich die Breite.
                <div key={pos} className="flex items-start justify-center gap-1.5 sm:gap-5">
                  {row.map((pick) => {
                    const player = playersById.get(pick.playerId);
                    if (!player) return null;
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
                  {geister.map((e) => {
                        const player = playersById.get(e.playerId);
                        if (!player) return null;
                        return (
                          <PlayerCard
                            key={`ghost-${e.playerId}`}
                            t={t}
                            player={player}
                            pick={{ ...e, isCaptain: false, isViceCaptain: false }}
                            dimmed
                            showPrice
                            onUndo={() => transferRueckgaengig(e.playerId)}
                          />
                        );
                      })}
                  {missing > 0 && (
                    <EmptySlot
                      t={t}
                      label={t.positions[pos]}
                      missing={missing}
                      onClick={() => {
                        setFilterPos(pos);
                        setFilterClub("ALL");
                        setSearch("");
                        jumpToMarket();
                      }}
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
          <p className="mb-4 text-[11px] leading-snug text-white/45">{t.benchOrderHint}</p>
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
                        className="pressable h-5 w-5 rounded bg-white/15 text-[10px] font-bold leading-none text-white disabled:opacity-25 sm:h-6 sm:w-6"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBench(pick.playerId, 1)}
                        disabled={i === benchFeld.length - 1}
                        aria-label={t.benchLater(player.name)}
                        title={t.benchLater(player.name)}
                        className="pressable h-5 w-5 rounded bg-white/15 text-[10px] font-bold leading-none text-white disabled:opacity-25 sm:h-6 sm:w-6"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                );
              })}
              {transferModus &&
                entfernt
                  .filter((e) => !e.isStarting && !squad.some((s) => s.playerId === e.playerId))
                  .map((e) => {
                    const player = playersById.get(e.playerId);
                    if (!player) return null;
                    return (
                      <div key={`ghost-${e.playerId}`} className="flex min-w-0 max-w-[7.4rem] flex-1 flex-col items-center gap-1.5">
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                          —
                        </span>
                        <PlayerCard
                          t={t}
                          player={player}
                          pick={{ ...e, isCaptain: false, isViceCaptain: false }}
                          dimmed
                          showPrice
                          onUndo={() => transferRueckgaengig(e.playerId)}
                        />
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

        {/* Speichern */}
        <div className="sticky bottom-4 z-20 mt-4 flex justify-center">
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
      <aside ref={marketRef} className="w-full shrink-0 scroll-mt-4 lg:w-[22rem]">
        <div className="overflow-hidden chamfer bg-white shadow-sm lg:sticky lg:top-4">
          <div className="brand-gradient px-4 py-3 text-sm font-bold text-white">
            {t.pickPlayers}
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
            <div className="flex gap-2">
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
                    picked ? "bg-brand-accent/15" : "hover:bg-brand-deep/5"
                  }`}
                >
                  <Jersey club={p.club} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-brand-deep">{p.name}</span>
                    <span className="block truncate text-xs text-brand-deep/50">
                      {p.club} · {p.position}
                      {p.goals > 0 && ` · ⚽ ${p.goals}`}
                      {p.assists > 0 && ` · 🅰 ${p.assists}`}
                      {p.nextOpponent && (
                        <span className="text-brand-deep/40"> · {p.nextOpponent}</span>
                      )}
                    </span>
                  </span>
                  <span className="w-10 text-right">
                    <span className="block text-[10px] font-semibold uppercase text-brand-deep/40">
                      {t.pts}
                    </span>
                    <span className="block font-bold tabular-nums text-brand-deep">{p.points}</span>
                  </span>
                  <span className="w-9 text-right font-bold tabular-nums text-brand-deep">
                    {p.price.toFixed(1)}
                  </span>
                  <span
                    className={`pressable flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                      picked ? "bg-brand-danger text-white" : "bg-brand-accent text-brand-deep"
                    }`}
                  >
                    {picked ? "−" : "+"}
                  </span>
                </button>
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
