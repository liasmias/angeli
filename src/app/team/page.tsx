import { createClient } from "@/lib/supabase/server";
import { getTransferBudget } from "@/lib/transfers";
import TeamBuilder, { type PlayerOption, type SquadPick } from "./TeamBuilder";

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // proxy.ts already guards this route; this is just a defensive fallback.
    return <main className="p-6">Bitte einloggen.</main>;
  }

  const [{ data: settings }, { data: players }, { data: squad }, { data: nextGameweek }, { data: pointRows }] =
    await Promise.all([
      supabase.from("league_settings").select("*").eq("id", 1).single(),
      supabase
        .from("players")
        .select("id, first_name, last_name, position, price, is_active, clubs(name, short_name)")
        .eq("is_active", true)
        .order("position")
        .order("price", { ascending: false }),
      supabase.from("squads").select("id, free_transfers_remaining").eq("user_id", user.id).single(),
      supabase
        .from("gameweeks")
        .select("id, number, deadline, is_locked")
        .eq("is_locked", false)
        // Die Deadline ist die eigentliche Sperre — `is_locked` ist nur der
        // manuelle Admin-Override obendrauf.
        .gt("deadline", new Date().toISOString())
        .order("number", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase.from("fantasy_points").select("player_id, points"),
    ]);

  const totalPointsByPlayer = new Map<number, number>();
  for (const row of pointRows ?? []) {
    totalPointsByPlayer.set(row.player_id, (totalPointsByPlayer.get(row.player_id) ?? 0) + row.points);
  }

  if (!settings || !squad) {
    return <main className="p-6">Konnte Team-Daten nicht laden. Ist das Schema aufgesetzt?</main>;
  }

  const [{ data: squadPlayers }, { data: chipRows }] = await Promise.all([
    supabase
      .from("squad_players")
      .select("player_id, is_starting, is_captain, is_vice_captain, purchase_price")
      .eq("squad_id", squad.id),
    supabase
      .from("chip_usages")
      .select("chip, gameweek_id, gameweeks(number)")
      .eq("squad_id", squad.id),
  ]);

  // Aus der Transferhistorie hergeleitet (inkl. angesparter Transfers) —
  // nicht aus einem Zählerfeld, das beim Speichern überschrieben werden kann.
  const budget = nextGameweek
    ? await getTransferBudget(supabase, squad.id, nextGameweek, settings)
    : { freeAvailable: 0, usedThisGameweek: 0, bankedAtStart: 0 };

  const chipState = (["wildcard", "bench_boost"] as const).map((chip) => {
    const row = (chipRows ?? []).find((c) => c.chip === chip);
    const gw = row ? (Array.isArray(row.gameweeks) ? row.gameweeks[0] : row.gameweeks) : null;
    return {
      chip,
      activeNow: !!row && !!nextGameweek && row.gameweek_id === nextGameweek.id,
      usedInGameweek: row && (!nextGameweek || row.gameweek_id !== nextGameweek.id) ? (gw?.number ?? null) : null,
    };
  });

  const playerOptions: PlayerOption[] = (players ?? []).map((p) => {
    const club = Array.isArray(p.clubs) ? p.clubs[0] : p.clubs;
    return {
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      position: p.position,
      price: Number(p.price),
      club: club?.short_name ?? club?.name ?? "—",
      points: totalPointsByPlayer.get(p.id) ?? 0,
    };
  });

  const initialSquad: SquadPick[] = (squadPlayers ?? []).map((sp) => ({
    playerId: sp.player_id,
    isStarting: sp.is_starting,
    isCaptain: sp.is_captain,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-4 text-2xl font-black tracking-tight text-brand-deep">Mein Team</h1>
      {!nextGameweek && (
        <p className="mb-6 rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">
          Kein offener Spieltag gefunden — ein Admin muss zuerst Spieltage anlegen.
        </p>
      )}
      <TeamBuilder
        players={playerOptions}
        initialSquad={initialSquad}
        settings={{
          budgetCap: Number(settings.budget_cap),
          squadSize: settings.squad_size,
          startingSize: settings.starting_size,
          gkSlots: settings.gk_slots,
          defSlots: settings.def_slots,
          midSlots: settings.mid_slots,
          fwdSlots: settings.fwd_slots,
        }}
        gameweekOpen={!!nextGameweek}
        gameweekNumber={nextGameweek?.number ?? null}
        deadline={nextGameweek?.deadline ?? null}
        freeTransfers={budget.freeAvailable}
        transfersUsed={budget.usedThisGameweek}
        extraTransferCost={settings.extra_transfer_cost}
        chips={chipState}
      />
    </main>
  );
}
