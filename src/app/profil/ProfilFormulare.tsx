"use client";

import { useActionState } from "react";
import { changePassword, changeUsername, deleteAccount, type ProfilState } from "./actions";

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

export function UsernameFormular({ aktuell }: { aktuell: string }) {
  const [state, action, pending] = useActionState(changeUsername, undefined);
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-brand-deep">Accountname</h2>
      <p className="mb-4 text-sm text-brand-deep/60">
        So erscheinst du in der Rangliste. Jeder Name kann nur einmal vergeben werden.
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
          {pending ? "Speichert…" : "Speichern"}
        </button>
      </form>
      <div className="mt-3">
        <Meldung state={state} />
      </div>
    </section>
  );
}

export function PasswortFormular() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-brand-deep">Passwort ändern</h2>
      <p className="mb-4 text-sm text-brand-deep/60">
        Zur Sicherheit brauchen wir zuerst dein aktuelles Passwort.
      </p>
      <form action={action} className="flex flex-col gap-3">
        <input
          name="current"
          type="password"
          placeholder="Aktuelles Passwort"
          required
          autoComplete="current-password"
          className={feld}
        />
        <input
          name="password"
          type="password"
          placeholder="Neues Passwort (mind. 8 Zeichen)"
          required
          minLength={8}
          autoComplete="new-password"
          className={feld}
        />
        <input
          name="password2"
          type="password"
          placeholder="Neues Passwort wiederholen"
          required
          minLength={8}
          autoComplete="new-password"
          className={feld}
        />
        <Meldung state={state} />
        <button
          type="submit"
          disabled={pending}
          className="pressable self-start rounded-full bg-brand-deep px-5 py-2 text-sm font-bold text-brand-accent disabled:opacity-50"
        >
          {pending ? "Speichert…" : "Passwort ändern"}
        </button>
      </form>
    </section>
  );
}

export function LoeschenFormular({ username }: { username: string }) {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  return (
    <section className="rounded-xl border-2 border-brand-danger/20 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-brand-danger">Konto löschen</h2>
      <p className="mb-4 text-sm text-brand-deep/60">
        Entfernt dein Konto samt Kader, Aufstellungen und Punkten — endgültig und nicht
        wiederherstellbar. Du verschwindest damit auch aus der Rangliste.
      </p>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-brand-danger">
          Ich möchte mein Konto löschen
        </summary>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <label className="text-sm text-brand-deep/70">
            Tippe zur Bestätigung <span className="font-bold text-brand-deep">{username}</span> ein:
          </label>
          <input name="confirm" placeholder={username} required className={feld} autoComplete="off" />
          <Meldung state={state} />
          <button
            type="submit"
            disabled={pending}
            className="pressable self-start rounded-full bg-brand-danger px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {pending ? "Wird gelöscht…" : "Konto endgültig löschen"}
          </button>
        </form>
      </details>
    </section>
  );
}
