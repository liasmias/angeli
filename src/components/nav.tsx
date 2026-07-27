import Link from "next/link";
import Logo from "@/components/logo";
import MobileMenu, { type NavLink } from "@/components/mobile-menu";
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

  // Einmal definiert, von beiden Varianten genutzt — sonst driften die
  // Menüpunkte auf Handy und Desktop früher oder später auseinander.
  const links: NavLink[] = [
    { href: "/fixtures", label: "Spielplan" },
    { href: "/stats", label: "Statistiken" },
    { href: "/regeln", label: "Regeln" },
    ...(user
      ? [
          { href: "/team", label: "Mein Team" },
          { href: "/leaderboard", label: "Rangliste" },
          ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
        ]
      : []),
  ];

  return (
    <nav className="brand-gradient relative text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap sm:gap-2.5">
          <Logo className="h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8" />
          <span className="leading-none">
            <span className="block text-lg font-bold tracking-tight sm:text-xl">Angeli</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60 sm:block">
              Swiss League Fantasy
            </span>
          </span>
        </Link>

        {/* Ab sm die vollständige Navigation, darunter das Burger-Menü. */}
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium sm:flex [&_a]:whitespace-nowrap">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-brand-accent">
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
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

        <MobileMenu links={links} username={username} />
      </div>
    </nav>
  );
}
