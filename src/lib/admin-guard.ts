import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Wirft, wenn der eingeloggte User kein Admin ist; gibt sonst Client + User zurück. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht eingeloggt.");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Keine Admin-Rechte.");

  return { supabase, user };
}
