import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { setUserBlocked } from "./actions";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  // Service-Role-Client: die profiles-Tabelle ist für normale Clients
  // absichtlich schreibgeschützt, und wir wollen alle Accounts sehen.
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, role, created_at, is_blocked")
    .order("created_at", { ascending: false });

  const total = profiles?.length ?? 0;
  const blocked = (profiles ?? []).filter((p) => p.is_blocked).length;

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Mitglieder</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        {total} Account{total === 1 ? "" : "s"}
        {blocked > 0 && ` · ${blocked} gesperrt`}. Gesperrte Accounts können sich nicht mehr
        einloggen und erscheinen nicht in der Rangliste. Die Sperre ist jederzeit umkehrbar.
      </p>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-brand-deep/10 text-left text-xs font-bold uppercase tracking-wide text-brand-deep/50">
              <th className="px-4 py-2">Accountname</th>
              <th className="px-4 py-2">Registriert</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-deep/5">
            {(profiles ?? []).map((p) => {
              const isSelf = p.id === me?.id;
              const isAdmin = p.role === "admin";
              return (
                <tr key={p.id} className={p.is_blocked ? "bg-brand-pink/5" : ""}>
                  <td className="px-4 py-2 font-semibold text-brand-deep">
                    {p.username}
                    {isAdmin && (
                      <span className="ml-2 rounded-full bg-brand-deep px-2 py-0.5 text-[10px] font-bold text-brand-green">
                        Admin
                      </span>
                    )}
                    {isSelf && <span className="ml-2 text-xs text-brand-deep/40">(du)</span>}
                  </td>
                  <td className="px-4 py-2 text-brand-deep/60">
                    {new Date(p.created_at).toLocaleDateString("de-CH")}
                  </td>
                  <td className="px-4 py-2">
                    {p.is_blocked ? (
                      <span className="font-bold text-brand-pink">gesperrt</span>
                    ) : (
                      <span className="text-brand-deep/60">aktiv</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isSelf || isAdmin ? (
                      <span className="text-xs text-brand-deep/30">—</span>
                    ) : (
                      <form action={setUserBlocked.bind(null, p.id, !p.is_blocked)}>
                        <button
                          type="submit"
                          className={`pressable rounded-full px-3 py-1 text-xs font-bold ${
                            p.is_blocked
                              ? "bg-brand-green text-brand-deep"
                              : "bg-brand-pink text-white"
                          }`}
                        >
                          {p.is_blocked ? "Entsperren" : "Sperren"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {total === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-brand-deep/50">
                  Noch keine Mitglieder registriert.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
