import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoeschenFormular, PasswortFormular, UsernameFormular } from "./ProfilFormulare";

export default async function ProfilPage() {
  const supabase = await createClient();
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
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Mein Konto</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        {user.email}
        {profil?.created_at &&
          ` · dabei seit ${new Date(profil.created_at).toLocaleDateString("de-CH")}`}
        {profil?.role === "admin" && (
          <span className="ml-2 rounded-full bg-brand-deep px-2 py-0.5 text-[10px] font-bold text-brand-accent">
            Admin
          </span>
        )}
      </p>

      <div className="flex flex-col gap-4">
        <UsernameFormular aktuell={profil?.username ?? ""} />
        <PasswortFormular />
        {profil?.role !== "admin" && <LoeschenFormular username={profil?.username ?? ""} />}
      </div>
    </main>
  );
}
