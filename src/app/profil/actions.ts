"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfilState = { error?: string; message?: string } | undefined;

async function eingeloggt() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function changeUsername(
  _prevState: ProfilState,
  formData: FormData
): Promise<ProfilState> {
  const { user } = await eingeloggt();
  if (!user) return { error: "Nicht eingeloggt." };

  const neu = String(formData.get("username") ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(neu)) {
    return { error: "Accountname: 3-20 Zeichen, nur Buchstaben, Zahlen, _ und -." };
  }

  const admin = createAdminClient();
  const { data: aktuell } = await admin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();
  if (aktuell?.username === neu) return { message: "Das ist bereits dein Accountname." };

  // Vorabprüfung für eine verständliche Meldung; die eigentliche Absicherung
  // ist die unique-Bedingung auf profiles.username (siehe Fehlerbehandlung).
  const { data: belegt } = await admin
    .from("profiles")
    .select("id")
    .eq("username", neu)
    .maybeSingle();
  if (belegt) return { error: "Dieser Accountname ist bereits vergeben." };

  const { error } = await admin.from("profiles").update({ username: neu }).eq("id", user.id);
  if (error) {
    return {
      error: error.code === "23505" ? "Dieser Accountname ist bereits vergeben." : error.message,
    };
  }

  revalidatePath("/profil");
  revalidatePath("/leaderboard");
  return { message: `Accountname geändert auf „${neu}".` };
}

export async function changePassword(
  _prevState: ProfilState,
  formData: FormData
): Promise<ProfilState> {
  const { supabase, user } = await eingeloggt();
  if (!user?.email) return { error: "Nicht eingeloggt." };

  const aktuell = String(formData.get("current") ?? "");
  const neu = String(formData.get("password") ?? "");
  const wiederholung = String(formData.get("password2") ?? "");

  if (neu.length < 8) return { error: "Neues Passwort muss mindestens 8 Zeichen haben." };
  if (neu !== wiederholung) return { error: "Die beiden neuen Passwörter stimmen nicht überein." };

  // Aktuelles Passwort prüfen: Sonst könnte jemand an einem offen gelassenen
  // Rechner das Passwort ändern und den Account übernehmen.
  //
  // Die Prüfung läuft über einen echten Login — und der unterliegt der
  // CAPTCHA-Pflicht. Deshalb muss das Formular ein Turnstile-Token
  // mitliefern, sonst scheitert die Prüfung selbst bei richtigem Passwort.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;
  const { error: loginFehler } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: aktuell,
    options: captchaToken ? { captchaToken } : undefined,
  });
  if (loginFehler) {
    return {
      error: loginFehler.message.toLowerCase().includes("captcha")
        ? "Bot-Schutz nicht bestanden — bitte Seite neu laden und erneut versuchen."
        : "Das aktuelle Passwort stimmt nicht.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: neu });
  if (error) return { error: error.message };

  return { message: "Passwort geändert." };
}

export async function deleteAccount(
  _prevState: ProfilState,
  formData: FormData
): Promise<ProfilState> {
  const { user } = await eingeloggt();
  if (!user) return { error: "Nicht eingeloggt." };

  const admin = createAdminClient();
  const { data: profil } = await admin
    .from("profiles")
    .select("username, role")
    .eq("id", user.id)
    .single();

  // Tippbestätigung: verhindert ein versehentliches Löschen per Fehlklick.
  const bestaetigung = String(formData.get("confirm") ?? "").trim();
  if (bestaetigung !== profil?.username) {
    return { error: `Zum Bestätigen bitte genau „${profil?.username}" eintippen.` };
  }
  if (profil?.role === "admin") {
    return { error: "Admin-Konten können sich nicht selbst löschen." };
  }

  // Cascade räumt Profil, Kader, Aufstellungen und Transfers mit ab.
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Löschen fehlgeschlagen: " + error.message };

  redirect("/");
}

/**
 * Meldung an die Admins — falsche Punkte, Gutschrift-Anfrage, Sonstiges.
 * Höchstens drei offene Meldungen pro Konto, damit niemand den Posteingang
 * fluten kann.
 */
export async function sendReport(
  _prevState: ProfilState,
  formData: FormData
): Promise<ProfilState> {
  const { user } = await eingeloggt();
  if (!user) return { error: "Nicht eingeloggt." };

  const message = String(formData.get("message") ?? "").trim();
  if (message.length < 5) return { error: "Bitte beschreibe dein Anliegen (mind. 5 Zeichen)." };
  if (message.length > 1000) return { error: "Bitte kürzer fassen (max. 1000 Zeichen)." };

  const admin = createAdminClient();
  const { count } = await admin
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("resolved_at", null);
  if ((count ?? 0) >= 3) {
    return { error: "Du hast bereits 3 offene Meldungen — bitte warte, bis sich ein Admin meldet." };
  }

  const { error } = await admin.from("reports").insert({ user_id: user.id, message });
  if (error) return { error: "Senden fehlgeschlagen: " + error.message };
  return { message: "Meldung gesendet — ein Admin schaut es sich an." };
}
