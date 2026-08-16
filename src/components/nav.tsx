import Link from "next/link";
import Logo from "@/components/logo";
import MobileMenu, { type NavLink } from "@/components/mobile-menu";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/auth-actions";
import { toggleLang } from "@/lib/lang-actions";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";

export default async function Nav() {
  let username: string | null = null;
  let isAdmin = false;
  let user: { id: string } | null = null;

  // Abgesichert, weil die Navigation in jeder Antwort steckt — auch in der
  // 404-Seite. Wirft der Auth-Aufruf, etwa weil Supabase gerade drosselt,
  // würde daraus sonst ein 500. Im Zweifel die abgemeldete Ansicht zeigen:
  // Die geschützten Seiten prüfen ohnehin selbst nochmals.
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, role")
        .eq("id", user.id)
        .single();
      username = profile?.username ?? null;
      isAdmin = profile?.role === "admin";
    }
  } catch {
    user = null;
  }

  const lang = await getLang();
  const t = getDictionary(lang).nav;

  // Einmal definiert, von beiden Varianten genutzt — sonst driften die
  // Menüpunkte auf Handy und Desktop früher oder später auseinander.
  const links: NavLink[] = [
    { href: "/fixtures", label: t.fixtures },
    { href: "/stats", label: t.stats },
    { href: "/regeln", label: t.rules },
    { href: "/faq", label: t.faq },
    ...(user
      ? [
          { href: "/team", label: t.myTeam },
          { href: "/leaderboard", label: t.leaderboard },
          ...(isAdmin ? [{ href: "/admin", label: t.admin }] : []),
        ]
      : []),
  ];

  // Der Umschalter zeigt die Sprache an, ZU der gewechselt wird.
  const langSwitch = (
    <form action={toggleLang}>
      <button
        type="submit"
        title={lang === "de" ? "Switch to English" : "Auf Deutsch wechseln"}
        className="pressable rounded-full border border-white/30 px-2.5 py-1 text-xs font-bold uppercase tracking-wide hover:border-brand-accent hover:text-brand-accent"
      >
        {lang === "de" ? "EN" : "DE"}
      </button>
    </form>
  );

  return (
    <nav className="brand-gradient relative text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap sm:gap-2.5">
          <Logo className="h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8" />
          <span className="text-lg font-bold leading-none tracking-tight sm:text-xl">Angeli</span>
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
                title={t.account}
                className="pressable rounded-full bg-white/10 px-3 py-1 text-white/90 hover:bg-white/20 hover:text-brand-accent"
              >
                {username}
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="pressable rounded-full border border-white/30 px-3 py-1 hover:border-brand-accent hover:text-brand-accent"
                >
                  {t.logout}
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="transition-colors hover:text-brand-accent">
                {t.login}
              </Link>
              <Link
                href="/signup"
                className="pressable rounded-full bg-brand-accent px-4 py-1.5 font-semibold text-brand-deep"
              >
                {t.signup}
              </Link>
            </>
          )}
          {langSwitch}
        </div>

        <div className="flex items-center gap-1.5 sm:hidden">
          {langSwitch}
          <MobileMenu
            links={links}
            username={username}
            labels={{
              openMenu: t.openMenu,
              closeMenu: t.closeMenu,
              logout: t.logout,
              login: t.login,
              signup: t.signup,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
