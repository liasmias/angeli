import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth-actions";

export default async function Nav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let isAdmin = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, role")
      .eq("id", user.id)
      .single();
    username = profile?.username ?? null;
    isAdmin = profile?.role === "admin";
  }

  return (
    <nav className="brand-gradient text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="rounded bg-brand-green px-1.5 py-0.5 text-sm font-black text-brand-deep">
            FSL
          </span>
          Fantasy Super League
        </Link>
        <div className="flex items-center gap-5 text-sm font-medium">
          <Link href="/fixtures" className="transition-colors hover:text-brand-green">
            Spielplan
          </Link>
          <Link href="/stats" className="transition-colors hover:text-brand-green">
            Statistiken
          </Link>
          {user ? (
            <>
              <Link href="/team" className="transition-colors hover:text-brand-green">
                Mein Team
              </Link>
              <Link href="/leaderboard" className="transition-colors hover:text-brand-green">
                Rangliste
              </Link>
              {isAdmin && (
                <Link href="/admin" className="transition-colors hover:text-brand-green">
                  Admin
                </Link>
              )}
              <span className="hidden rounded-full bg-white/10 px-3 py-1 text-white/90 sm:inline">
                {username}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="pressable rounded-full border border-white/30 px-3 py-1 hover:border-brand-green hover:text-brand-green"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="transition-colors hover:text-brand-green">
                Login
              </Link>
              <Link
                href="/signup"
                className="pressable rounded-full bg-brand-green px-4 py-1.5 font-semibold text-brand-deep"
              >
                Registrieren
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
