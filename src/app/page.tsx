import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";
import StartHinweis from "@/components/start-hinweis";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const lang = await getLang();
  const t = getDictionary(lang).home;

  return (
    <main className="flex-1">
      <section className="brand-gradient-hero relative text-white">
        <StartHinweis lang={lang} />
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-24 sm:py-32">
          <span className="rounded-full bg-brand-accent px-4 py-1 text-sm font-bold uppercase tracking-wide text-brand-deep">
            {t.season}
          </span>
          <h1 className="max-w-3xl">
            <span className="block text-6xl font-bold leading-none tracking-tight sm:text-8xl">
              Angeli
            </span>
            <span className="mt-3 block bg-gradient-to-r from-brand-accent to-brand-lime bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-4xl">
              Swiss League Fantasy
            </span>
          </h1>
          <p className="max-w-xl text-lg text-white/80">
            {t.tagline}
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            {user ? (
              <>
                <Link
                  href="/team"
                  className="pressable rounded-full bg-brand-accent px-7 py-3 font-bold text-brand-deep"
                >
                  {t.toTeam}
                </Link>
                <Link
                  href="/leaderboard"
                  className="pressable rounded-full border-2 border-white/40 px-7 py-3 font-semibold hover:border-brand-accent hover:text-brand-accent"
                >
                  {t.leaderboard}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="pressable rounded-full bg-brand-accent px-7 py-3 font-bold text-brand-deep"
                >
                  {t.cta}
                </Link>
                <Link
                  href="/login"
                  className="pressable rounded-full border-2 border-white/40 px-7 py-3 font-semibold hover:border-brand-accent hover:text-brand-accent"
                >
                  {t.login}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
        {t.cards.map((f) => (
          <div
            key={f.title}
            className="chamfer border border-brand-deep/10 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-2 font-bold text-brand-deep">{f.title}</h2>
            <p className="text-sm text-brand-deep/70">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
