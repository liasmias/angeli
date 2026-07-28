"use client";

import { useActionState } from "react";
import Turnstile from "@/components/turnstile";
import { changePassword, changeUsername, deleteAccount, type ProfilState } from "./actions";
import { getDictionary, type Lang } from "@/lib/i18n";

function Meldung({ state }: { state: ProfilState }) {
  if (state?.error) {
    return (
      <p className="rounded-lg bg-brand-danger/10 px-3 py-2 text-sm font-semibold text-brand-danger">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
        {state.message}
      </p>
    );
  }
  return null;
}

const feld =
  "rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta";

export function UsernameFormular({ lang, aktuell }: { lang: Lang; aktuell: string }) {
  const t = getDictionary(lang).profil;
  const [state, action, pending] = useActionState(changeUsername, undefined);
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-brand-deep">{t.usernameTitle}</h2>
      <p className="mb-4 text-sm text-brand-deep/60">
        {t.usernameHint}
      </p>
      <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <input
          name="username"
          defaultValue={aktuell}
          required
          minLength={3}
          maxLength={20}
          className={`${feld} flex-1`}
        />
        <button
          type="submit"
          disabled={pending}
          className="pressable rounded-full bg-brand-deep px-5 py-2 text-sm font-bold text-brand-accent disabled:opacity-50"
        >
          {pending ? t.saving : t.save}
        </button>
      </form>
      <div className="mt-3">
        <Meldung state={state} />
      </div>
    </section>
  );
}

export function PasswortFormular({ lang }: { lang: Lang }) {
  const t = getDictionary(lang).profil;
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-brand-deep">{t.passwordTitle}</h2>
      <p className="mb-4 text-sm text-brand-deep/60">
        {t.passwordHint}
      </p>
      <form action={action} className="flex flex-col gap-3">
        <input
          name="current"
          type="password"
          placeholder={t.currentPassword}
          required
          autoComplete="current-password"
          className={feld}
        />
        <input
          name="password"
          type="password"
          placeholder={t.newPassword}
          required
          minLength={8}
          autoComplete="new-password"
          className={feld}
        />
        <input
          name="password2"
          type="password"
          placeholder={t.repeatPassword}
          required
          minLength={8}
          autoComplete="new-password"
          className={feld}
        />
        {/* Die Prüfung des aktuellen Passworts ist ein echter Login und
            unterliegt damit dem Bot-Schutz — das Token muss mit. */}
        <Turnstile resetSignal={state} />
        <Meldung state={state} />
        <button
          type="submit"
          disabled={pending}
          className="pressable self-start rounded-full bg-brand-deep px-5 py-2 text-sm font-bold text-brand-accent disabled:opacity-50"
        >
          {pending ? t.saving : t.passwordTitle}
        </button>
      </form>
    </section>
  );
}

export function LoeschenFormular({ lang, username }: { lang: Lang; username: string }) {
  const t = getDictionary(lang).profil;
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <section className="rounded-xl border-2 border-brand-danger/20 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-brand-danger">{t.deleteTitle}</h2>
      <p className="mb-4 text-sm text-brand-deep/60">
        {t.deleteHint}
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-brand-danger">
          {t.deleteOpen}
        </summary>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <label className="text-sm text-brand-deep/70">
            {t.deleteConfirmPre} <span className="font-bold text-brand-deep">{username}</span> {t.deleteConfirmPost}
          </label>
          <input name="confirm" placeholder={username} required className={feld} autoComplete="off" />
          <Meldung state={state} />
          <button
            type="submit"
            disabled={pending}
            className="pressable self-start rounded-full bg-brand-danger px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? t.deleting : t.deleteButton}
          </button>
        </form>
      </details>
    </section>
  );
}
