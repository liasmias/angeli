import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoeschenFormular, MeldungFormular, PasswortFormular, UsernameFormular } from "./ProfilFormulare";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";

export default async function ProfilPage() {
  const supabase = await createClient();
  const lang = await getLang();
  const t = getDictionary(lang).profil;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profiles")
    .select("username, role, created_at")
    .eq("id", user.id)
    .single();

  // reports ist per RLS gesperrt — Zugriff nur ueber die Service-Role, hier
  // eng auf die eigenen Meldungen begrenzt.
  const { data: meldungen } = await createAdminClient()
    .from("reports")
    .select("id, message, created_at, resolved_at, reply, replied_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">{t.title}</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        {user.email}
        {profil?.created_at &&
          t.memberSince(new Date(profil.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "de-CH", { timeZone: "Europe/Zurich" }))}
        {profil?.role === "admin" && (
          <span className="ml-2 rounded-full bg-brand-deep px-2 py-0.5 text-[10px] font-bold text-brand-accent">
            Admin
          </span>
        )}
      </p>

      <div className="flex flex-col gap-4">
        <UsernameFormular lang={lang} aktuell={profil?.username ?? ""} />
        <MeldungFormular lang={lang} />

        {/* Eigene Meldungen samt Antwort. Bisher verschwand eine Meldung nach
            dem Absenden spurlos — wer schrieb, erfuhr nie, was daraus wurde. */}
        {(meldungen ?? []).length > 0 && (
          <section className="chamfer bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-brand-deep">{t.myReports}</h2>
            <ul className="divide-y divide-brand-deep/5">
              {(meldungen ?? []).map((m) => (
                <li key={m.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-[11px] font-semibold text-brand-deep/50">
                    {new Date(m.created_at).toLocaleString(lang === "en" ? "en-GB" : "de-CH", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      timeZone: "Europe/Zurich",
                    })}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        m.resolved_at
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {m.resolved_at ? t.reportDone : t.reportOpen}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-brand-deep/80">{m.message}</p>
                  {m.reply ? (
                    <div className="mt-2 rounded-xl bg-brand-deep/5 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-deep/45">
                        {t.reportAnswer}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-brand-deep">{m.reply}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-brand-deep/40">{t.reportNoReply}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        <PasswortFormular lang={lang} />
        {profil?.role !== "admin" && <LoeschenFormular lang={lang} username={profil?.username ?? ""} />}
      </div>
    </main>
  );
}
