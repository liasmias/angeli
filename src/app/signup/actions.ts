"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { usernameMuster } from "@/lib/username";

export type SignupState = { error?: string; message?: string } | undefined;

export async function signup(_prevState: SignupState, formData: FormData): Promise<SignupState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    return { error: "Accountname: 3-20 Zeichen, nur Buchstaben/Zahlen/_/-." };
  }
  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }
  if (password.length < 8) {
    return { error: "Passwort muss mindestens 8 Zeichen haben." };
  }

  // Von Turnstile injiziertes Feld; leer, wenn CAPTCHA nicht aktiv ist.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  const supabase = await createClient();

  // Ohne diese Prüfung scheitert der Profil-Trigger am eindeutigen Index auf
  // lower(username) mit einer unverständlichen Datenbankmeldung.
  const { data: belegt } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", usernameMuster(username))
    .limit(1);
  if (belegt && belegt.length > 0) {
    return { error: "Dieser Accountname ist bereits vergeben." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username }, ...(captchaToken ? { captchaToken } : {}) },
  });

  if (error) {
    if (error.message.toLowerCase().includes("captcha")) {
      return { error: "Bot-Schutz nicht bestanden — bitte Seite neu laden und erneut versuchen." };
    }
    return { error: error.message.includes("already registered") ? "Diese E-Mail ist bereits registriert." : error.message };
  }

  // If Supabase email confirmation is enabled, there's no session yet.
  if (!data.session) {
    return { message: "Konto erstellt! Bitte bestätige deine E-Mail-Adresse, dann kannst du dich einloggen." };
  }

  redirect("/team");
}
