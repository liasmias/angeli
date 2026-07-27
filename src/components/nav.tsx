import Link from "next/link";
import Logo from "@/components/logo";
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
      {/* Auf dem Handy bewusst kompakt: Die Navigation belegte sonst mit
          drei Zeilen ein Sechstel des Bildschirms. */}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:justify-between sm:gap-x-4 sm:gap-y-2 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="mr-auto flex shrink-0 items-center gap-2 whitespace-nowrap sm:mr-0 sm:gap-2.5"
        >
          <Logo className="h-6 w-6 shrink-0 text-brand-accent sm:h-8 sm:w-8" />
          <span className="leading-none">
            <span className="block text-base font-bold tracking-tight sm:text-xl">Angeli</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 sm:block">
              Swiss League Fantasy
            </span>
          </span>
        </Link>
        {/* `contents` auf dem Handy: Die Links werden dadurch zu direkten
            Geschwistern des Logos und fliessen einzeln um, statt als ganzer
            Block auf eine eigene Zeile zu springen. Ab `sm` wieder ein
            eigener Block, damit sie rechts gebündelt stehen. */}
        <div className="contents text-[13px] font-medium sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2 sm:text-sm [&_a]:whitespace-nowrap">
          <Link href="/fixtures" className="transition-colors hover:text-brand-accent">
            Spielplan
          </Link>
          <Link href="/stats" className="transition-colors hover:text-brand-accent">
            Statistiken
          </Link>
          <Link href="/regeln" className="transition-colors hover:text-brand-accent">
            Regeln
          </Link>
          {user ? (
            <>
              <Link href="/team" className="transition-colors hover:text-brand-accent">
                Mein Team
              </Link>
              <Link href="/leaderboard" className="transition-colors hover:text-brand-accent">
                Rangliste
              </Link>
              {isAdmin && (
                <Link href="/admin" className="transition-colors hover:text-brand-accent">
                  Admin
                </Link>
              )}
              <Link
                href="/profil"
                title="Mein Konto"
                className="pressable rounded-full bg-white/10 px-3 py-1 text-white/90 hover:bg-white/20 hover:text-brand-accent"
              >
                {username}
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="pressable rounded-full border border-white/30 px-3 py-1 hover:border-brand-accent hover:text-brand-accent"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="transition-colors hover:text-brand-accent">
                Login
              </Link>
              <Link
                href="/signup"
                className="pressable rounded-full bg-brand-accent px-4 py-1.5 font-semibold text-brand-deep"
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
