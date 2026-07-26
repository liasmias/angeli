import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex-1">
      <section className="brand-gradient-hero text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-24 sm:py-32">
          <span className="rounded-full bg-brand-green px-4 py-1 text-sm font-bold uppercase tracking-wide text-brand-deep">
            Saison 26/27
          </span>
          <h1 className="max-w-3xl">
            <span className="block text-6xl font-bold leading-none tracking-tight sm:text-8xl">
              Angeli
            </span>
            <span className="mt-3 block bg-gradient-to-r from-brand-green to-brand-cyan bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-4xl">
              Swiss League Fantasy
            </span>
          </h1>
          <p className="max-w-xl text-lg text-white/80">
            Stell dein 15er-Team mit 100.0 Budget zusammen, wähle deinen Captain
            und miss dich Spieltag für Spieltag mit deinen Freunden in der
            Rangliste.
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            {user ? (
              <>
                <Link
                  href="/team"
                  className="pressable rounded-full bg-brand-green px-7 py-3 font-bold text-brand-deep"
                >
                  Zu meinem Team
                </Link>
                <Link
                  href="/leaderboard"
                  className="pressable rounded-full border-2 border-white/40 px-7 py-3 font-semibold hover:border-brand-green hover:text-brand-green"
                >
                  Rangliste
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="pressable rounded-full bg-brand-green px-7 py-3 font-bold text-brand-deep"
                >
                  Jetzt Team erstellen
                </Link>
                <Link
                  href="/login"
                  className="pressable rounded-full border-2 border-white/40 px-7 py-3 font-semibold hover:border-brand-green hover:text-brand-green"
                >
                  Einloggen
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-16 sm:grid-cols-3">
        {[
          {
            title: "15er-Kader, 100.0 Budget",
            text: "2 Torhüter, 5 Verteidiger, 5 Mittelfeldspieler, 3 Stürmer — wie beim grossen Vorbild.",
          },
          {
            title: "Captain & Transfers",
            text: "Dein Captain zählt doppelt. Pro Spieltag gibt es einen Gratis-Transfer, jeder weitere kostet Punkte.",
          },
          {
            title: "Echte Statistiken",
            text: "Tore, Assists, Zu-null-Spiele und Karten aus der Super League fliessen automatisch in deine Punkte.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-brand-deep/10 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-2 font-bold text-brand-deep">{f.title}</h2>
            <p className="text-sm text-brand-deep/70">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
