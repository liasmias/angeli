import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const UMFRAGE_ANTWORTEN = ["phone", "web", "both"] as const;
export type UmfrageAntwort = (typeof UMFRAGE_ANTWORTEN)[number];
export type UmfrageErgebnis = Record<UmfrageAntwort, number>;

/**
 * Auszählung der Geräte-Umfrage — nur für den Admin-Bereich. Die Tabelle ist
 * per RLS für Clients gesperrt; null, solange Migration 0029 fehlt.
 */
export async function umfrageErgebnis(): Promise<UmfrageErgebnis | null> {
  const { data, error } = await createAdminClient().from("umfrage_geraet").select("antwort");
  if (error) return null;
  const ergebnis: UmfrageErgebnis = { phone: 0, web: 0, both: 0 };
  for (const z of data ?? []) ergebnis[z.antwort]++;
  return ergebnis;
}

/** Hat dieses Konto schon abgestimmt? null, solange die Tabelle fehlt. */
export async function hatAbgestimmt(userId: string): Promise<boolean | null> {
  const { data, error } = await createAdminClient()
    .from("umfrage_geraet")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return !!data;
}
