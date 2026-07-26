"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <main className="brand-gradient-hero flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-2xl font-black tracking-tight text-brand-deep">
          Konto erstellen
        </h1>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="username"
            type="text"
            placeholder="Accountname"
            required
            minLength={3}
            maxLength={20}
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          <input
            name="email"
            type="email"
            placeholder="E-Mail"
            required
            autoComplete="email"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          <input
            name="password"
            type="password"
            placeholder="Passwort (mind. 8 Zeichen)"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          {state?.error && (
            <p className="rounded-lg bg-brand-pink/10 px-3 py-2 text-sm font-semibold text-brand-pink">
              {state.error}
            </p>
          )}
          {state?.message && (
            <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
              {state.message}
            </p>
          )}
          <button
            disabled={pending}
            type="submit"
            className="pressable mt-1 rounded-full bg-brand-green px-3 py-2.5 font-bold text-brand-deep disabled:opacity-50"
          >
            {pending ? "Wird erstellt…" : "Registrieren"}
          </button>
        </form>
        <p className="mt-5 text-sm text-brand-deep/60">
          Schon ein Konto?{" "}
          <Link href="/login" className="font-semibold text-brand-magenta underline">
            Einloggen
          </Link>
        </p>
      </div>
    </main>
  );
}
