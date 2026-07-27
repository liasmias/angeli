"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type NeuesPasswortState = { error?: string } | undefined;

export async function setNewPassword(
  _prevState: NeuesPasswortState,
  formData: FormData
): Promise<NeuesPasswortState> {
  const password = String(formData.get("password") ?? "");
  const wiederholung = String(formData.get("password2") ?? "");

  if (password.length < 8) return { error: "Passwort muss mindestens 8 Zeichen haben." };
  if (password !== wiederholung) return { error: "Die beiden Passwörter stimmen nicht überein." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Ohne gültige Sitzung aus dem E-Mail-Link lässt sich hier nichts ändern.
  if (!user) return { error: "Der Link ist abgelaufen. Fordere einen neuen an." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/team");
}
