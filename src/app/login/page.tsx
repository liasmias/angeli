"use client";

import { useActionState } from "react";
import Link from "next/link";
import Turnstile from "@/components/turnstile";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="brand-gradient-hero flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-brand-deep">Einloggen</h1>
        <form action={formAction} className="flex flex-col gap-3">
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
            placeholder="Passwort"
            required
            autoComplete="current-password"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          {state?.error && (
            <p className="rounded-lg bg-brand-danger/10 px-3 py-2 text-sm font-semibold text-brand-danger">
              {state.error}
            </p>
          )}
          <Turnstile resetSignal={state} />
          <button
            disabled={pending}
            type="submit"
            className="pressable mt-1 rounded-full bg-brand-accent px-3 py-2.5 font-bold text-brand-deep disabled:opacity-50"
          >
            {pending ? "Wird geprüft…" : "Einloggen"}
          </button>
        </form>
        <p className="mt-4 text-sm">
          <Link
            href="/passwort-vergessen"
            className="font-semibold text-brand-magenta underline"
          >
            Passwort vergessen?
          </Link>
        </p>
        <p className="mt-2 text-sm text-brand-deep/60">
          Noch kein Konto?{" "}
          <Link href="/signup" className="font-semibold text-brand-magenta underline">
            Registrieren
          </Link>
        </p>
      </div>
    </main>
  );
}
