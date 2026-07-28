"use client";

import { useActionState } from "react";
import Link from "next/link";
import { setNewPassword } from "./actions";

export default function PasswortNeuPage() {
  const [state, formAction, pending] = useActionState(setNewPassword, undefined);

  return (
    <main className="brand-gradient-hero flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm chamfer bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-brand-deep">Neues Passwort</h1>
        <p className="mb-6 text-sm text-brand-deep/60">
          Wähle ein neues Passwort. Danach bist du direkt eingeloggt.
        </p>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="password"
            type="password"
            placeholder="Neues Passwort (mind. 8 Zeichen)"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          <input
            name="password2"
            type="password"
            placeholder="Passwort wiederholen"
            required
            minLength={8}
            autoComplete="new-password"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          {state?.error && (
            <p className="rounded-lg bg-brand-danger/10 px-3 py-2 text-sm font-semibold text-brand-danger">
              {state.error}
            </p>
          )}
          <button
            disabled={pending}
            type="submit"
            className="pressable mt-1 rounded-full bg-brand-accent px-3 py-2.5 font-bold text-brand-deep disabled:opacity-50"
          >
            {pending ? "Wird gespeichert…" : "Passwort speichern"}
          </button>
        </form>
        <p className="mt-5 text-sm text-brand-deep/60">
          Link abgelaufen?{" "}
          <Link href="/passwort-vergessen" className="font-semibold text-brand-magenta underline">
            Neuen anfordern
          </Link>
        </p>
      </div>
    </main>
  );
}
