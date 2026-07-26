"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });

  if (error) {
    return { error: error.message.includes("already registered") ? "Diese E-Mail ist bereits registriert." : error.message };
  }

  // If Supabase email confirmation is enabled, there's no session yet.
  if (!data.session) {
    return { message: "Konto erstellt! Bitte bestätige deine E-Mail-Adresse, dann kannst du dich einloggen." };
  }

  redirect("/team");
}
