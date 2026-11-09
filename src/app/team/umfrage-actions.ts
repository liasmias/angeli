"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UMFRAGE_ANTWORTEN, type UmfrageAntwort } from "@/lib/umfrage";

/**
 * Eine Stimme pro Konto: Der Primärschlüssel auf user_id lehnt eine zweite
 * Stimme ab, auch wenn jemand die Aktion direkt aufruft. Die Auszählung ist
 * bewusst keine Aktion hier — sie wäre sonst für jeden abrufbar und gehört
 * nur in den Admin-Bereich (lib/umfrage.ts).
 */
export async function abstimmen(antwort: UmfrageAntwort): Promise<{ ok?: true; error?: string }> {
  if (!UMFRAGE_ANTWORTEN.includes(antwort)) return { error: "Ungültige Antwort." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht eingeloggt." };

  const { error } = await createAdminClient()
    .from("umfrage_geraet")
    .insert({ user_id: user.id, antwort });
  if (error && error.code !== "23505") return { error: "Stimme konnte nicht gespeichert werden." };
  return { ok: true };
}
