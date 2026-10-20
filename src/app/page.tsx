import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLang } from "@/lib/lang";
import { getDictionary } from "@/lib/i18n";

/* Die zwölf Clubs der Saison — Dateinamen in public/jerseys/. */
const TRIKOTS = ["BAS", "GC", "LS", "LUG", "LUZ", "SFC", "SG", "SIO", "THU", "VAD", "YB", "ZUR"];

/**
 * Startseite als ein einziger Bildschirm — auf dem Handy wie am Rechner.
 *
 * Nichts scrollt: Die Klasse `startseite` fixiert über globals.css Body und
 * HTML auf die Fensterhöhe, und der Bereich mit den Screenshots nimmt, was
 * nach Text und Trikotband übrig bleibt. Auf kleinen Handys werden die
 * Screenshots kleiner, statt dass die Seite länger wird.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const lang = await getLang();
  const t = getDictionary(lang).home;

  return (
    <main className="startseite brand-gradient-hero relative flex min-h-0 flex-1 flex-col overflow-hidden text-white">
      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 px-6 pb-4 pt-5 sm:grid-cols-[1.1fr_1fr] sm:grid-rows-1 sm:items-center sm:gap-10 sm:py-10">
        <div className="flex flex-col items-start gap-3 sm:gap-6">
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
          <div className="flex gap-2.5 sm:gap-4 sm:pt-2">
            {user ? (
              <>
                <Link
                  href="/team"
                  className="pressable rounded-full bg-brand-accent whitespace-nowrap px-5 py-2.5 text-[15px] font-bold text-brand-deep sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.toTeam}
                </Link>
                <Link
                  href="/leaderboard"
                  className="pressable rounded-full border-2 border-white/40 whitespace-nowrap px-5 py-2.5 text-[15px] font-semibold hover:border-brand-accent hover:text-brand-accent sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.leaderboard}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signup"
                  className="pressable rounded-full bg-brand-accent whitespace-nowrap px-5 py-2.5 text-[15px] font-bold text-brand-deep sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.cta}
                </Link>
                <Link
                  href="/login"
                  className="pressable rounded-full border-2 border-white/40 whitespace-nowrap px-5 py-2.5 text-[15px] font-semibold hover:border-brand-accent hover:text-brand-accent sm:px-7 sm:py-3 sm:text-base"
                >
                  {t.login}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Zwei Screenshots, leicht gegeneinander versetzt. Die Grösse richtet
            sich nach dem knapperen von Breite und Höhe des freien Bereichs
            (Container-Einheiten) — so passen sie auf jedes Format, schrumpfen
            auf kleinen Bildschirmen und ragen nirgends über den Rand. */}
        <div className="relative flex h-full min-h-0 items-center justify-center [container-type:size]">
          <Bildschirm
            src="/startseite-stats.webp"
            alt={t.shotStats}
            className="z-0 w-[min(53cqw,calc(84cqh*0.806))] translate-y-[3%] -rotate-[5deg]"
          />
          <Bildschirm
            src="/startseite-team.webp"
            alt={t.shotTeam}
            className="z-10 -ml-[15cqw] w-[min(60cqw,calc(96cqh*0.806))] rotate-[4deg]"
          />
        </div>
      </div>

      <section aria-hidden className="shrink-0 overflow-hidden border-t border-white/10 bg-white py-3 sm:py-4">
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
    </main>
  );
}

/** Ein Screenshot im schlichten Handyrahmen. */
function Bildschirm({ src, alt, className }: { src: string; alt: string; className: string }) {
  return (
    <div
      className={`relative aspect-[780/968] max-w-[440px] overflow-hidden rounded-[22px] bg-white p-1.5 shadow-2xl ring-1 ring-black/10 sm:rounded-[28px] sm:p-2 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={390}
        height={484}
        decoding="async"
        draggable={false}
        className="h-full w-full select-none rounded-[16px] object-cover object-top sm:rounded-[20px]"
      />
    </div>
  );
}
