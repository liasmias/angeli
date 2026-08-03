import { createClient } from "@/lib/supabase/server";
import PlayerAdminTable, { type AdminPlayerRow } from "./PlayerAdminTable";
import { createPlayer } from "./actions";

export default async function AdminPlayersPage() {
  const supabase = await createClient();

  const [{ data: players }, { data: clubs }] = await Promise.all([
    supabase
      .from("players")
      .select("id, first_name, last_name, position, price, is_active, flag, flag_note, club_id, clubs(name, short_name)")
      .order("last_name"),
    supabase.from("clubs").select("id, name").order("name"),
  ]);

  const rows: AdminPlayerRow[] = (players ?? []).map((p) => {
    const club = Array.isArray(p.clubs) ? p.clubs[0] : p.clubs;
    return {
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" "),
      firstName: p.first_name ?? "",
      lastName: p.last_name,
      position: p.position,
      price: Number(p.price),
      club: club?.short_name ?? club?.name ?? "—",
      clubId: p.club_id,
      isActive: p.is_active,
      flag: p.flag,
      flagNote: p.flag_note,
    };
  });

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">
        Spieler verwalten
      </h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        Preise anpassen, Spieler (de)aktivieren und Neuzugänge erfassen. Preisänderungen wirken
        sofort im Team-Builder; bereits gekaufte Spieler behalten ihren Kaufpreis.
      </p>

      <details className="mb-6 chamfer bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-bold text-brand-deep">
          + Neuen Spieler erfassen
        </summary>
        <form action={createPlayer} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            name="firstName"
            placeholder="Vorname (optional)"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta"
          />
          <input
            name="lastName"
            placeholder="Nachname"
            required
            className="rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta"
          />
          <select
            name="clubId"
            required
            className="rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta"
          >
            <option value="">Club wählen…</option>
            {(clubs ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            name="position"
            required
            className="rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta"
          >
            <option value="">Position wählen…</option>
            <option value="GK">Torhüter (GK)</option>
            <option value="DEF">Verteidiger (DEF)</option>
            <option value="MID">Mittelfeld (MID)</option>
            <option value="FWD">Sturm (FWD)</option>
          </select>
          <input
            name="price"
            type="number"
            step="0.1"
            min="0"
            placeholder="Preis, z. B. 5.0"
            required
            className="rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta"
          />
          <input
            name="apiFootballPlayerId"
            type="number"
            placeholder="API-Football-ID (optional, für Auto-Sync)"
            className="rounded-lg border border-brand-deep/15 px-3 py-2 text-sm outline-none focus:border-brand-magenta"
          />
          <button
            type="submit"
            className="pressable rounded-full bg-brand-accent px-5 py-2 font-bold text-brand-deep sm:col-span-2 sm:justify-self-start"
          >
            Spieler anlegen
          </button>
        </form>
      </details>

      <PlayerAdminTable rows={rows} clubs={clubs ?? []} />
    </>
  );
}
