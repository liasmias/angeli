import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Wirft, wenn der eingeloggte User kein Admin ist. Gibt sonst einen
 * Service-Role-Client zurück — die Admin-Aktionen schreiben darüber, sodass
 * die Spielstand-Tabellen für normale Clients per RLS komplett gesperrt
 * bleiben können.
 */
export async function requireAdmin() {
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt.");

  const { data: profile } = await auth.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Keine Admin-Rechte.");

  return { supabase: createAdminClient(), user };
}
