import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
        <PasswortFormular lang={lang} />
        {profil?.role !== "admin" && <LoeschenFormular lang={lang} username={profil?.username ?? ""} />}
      </div>
    </main>
  );
}
