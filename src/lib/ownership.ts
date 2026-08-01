import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Aufgestellt-Prozente: In wie vielen der gespeicherten Teams steckt ein
 * Spieler? Basis ist der lebende Kader (squad_players), wie bei FPL.
 *
 * Läuft bewusst über den Service-Schlüssel: Die einzelnen Kader sind vor der
 * Deadline privat (RLS), das Aggregat verrät aber nichts über einzelne Teams
 * — nur der fertige Prozentwert verlässt den Server.
 */
export async function getOwnershipPercent(): Promise<Map<number, number>> {
  const admin = createAdminClient();
  const { data } = await admin.from("squad_players").select("squad_id, player_id");
  const teams = new Set((data ?? []).map((r) => r.squad_id)).size;
  const proSpieler = new Map<number, number>();
  for (const r of data ?? []) {
    proSpieler.set(r.player_id, (proSpieler.get(r.player_id) ?? 0) + 1);
  }
  const prozent = new Map<number, number>();
  if (teams > 0) {
    for (const [playerId, anzahl] of proSpieler) {
      prozent.set(playerId, Math.round((anzahl / teams) * 100));
    }
  }
  return prozent;
}
