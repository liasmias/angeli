import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveAnnouncement, toggleGameweekLock } from "./actions";
import SyncStatus from "./SyncStatus";

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: gameweeks }, { data: settings }] = await Promise.all([
    supabase
      .from("gameweeks")
      .select("id, number, deadline, is_locked")
      .order("number", { ascending: true }),
    supabase.from("league_settings").select("*").eq("id", 1).maybeSingle(),
  ]);

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Admin</h1>

      <SyncStatus
        lastSyncAt={settings?.last_sync_at ?? null}
        lastSyncNote={settings?.last_sync_note ?? null}
      />

      {/* Ankündigung: erscheint bei allen Mitgliedern als Banner unter der
          Navigation. Leer speichern blendet sie wieder aus. */}
      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-bold text-brand-deep">Ankündigung an alle</h2>
        <p className="mb-3 text-xs text-brand-deep/60">
          Erscheint als Banner auf jeder Seite — z.&nbsp;B. „Punkte von Spieltag 3 werden heute
          Abend korrigiert". Leer speichern entfernt den Banner.
        </p>
        <form action={saveAnnouncement} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <textarea
            name="announcement"
            defaultValue={settings?.announcement ?? ""}
            rows={2}
            maxLength={300}
            className="flex-1 rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta"
          />
          <button
            type="submit"
            className="pressable rounded-full bg-brand-deep px-5 py-2 text-sm font-bold text-brand-accent"
          >
            Speichern
          </button>
        </form>
      </section>
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/players"
          className="pressable inline-block rounded-full bg-brand-deep px-5 py-2 text-sm font-bold text-brand-accent"
        >
          Spieler & Preise verwalten →
        </Link>
        <Link
          href="/admin/users"
          className="pressable inline-block rounded-full bg-brand-deep px-5 py-2 text-sm font-bold text-brand-accent"
        >
          Mitglieder verwalten →
        </Link>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500">
            <th className="py-2">Spieltag</th>
            <th className="py-2">Deadline</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(gameweeks ?? []).map((gw) => (
            <tr key={gw.id} className="border-b border-zinc-100">
              <td className="py-2">
                <Link href={`/admin/gameweeks/${gw.id}`} className="underline">
                  Spieltag {gw.number}
                </Link>
              </td>
              <td className="py-2">{new Date(gw.deadline).toLocaleString("de-CH", { timeZone: "Europe/Zurich" })}</td>
              <td className="py-2">{gw.is_locked ? "gesperrt" : "offen"}</td>
              <td className="py-2 text-right">
                <form action={toggleGameweekLock.bind(null, gw.id, !gw.is_locked)}>
                  <button type="submit" className="rounded border border-zinc-300 px-2 py-1">
                    {gw.is_locked ? "Entsperren" : "Sperren"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {(!gameweeks || gameweeks.length === 0) && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-zinc-500">
                Noch keine Spieltage angelegt. Trage sie über die Supabase-Tabelle{" "}
                <code>gameweeks</code> ein (Nummer, Season, Deadline).
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
