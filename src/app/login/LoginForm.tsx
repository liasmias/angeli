"use client";

import { useActionState } from "react";
import Link from "next/link";
import Turnstile from "@/components/turnstile";
import { login } from "./actions";
import { getDictionary, type Lang } from "@/lib/i18n";

export default function LoginForm({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).auth;
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="brand-gradient-hero flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm chamfer bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-brand-deep">{t.loginTitle}</h1>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            placeholder={t.email}
            required
            autoComplete="email"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
          <input
            name="password"
            type="password"
            placeholder={t.passwordPlain}
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
            {pending ? t.checking : t.login}
          </button>
        </form>
        <p className="mt-4 text-sm">
          <Link
            href="/passwort-vergessen"
            className="font-semibold text-brand-magenta underline"
          >
            {t.forgot}
          </Link>
        </p>
        <p className="mt-2 text-sm text-brand-deep/60">
          {t.noAccount}{" "}
          <Link href="/signup" className="font-semibold text-brand-magenta underline">
            {t.signup}
          </Link>
        </p>
      </div>
    </main>
  );
}
