"use client";

import { useActionState } from "react";
import Link from "next/link";
import Turnstile from "@/components/turnstile";
import { signup } from "./actions";
import { getDictionary, type Lang } from "@/lib/i18n";

export default function SignupForm({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).auth;
  const [state, formAction, pending] = useActionState(signup, undefined);

  return (
    <main className="brand-gradient-hero flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-brand-deep">
          {t.createAccount}
        </h1>
        <form action={formAction} className="flex flex-col gap-3">
          <input
            name="username"
            type="text"
            placeholder={t.accountName}
            required
            minLength={3}
            maxLength={20}
            className="rounded-lg border border-brand-deep/15 px-3 py-2 outline-none focus:border-brand-magenta"
          />
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
            placeholder={t.password}
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
          {state?.message && (
            <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
              {state.message}
            </p>
          )}
          <Turnstile resetSignal={state} />
          <button
            disabled={pending}
            type="submit"
            className="pressable mt-1 rounded-full bg-brand-accent px-3 py-2.5 font-bold text-brand-deep disabled:opacity-50"
          >
            {pending ? t.creating : t.signup}
          </button>
        </form>
        <p className="mt-5 text-sm text-brand-deep/60">
          {t.haveAccount}{" "}
          <Link href="/login" className="font-semibold text-brand-magenta underline">
            {t.login}
          </Link>
        </p>
      </div>
    </main>
  );
}
