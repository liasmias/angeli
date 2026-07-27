"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ResetState = { error?: string; message?: string } | undefined;

export async function requestPasswordReset(
  _prevState: ResetState,
  formData: FormData
): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Bitte E-Mail-Adresse eingeben." };

  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  // Ziel-URL aus dem Request ableiten, damit sie lokal wie live stimmt.
  const h = await headers();
  const origin =
    h.get("origin") ??
    (h.get("host") ? `https://${h.get("host")}` : "https://angeli-fantasy.org");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/passwort-neu`,
    ...(captchaToken ? { captchaToken } : {}),
  });

  if (error && error.message.toLowerCase().includes("captcha")) {
    return { error: "Bot-Schutz nicht bestanden — bitte Seite neu laden." };
  }

  // Bewusst immer dieselbe Antwort, auch bei unbekannter Adresse: Sonst
  // liesse sich hier durchprobieren, wer bei uns ein Konto hat.
  return {
    message:
      "Falls ein Konto mit dieser Adresse existiert, ist eine E-Mail mit einem Link unterwegs. Schau auch im Spam-Ordner nach.",
  };
}
