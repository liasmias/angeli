import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";

/* Die zwölf Clubs der Saison — Dateinamen in public/jerseys/. */
const TRIKOTS = ["BAS", "GC", "LS", "LUG", "LUZ", "SFC", "SG", "SIO", "THU", "VAD", "YB", "ZUR"];

/**
 * Startseite: Der erste Bildschirm füllt das Fenster genau — auf dem Handy wie
 * am Rechner. Die Klasse `startseite` fixiert über globals.css Body und HTML
 * auf die Fensterhöhe, und der Bereich mit den Screenshots nimmt, was nach Text
 * und Trikotband übrig bleibt. Auf kleinen Handys werden die Screenshots
 * kleiner, statt dass der Bildschirm länger wird. Darunter scrollt <main> weiter
 * zum Video, die Navigation bleibt stehen.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const lang = await getLang();
  const t = getDictionary(lang).home;

  return (
    <main className="startseite brand-gradient-hero relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden scroll-smooth text-white">
      <div className="flex min-h-0 shrink-0 basis-full flex-col overflow-hidden">
      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-8 px-6 pb-8 pt-9 sm:grid-cols-[1.1fr_1fr] sm:grid-rows-1 sm:items-center sm:gap-10 sm:py-10">
        <div className="flex flex-col items-start gap-4 sm:gap-6">
          <span className="rounded-full bg-brand-accent px-4 py-1 text-xs font-bold uppercase tracking-wide text-brand-deep sm:text-sm">
            {t.season}
          </span>
          <h1>
            <span className="block text-[2.75rem] font-bold leading-none tracking-tight sm:text-8xl">
              Angeli
            </span>
            <span className="mt-1.5 block bg-gradient-to-r from-brand-accent to-brand-lime bg-clip-text text-lg font-bold tracking-tight text-transparent sm:mt-3 sm:text-4xl">
              Swiss League Fantasy
            </span>
          </h1>
          {/* Auf niedrigen Bildschirmen weg: Er wiederholt die Saison aus dem
              Abzeichen, und der Platz gehört den Screenshots. */}
          <p className="max-w-xl text-[15px] leading-snug text-white/80 sm:text-lg [@media(max-height:720px)]:hidden">
            {t.tagline}
          </p>
          <div className="flex gap-3 pt-1 sm:gap-4 sm:pt-2">
            {user ? (
              <>
                <Link
                  href="/team"
                  className="pressable fase-knopf bg-brand-accent whitespace-nowrap px-5 py-2.5 text-[15px] font-bold text-brand-deep sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.toTeam}
                </Link>
                <Link
                  href="/leaderboard"
                  className="pressable fase-knopf bg-white/10 whitespace-nowrap px-5 py-2.5 text-[15px] font-semibold hover:bg-white/20 hover:text-brand-accent sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.leaderboard}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="pressable fase-knopf bg-brand-accent whitespace-nowrap px-5 py-2.5 text-[15px] font-bold text-brand-deep sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.cta}
                </Link>
                <Link
                  href="/login"
                  className="pressable fase-knopf bg-white/10 whitespace-nowrap px-5 py-2.5 text-[15px] font-semibold hover:bg-white/20 hover:text-brand-accent sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.login}
                </Link>
              </>
            )}
          </div>
          <a
            href="#how-to-play"
            className="text-sm font-semibold text-white/80 underline-offset-4 hover:text-brand-accent hover:underline"
          >
            {t.howToPlay} ↓
          </a>
        </div>

        {/* Zwei Screenshots, leicht gegeneinander versetzt. Die Grösse richtet
            sich nach dem knapperen von Breite und Höhe des freien Bereichs
            (Container-Einheiten) — so passen sie auf jedes Format, schrumpfen
            auf kleinen Bildschirmen und ragen nirgends über den Rand. */}
        <div className="relative flex h-full min-h-0 items-center justify-center [container-type:size]">
          <Bildschirm
            src="/startseite-stats.webp"
            alt={t.shotStats}
            breite={716}
            hoehe={902}
            className="z-0 w-[min(54cqw,calc(82cqh*0.794))] translate-y-[2%] -rotate-[5deg]"
          />
          <Bildschirm
            src="/startseite-team.webp"
            alt={t.shotTeam}
            breite={716}
            hoehe={958}
            className="z-10 -ml-[14cqw] w-[min(58cqw,calc(96cqh*0.747))] rotate-[4deg]"
          />
        </div>
      </div>

      {/* Nur am Desktop: Auf dem Handy nahm das Band Platz weg, den Text und
          Screenshots brauchen — die Seite wirkte gedrängt. */}
      <section aria-hidden className="hidden shrink-0 overflow-hidden border-t border-white/10 bg-white py-4 sm:block">
        <div className="jersey-marquee flex w-max items-center gap-10">
          {[...TRIKOTS, ...TRIKOTS].map((code, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`${code}-${i}`}
              src={`/jerseys/${code}.png`}
              alt=""
              width={56}
              height={56}
              // Nicht lazy: Safari lädt Bilder nicht nach, die nur per
              // CSS-Transform in den Viewport wandern — Lücken im Band.
              loading="eager"
              draggable={false}
              className="h-11 w-11 select-none sm:h-14 sm:w-14"
            />
          ))}
        </div>
      </section>
      </div>

      {/* preload="none": Das Video lädt erst beim Abspielen, die Startseite bleibt leicht. */}
      <section id="how-to-play" className="mx-auto w-full max-w-5xl shrink-0 scroll-mt-4 px-6 py-10 sm:py-14">
        <h2 className="mb-5 text-2xl font-bold tracking-tight sm:mb-6 sm:text-4xl">{t.howToPlay}</h2>
        <video
          src="/how-to-play.mp4"
          poster="/how-to-play.jpg"
          width={1920}
          height={1080}
          controls
          playsInline
          preload="none"
          aria-label={t.howToPlayVideo}
          className="aspect-video h-auto w-full rounded-xl bg-brand-deep shadow-2xl shadow-black/40"
        />

        <div className="mt-10 grid items-center gap-8 sm:mt-14 sm:grid-cols-[1fr_auto] sm:gap-12">
          <div>
            <h3 className="text-xl font-bold tracking-tight sm:text-3xl">{t.mobileTitle}</h3>
            <p className="mt-2 text-[15px] text-white/80 sm:text-lg">{t.mobileIntro}</p>
            <ol className="mt-5 space-y-4">
              {t.mobileSteps.map((schritt, i) => (
                <li key={schritt.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-brand-deep">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-bold">{schritt.title}</p>
                    <p className="text-sm leading-snug text-white/80 sm:text-[15px]">{schritt.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex justify-center gap-3 sm:gap-4">
            <HandyBild src="/handy-aufstellung.jpg" alt={t.mobileShotTeam} />
            <HandyBild src="/handy-spieler.jpg" alt={t.mobileShotPlayer} />
          </div>
        </div>
      </section>
    </main>
  );
}

/** Screenshot der Handy-Ansicht in einem schlichten Gerätrahmen. */
function HandyBild({ src, alt }: { src: string; alt: string }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      width={390}
      height={780}
      loading="lazy"
      decoding="async"
      draggable={false}
      className="h-auto w-[calc(50%-0.375rem)] max-w-[12.5rem] select-none rounded-[1.5rem] border-4 border-brand-deep shadow-2xl shadow-black/40 sm:w-48"
    />
  );
}

/**
 * Ein Screenshot ohne eigenen Rahmen: Die Bilder sind genau auf die Karten
 * der App zugeschnitten und tragen deren gefaste Ecken selbst, mit
 * durchsichtigem Rand. Kontur und Schatten folgen per drop-shadow dieser
 * Form (siehe .startseite-bild in globals.css).
 */
function Bildschirm({
  src,
  alt,
  breite,
  hoehe,
  className,
}: {
  src: string;
  alt: string;
  breite: number;
  hoehe: number;
  className: string;
}) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      width={breite / 2}
      height={hoehe / 2}
      decoding="async"
      draggable={false}
      style={{ aspectRatio: `${breite} / ${hoehe}` }}
      className={`startseite-bild relative h-auto max-w-[400px] select-none ${className}`}
    />
  );
}
