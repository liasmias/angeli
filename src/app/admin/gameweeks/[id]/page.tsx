import { createClient } from "@/lib/supabase/server";
import { saveStatOverride, recomputeGameweek } from "../../actions";

const FIELDS = [
  { key: "minutes", label: "Min." },
  { key: "goals", label: "Tore" },
  { key: "assists", label: "Assists" },
  { key: "goals_conceded", label: "Gegentore" },
  { key: "saves", label: "Paraden" },
  { key: "penalties_saved", label: "Elf. gehalten" },
  { key: "penalties_conceded", label: "Elf. verursacht" },
  { key: "yellow_cards", label: "Gelb" },
  { key: "red_cards", label: "Rot" },
  { key: "own_goals", label: "Eigentore" },
] as const;

export default async function GameweekDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gameweekId = Number(id);
  const supabase = await createClient();

  const [{ data: gameweek }, { data: stats }, { data: overrides }, { data: points }] = await Promise.all([
    supabase.from("gameweeks").select("*").eq("id", gameweekId).single(),
    supabase.from("player_stats").select("*, players(first_name, last_name, position)").eq("gameweek_id", gameweekId),
    supabase.from("player_stats_overrides").select("*").eq("gameweek_id", gameweekId),
    supabase.from("fantasy_points").select("player_id, points").eq("gameweek_id", gameweekId),
  ]);

  if (!gameweek) return <p>Spieltag nicht gefunden.</p>;

  const overrideByPlayer = new Map((overrides ?? []).map((o) => [o.player_id, o]));
  const pointsByPlayer = new Map((points ?? []).map((p) => [p.player_id, p.points]));

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Spieltag {gameweek.number} — Daten korrigieren</h1>
        <form action={recomputeGameweek.bind(null, gameweekId)}>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 text-sm">
            Alle Punkte neu berechnen
          </button>
        </form>
      </div>

      <p className="mb-4 text-sm text-zinc-500">
        Ein ausgefülltes Feld überschreibt den synchronisierten API-Wert dauerhaft. Leer lassen, um
        beim automatischen Wert zu bleiben. Eigentore kommen nie aus der API-Synchronisation — hier eintragen.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500">
              <th className="py-2 pr-2">Spieler</th>
              <th className="py-2 pr-2">Punkte</th>
              {FIELDS.map((f) => (
                <th key={f.key} className="py-2 pr-2">
                  {f.label}
                </th>
              ))}
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(stats ?? []).map((row) => {
              const player = Array.isArray(row.players) ? row.players[0] : row.players;
              const override = overrideByPlayer.get(row.player_id);
              return (
                <tr key={row.player_id} className="border-b border-zinc-100">
                  <td className="py-2 pr-2 font-medium">
                    {player?.first_name} {player?.last_name}
                    <div className="font-normal text-zinc-400">{player?.position}</div>
                  </td>
                  <td className="py-2 pr-2 font-medium tabular-nums">
                    {pointsByPlayer.get(row.player_id) ?? "—"}
                  </td>
                  <FormCells
                    gameweekId={gameweekId}
                    playerId={row.player_id}
                    synced={row}
                    override={override}
                  />
                </tr>
              );
            })}
            {(!stats || stats.length === 0) && (
              <tr>
                <td colSpan={FIELDS.length + 3} className="py-6 text-center text-zinc-500">
                  Noch keine synchronisierten Daten für diesen Spieltag. Läuft der Cron-Sync
                  (<code>/api/cron/sync</code>) schon?
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// One <form> per row so each save button only touches its own player.
function FormCells({
  gameweekId,
  playerId,
  synced,
  override,
}: {
  gameweekId: number;
  playerId: number;
  synced: Record<string, unknown>;
  override: Record<string, unknown> | undefined;
}) {
  return (
    <>
      {FIELDS.map((f) => (
        <td key={f.key} className="py-2 pr-2">
          <input
            form={`override-${playerId}`}
            name={f.key}
            type="number"
            defaultValue={(override?.[f.key] as number | null | undefined) ?? undefined}
            placeholder={String(synced[f.key] ?? 0)}
            className="w-16 rounded border border-zinc-300 px-1 py-0.5"
          />
        </td>
      ))}
      <td className="py-2">
        <form id={`override-${playerId}`} action={saveStatOverride} className="flex items-center gap-2">
          <input type="hidden" name="playerId" value={playerId} />
          <input type="hidden" name="gameweekId" value={gameweekId} />
          <button type="submit" className="rounded bg-black px-2 py-1 text-white">
            Speichern
          </button>
        </form>
      </td>
    </>
  );
}
