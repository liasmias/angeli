import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  addPointAdjustment,
  removePointAdjustment,
  setUserAdmin,
  setUserBlocked,
} from "./actions";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  // Service-Role-Client: die profiles-Tabelle ist für normale Clients
  // absichtlich schreibgeschützt, und wir wollen alle Accounts sehen.
  const admin = createAdminClient();
  const [{ data: profiles }, { data: squads }, { data: adjustments }, { data: standings }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, username, role, created_at, is_blocked")
        .order("created_at", { ascending: false }),
      admin.from("squads").select("id, user_id"),
      admin
        .from("point_adjustments")
        .select("id, squad_id, points, reason, created_at")
        .order("created_at", { ascending: false }),
      admin.from("standings").select("user_id, total_points"),
    ]);

  const squadByUser = new Map((squads ?? []).map((s) => [s.user_id, s.id]));
  const pointsByUser = new Map((standings ?? []).map((s) => [s.user_id, s.total_points]));
  const adjustmentsBySquad = new Map<number, typeof adjustments>();
  for (const a of adjustments ?? []) {
    adjustmentsBySquad.set(a.squad_id, [...(adjustmentsBySquad.get(a.squad_id) ?? []), a]);
  }

  const total = profiles?.length ?? 0;
  const blocked = (profiles ?? []).filter((p) => p.is_blocked).length;

  // Ligadurchschnitt: Grundlage für die Gutschrift an Nachzügler (siehe
  // Regelseite). Ohne diesen Wert müsste er von Hand ausgerechnet werden.
  const punktestaende = (standings ?? []).map((s) => s.total_points);
  const schnitt =
    punktestaende.length > 0
      ? Math.round(punktestaende.reduce((a, b) => a + b, 0) / punktestaende.length)
      : 0;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Mitglieder</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        {total} Account{total === 1 ? "" : "s"}
        {blocked > 0 && ` · ${blocked} gesperrt`}. Gesperrte Accounts können sich nicht mehr
        einloggen und erscheinen nicht in der Rangliste. Punkte lassen sich manuell gutschreiben
        oder abziehen — etwa als Startguthaben für Nachzügler.
      </p>

      <p className="mb-6 rounded-lg bg-brand-deep/5 px-4 py-3 text-sm text-brand-deep/70">
        <b className="text-brand-deep">Ligadurchschnitt: {schnitt} Punkte.</b> Laut Regelwerk
        erhalten Neuzugänge innerhalb der ersten 5 Runden diesen Wert gutgeschrieben — unten beim
        jeweiligen Konto eintragen.
      </p>

      <div className="flex flex-col gap-3">
        {(profiles ?? []).map((p) => {
          const isSelf = p.id === me?.id;
          const isAdmin = p.role === "admin";
          const squadId = squadByUser.get(p.id);
          const eigene = squadId ? (adjustmentsBySquad.get(squadId) ?? []) : [];
          const korrekturSumme = eigene.reduce((s, a) => s + a.points, 0);

          return (
            <section
              key={p.id}
              className={`rounded-xl p-4 shadow-sm ${p.is_blocked ? "bg-brand-danger/5" : "bg-white"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-brand-deep">{p.username}</span>
                  {isAdmin && (
                    <span className="ml-2 rounded-full bg-brand-deep px-2 py-0.5 text-[10px] font-bold text-brand-accent">
                      Admin
                    </span>
                  )}
                  {isSelf && <span className="ml-2 text-xs text-brand-deep/40">(du)</span>}
                  <span className="ml-2 text-xs text-brand-deep/50">
                    seit {new Date(p.created_at).toLocaleDateString("de-CH")}
                  </span>
                  <div className="mt-0.5 text-xs">
                    {p.is_blocked ? (
                      <span className="font-bold text-brand-danger">gesperrt</span>
                    ) : (
                      <span className="text-brand-deep/60">
                        {pointsByUser.get(p.id) ?? 0} Punkte in der Rangliste
                        {korrekturSumme !== 0 && (
                          <span className="ml-1 font-bold text-brand-magenta">
                            (davon {korrekturSumme > 0 ? "+" : ""}
                            {korrekturSumme} manuell)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Sich selbst kann niemand degradieren — sonst stünde die
                      Liga womöglich ohne Verwaltung da. */}
                  {!isSelf && !p.is_blocked && (
                    <form action={setUserAdmin.bind(null, p.id, !isAdmin)}>
                      <button
                        type="submit"
                        title={
                          isAdmin
                            ? "Admin-Rechte entziehen"
                            : "Zum Admin machen — darf Spieler, Punkte und Mitglieder verwalten"
                        }
                        className={`pressable rounded-full px-3 py-1 text-xs font-bold ${
                          isAdmin
                            ? "border border-brand-deep/20 text-brand-deep/70 hover:bg-brand-deep/5"
                            : "bg-brand-deep text-brand-accent"
                        }`}
                      >
                        {isAdmin ? "Admin entziehen" : "Zum Admin machen"}
                      </button>
                    </form>
                  )}

                  {!isSelf && !isAdmin && (
                    <form action={setUserBlocked.bind(null, p.id, !p.is_blocked)}>
                      <button
                        type="submit"
                        className={`pressable rounded-full px-3 py-1 text-xs font-bold ${
                          p.is_blocked
                            ? "bg-brand-accent text-brand-deep"
                            : "bg-brand-danger text-white"
                        }`}
                      >
                        {p.is_blocked ? "Entsperren" : "Sperren"}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {squadId && (
                <div className="mt-3 border-t border-brand-deep/5 pt-3">
                  <form
                    action={addPointAdjustment.bind(null, p.id)}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      name="points"
                      type="number"
                      step="1"
                      required
                      placeholder="± Punkte"
                      className="w-28 rounded-lg border border-brand-deep/15 px-2 py-1 text-sm tabular-nums outline-none focus:border-brand-magenta"
                    />
                    <input
                      name="reason"
                      type="text"
                      placeholder="Grund, z. B. Startguthaben Spieltag 5"
                      className="min-w-0 flex-1 rounded-lg border border-brand-deep/15 px-2 py-1 text-sm outline-none focus:border-brand-magenta"
                    />
                    <button
                      type="submit"
                      className="pressable rounded-full bg-brand-deep px-3 py-1 text-xs font-bold text-brand-accent"
                    >
                      Gutschreiben
                    </button>
                  </form>

                  {eigene.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {eigene.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center gap-2 text-xs text-brand-deep/70"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold tabular-nums ${
                              a.points >= 0
                                ? "bg-brand-accent/20 text-brand-deep"
                                : "bg-brand-danger/15 text-brand-danger"
                            }`}
                          >
                            {a.points > 0 ? "+" : ""}
                            {a.points}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            {a.reason || "ohne Begründung"}
                          </span>
                          <span className="text-brand-deep/40">
                            {new Date(a.created_at).toLocaleDateString("de-CH")}
                          </span>
                          <form action={removePointAdjustment.bind(null, a.id)}>
                            <button
                              type="submit"
                              title="Korrektur zurücknehmen"
                              className="pressable rounded px-1.5 py-0.5 font-bold text-brand-danger hover:bg-brand-danger hover:text-white"
                            >
                              ✕
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}
        {total === 0 && (
          <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-brand-deep/50 shadow-sm">
            Noch keine Mitglieder registriert.
          </p>
        )}
      </div>
    </>
  );
}
