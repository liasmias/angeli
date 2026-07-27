import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleGameweekLock } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: gameweeks } = await supabase
    .from("gameweeks")
    .select("id, number, deadline, is_locked")
    .order("number", { ascending: true });

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Admin</h1>
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
              <td className="py-2">{new Date(gw.deadline).toLocaleString("de-CH")}</td>
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
