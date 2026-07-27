"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string } | undefined;

export async function login(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-Mail und Passwort sind erforderlich." };
  }

  // Von Turnstile injiziertes Feld; leer, wenn CAPTCHA nicht aktiv ist.
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (error) {
    const meldung = error.message.toLowerCase();
    if (meldung.includes("captcha")) {
      return { error: "Bot-Schutz nicht bestanden — bitte Seite neu laden und erneut versuchen." };
    }
    // Supabase drosselt nach mehreren Fehlversuchen. Das als "Passwort falsch"
    // auszugeben, schickt Leute auf die falsche Fährte — sie tippen dann
    // immer wieder ein korrektes Passwort ein und verlängern die Sperre.
    if (meldung.includes("rate limit") || meldung.includes("too many") || error.status === 429) {
      return {
        error:
          "Zu viele Versuche in kurzer Zeit. Bitte ein paar Minuten warten und es dann erneut versuchen.",
      };
    }
    return { error: "E-Mail oder Passwort ist falsch." };
  }

  redirect("/team");
}
