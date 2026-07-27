"use client";

import { useActionState } from "react";
import Link from "next/link";
import Turnstile from "@/components/turnstile";
import { requestPasswordReset } from "./actions";

export default function PasswortVergessenPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, undefined);

  return (
    <main className="brand-gradient-hero flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-brand-deep">
          Passwort vergessen
        </h1>
        <p className="mb-6 text-sm text-brand-deep/60">
          Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link, mit dem du ein neues
          Passwort setzen kannst.
        </p>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            placeholder="E-Mail"
            required
            autoComplete="email"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          {state?.error && (
            <p className="rounded-lg bg-brand-danger/10 px-3 py-2 text-sm font-semibold text-brand-danger">
              {state.error}
            </p>
          )}
          {state?.message && (
            <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
              {state.message}
            </p>
          )}
          <Turnstile />
          <button
            disabled={pending}
            type="submit"
            className="pressable mt-1 rounded-full bg-brand-accent px-3 py-2.5 font-bold text-brand-deep disabled:opacity-50"
          >
            {pending ? "Wird gesendet…" : "Link anfordern"}
          </button>
        </form>
        <p className="mt-5 text-sm text-brand-deep/60">
          <Link href="/login" className="font-semibold text-brand-magenta underline">
            Zurück zum Login
          </Link>
        </p>
      </div>
    </main>
  );
}
