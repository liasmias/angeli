"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChipName } from "@/lib/database.types";

export type ChipResult = { error?: string; message?: string };

const CHIP_LABEL: Record<ChipName, string> = {
  wildcard: "Wildcard",
  bench_boost: "Bench Boost",
};

/** Gemeinsame Vorarbeit: eingeloggter Kader + aktuell offener Spieltag. */
async function context() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." as const };

  // Nach der Authentifizierung Service-Role-Client: normale Clients dürfen
  // chip_usages per RLS nicht mehr schreiben, damit sich der Chip-Einsatz
  // nicht per Direkt-Request an die REST-API manipulieren lässt.
  const supabase = createAdminClient();

  const { data: squad } = await supabase.from("squads").select("id").eq("user_id", user.id).single();
  if (!squad) return { error: "Kein Kader gefunden." as const };

  // Chips gelten immer für den nächsten Spieltag, dessen Deadline noch offen ist.
  const { data: gameweek } = await supabase
    .from("gameweeks")
    .select("id, number")
    .eq("is_locked", false)
    .gt("deadline", new Date().toISOString())
    .order("number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!gameweek) return { error: "Kein offener Spieltag — die Deadline ist abgelaufen." as const };

  return { supabase, squadId: squad.id, gameweek };
}

export async function activateChip(chip: ChipName): Promise<ChipResult> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, squadId, gameweek } = ctx;

  const { data: existing } = await supabase
    .from("chip_usages")
    .select("gameweek_id, gameweeks(number, deadline)")
    .eq("squad_id", squadId)
    .eq("chip", chip)
    .maybeSingle();

  if (existing) {
    const gw = Array.isArray(existing.gameweeks) ? existing.gameweeks[0] : existing.gameweeks;
    return existing.gameweek_id === gameweek.id
      ? { message: `${CHIP_LABEL[chip]} ist für Spieltag ${gameweek.number} bereits aktiv.` }
      : { error: `${CHIP_LABEL[chip]} wurde diese Saison schon an Spieltag ${gw?.number} eingesetzt.` };
  }

  const { error } = await supabase
    .from("chip_usages")
    .insert({ squad_id: squadId, chip, gameweek_id: gameweek.id });
  // Die unique-Bedingung ist die eigentliche Absicherung gegen Doppeleinsatz
  // (z. B. bei zwei gleichzeitigen Klicks).
  if (error) return { error: `${CHIP_LABEL[chip]} wurde diese Saison bereits eingesetzt.` };

  revalidatePath("/team");
  return { message: `${CHIP_LABEL[chip]} für Spieltag ${gameweek.number} aktiviert.` };
}

export async function deactivateChip(chip: ChipName): Promise<ChipResult> {
  const ctx = await context();
  if ("error" in ctx) return { error: ctx.error };
  const { supabase, squadId, gameweek } = ctx;

  // Nur zurücknehmbar, solange der Spieltag noch offen ist — ein bereits
  // gespielter Chip bleibt verbraucht.
  const { data: row } = await supabase
    .from("chip_usages")
    .select("id, gameweek_id")
    .eq("squad_id", squadId)
    .eq("chip", chip)
    .maybeSingle();
  if (!row) return { error: `${CHIP_LABEL[chip]} ist nicht aktiv.` };
  if (row.gameweek_id !== gameweek.id) {
    return { error: `${CHIP_LABEL[chip]} lief an einem bereits abgeschlossenen Spieltag.` };
  }

  await supabase.from("chip_usages").delete().eq("id", row.id);
  revalidatePath("/team");
  return { message: `${CHIP_LABEL[chip]} wieder freigegeben.` };
}
