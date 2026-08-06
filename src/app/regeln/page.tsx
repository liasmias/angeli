import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MAX_PER_CLUB, MAX_STARTERS, MIN_STARTERS, POSITION_LABEL } from "@/lib/formation";
import { PREIS_AB_SPIELTAG, PREIS_ANSTIEG, PREIS_MINIMUM, PREIS_RATING_SCHWELLE, PREIS_SENKUNG, PREIS_SENKUNG_SCHWELLE } from "@/lib/pricing";
import { BONUS_AB_SPIELTAG } from "@/lib/bonus";
import { getLang } from "@/lib/lang";

export const metadata = {
  title: "Regeln — Angeli",
  description:
    "Wie Angeli funktioniert: Punkte, Kader, Transfers und Chips in der Schweizer Liga.",
};

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="chamfer bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-brand-deep">{titel}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-brand-deep/80">
        {children}
      </div>
    </section>
  );
}

function Frage({ frage, children }: { frage: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-brand-deep/5 pb-3 last:border-0 last:pb-0">
      <summary className="cursor-pointer list-none font-semibold text-brand-deep marker:content-none">
        <span className="text-brand-magenta group-open:hidden">▸ </span>
        <span className="hidden text-brand-magenta group-open:inline">▾ </span>
        {frage}
      </summary>
      <div className="mt-2 pl-4 text-sm leading-relaxed text-brand-deep/75">{children}</div>
    </details>
  );
}

export default async function RegelnPage() {
  const supabase = await createClient();
  const lang = await getLang();
  // Werte aus der Datenbank lesen statt fest eintragen — sonst weicht die
  // Seite von den tatsächlich geltenden Regeln ab, sobald jemand die
  // Einstellungen ändert.
  const { data: s } = await supabase.from("league_settings").select("*").eq("id", 1).single();

  const budget = Number(s?.budget_cap ?? 100).toFixed(1);
  const kader = s?.squad_size ?? 15;
  const elf = s?.starting_size ?? 11;
  const gratis = s?.free_transfers_per_gameweek ?? 1;
  const strafe = s?.extra_transfer_cost ?? 4;
  const maxBank = s?.max_banked_transfers ?? 5;

  const punkte: Array<[string, string]> = [
    ["Einsatz bis 59 Minuten", "+1"],
    ["Einsatz ab 60 Minuten", "+2"],
    ["Tor eines Torhüters oder Verteidigers", "+6"],
    ["Tor eines Mittelfeldspielers", "+5"],
    ["Tor eines Stürmers", "+4"],
    ["Assist", "+3"],
    ["Torhüter oder Verteidiger ohne Gegentor (ab 60 Min.)", "+4"],
    ["Je 2 Gegentore (Torhüter, Verteidiger, ab 60 Min.)", "−1"],
    ["Je 2 Paraden eines Torhüters", "+1"],
    ["Gehaltener Elfmeter", "+5"],
    ["Gelbe Karte", "−1"],
    ["Rote Karte", "−3"],
    ["Verursachter Elfmeter", "−2"],
    ["Eigentor", "−2"],
  ];


  if (lang === "en") {
    const pointsEn: Array<[string, string]> = [
      ["Appearance up to 59 minutes", "+1"],
      ["Appearance of 60+ minutes", "+2"],
      ["Goal by a goalkeeper or defender", "+6"],
      ["Goal by a midfielder", "+5"],
      ["Goal by a forward", "+4"],
      ["Assist", "+3"],
      ["Goalkeeper or defender clean sheet (60+ min.)", "+4"],
      ["Every 2 goals conceded (GK, DEF, 60+ min.)", "−1"],
      ["Every 2 saves by a goalkeeper", "+1"],
      ["Penalty saved", "+5"],
      ["Yellow card", "−1"],
      ["Red card", "−3"],
      ["Penalty conceded", "−2"],
      ["Own goal", "−2"],
    ];
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Rules</h1>
        <p className="mb-6 text-sm text-brand-deep/60">
          Everything you need to play — a two-minute read.
        </p>

        <div className="flex flex-col gap-4">
          <Abschnitt titel="How it works">
            <p>
              You build a team from Swiss league players and collect points based on how they
              perform in real matches. Before each gameweek you set your starting XI and your
              captain. After the deadline your lineup is locked and scored automatically.
            </p>
          </Abschnitt>

          <Abschnitt titel="Your squad">
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <b>{kader} players</b> with a budget of <b>{budget}m</b> — if price rises make
                your players worth more, you keep the full team value, even above the base budget
              </li>
              <li>
                {s?.gk_slots ?? 2} goalkeepers, {s?.def_slots ?? 5} defenders, {s?.mid_slots ?? 5}{" "}
                midfielders, {s?.fwd_slots ?? 3} forwards
              </li>
              <li>
                At most <b>{MAX_PER_CLUB} players from the same club</b>
              </li>
              <li>
                <b>{elf} of them start</b>, the rest sit on the bench
              </li>
            </ul>
            <p className="rounded-lg bg-brand-deep/5 p-3">
              <b>Allowed formations:</b> always exactly {MIN_STARTERS.GK} goalkeeper, at least{" "}
              {MIN_STARTERS.DEF} defenders, at least {MIN_STARTERS.MID} midfielders and at least{" "}
              {MIN_STARTERS.FWD} forward. Upper limits: at most {MAX_STARTERS.DEF} defenders,{" "}
              {MAX_STARTERS.MID} midfielders and {MAX_STARTERS.FWD} forwards.
            </p>
            <p className="rounded-lg bg-brand-deep/5 p-3">
              <b>Automatic price changes:</b> if a player reaches a rating of at least{" "}
              <b>{PREIS_RATING_SCHWELLE}</b> in two consecutive gameweeks, his price goes up
              by <b>{PREIS_ANSTIEG}m</b>. If he stays below <b>{PREIS_SENKUNG_SCHWELLE}</b>{" "}
              twice in a row, it drops by <b>{PREIS_SENKUNG}m</b> (never below {PREIS_MINIMUM}).
              Counting starts at gameweek {PREIS_AB_SPIELTAG}, so the first change happens after
              gameweek {PREIS_AB_SPIELTAG + 1}. Your existing team keeps its full value — even
              above the base budget.
            </p>
          </Abschnitt>

          <Abschnitt titel="Points">
            <div className="overflow-hidden rounded-lg border border-brand-deep/10">
              <table className="w-full border-collapse text-sm">
                <tbody className="divide-y divide-brand-deep/5">
                  {pointsEn.map(([what, value]) => (
                    <tr key={what}>
                      <td className="px-3 py-1.5">{what}</td>
                      <td
                        className={`w-16 px-3 py-1.5 text-right font-bold tabular-nums ${
                          value.startsWith("−") ? "text-brand-danger" : "text-brand-deep"
                        }`}
                      >
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Your <b>captain</b> scores double — including negatives. If they do not play at
              all, your <b>vice-captain</b> takes the armband. Bench players do not count, unless
              you play the Bench Boost.
            </p>
            <p className="rounded-lg bg-brand-deep/5 p-3">
              <b>Bonus points (from gameweek {BONUS_AB_SPIELTAG}):</b> after each match the three
              best-rated players receive <b>3, 2 and 1</b> extra points (based on the player
              rating). Ties share the rank — two joint firsts both get 3, the next gets 1.
              Bonus appears once the match has finished.
            </p>
          </Abschnitt>

          <Abschnitt titel="Automatic substitutions">
            <p>
              If a player in your starting XI <b>does not play at all</b> (0 minutes), a bench
              player automatically comes on after the matches — so you never lose a slot.
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                On the bench the <b>goalkeeper is fixed in slot 1</b>, followed by your outfield
                players in the order <b>1, 2, 3</b> that you choose yourself.
              </li>
              <li>
                The <b>first bench player</b> comes on with whom your formation stays valid (at
                least {MIN_STARTERS.DEF} defenders, {MIN_STARTERS.MID} midfielders and{" "}
                {MIN_STARTERS.FWD} forward). If the first does not fit, the second comes on,
                otherwise the third.
              </li>
              <li>A <b>goalkeeper</b> can only be replaced by the bench goalkeeper.</li>
              <li>A bench player who <b>did not play either</b> does not come on.</li>
              <li>
                If your <b>captain</b> does not play a single minute, the <b>vice-captain</b>
                takes the double score — provided they played themselves.
              </li>
            </ul>
            <p className="rounded-lg bg-brand-deep/5 p-3">
              Substitutions only happen once <b>all matches of the round have finished</b> — until
              then the live points show your original lineup.
            </p>
          </Abschnitt>

          <Abschnitt titel="Transfers">
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <b>{gratis} free transfer per gameweek.</b> Every additional one costs {strafe}{" "}
                points.
              </li>
              <li>
                Unused transfers <b>bank up</b>, to a maximum of {maxBank}.
              </li>
              <li>
                In your <b>first round</b> transfers are unlimited.
              </li>
            </ul>
          </Abschnitt>

          <Abschnitt titel="Chips">
            <p>
              Two chips, each <b>once per season</b>. You can take them back until the deadline —
              after that they are spent.
            </p>
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <b>🃏 Wildcard</b> — unlimited transfers this gameweek, without point deductions.
              </li>
              <li>
                <b>🚀 Bench Boost</b> — this gameweek the points of your bench players count too.
              </li>
            </ul>
          </Abschnitt>

          <p className="text-center text-sm text-brand-deep/60">
            Questions about a specific situation? The{" "}
            <Link href="/faq" className="font-semibold text-brand-magenta underline">
              FAQ
            </Link>{" "}
            answers most of them.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Regeln</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        Alles, was du zum Mitspielen wissen musst — in zwei Minuten gelesen.
      </p>

      <div className="flex flex-col gap-4">
        <Abschnitt titel="So funktioniert’s">
          <p>
            Du stellst aus den Spielern der Schweizer Liga ein Team zusammen und sammelst
            Punkte danach, wie deine Spieler in echten Partien abschneiden. Vor jedem Spieltag
            bestimmst du deine Startelf und deinen Captain. Nach der Deadline ist die Aufstellung
            fix und wird automatisch ausgewertet.
          </p>
        </Abschnitt>

        <Abschnitt titel="Dein Kader">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <b>{kader} Spieler</b> mit einem Budget von <b>{budget} Mio.</b> — steigt der Wert
              deiner Spieler durch Preisanpassungen, bleibt dir der volle Teamwert erhalten, auch
              über dem Basis-Budget
            </li>
            <li>
              {s?.gk_slots ?? 2} Torhüter, {s?.def_slots ?? 5} Verteidiger, {s?.mid_slots ?? 5}{" "}
              Mittelfeldspieler, {s?.fwd_slots ?? 3} Stürmer
            </li>
            <li>
              Höchstens <b>{MAX_PER_CLUB} Spieler desselben Clubs</b>
            </li>
            <li>
              Davon stehen <b>{elf} in der Startelf</b>, die übrigen auf der Bank
            </li>
          </ul>
          <p className="rounded-lg bg-brand-deep/5 p-3">
            <b>Erlaubte Formationen:</b> immer genau {MIN_STARTERS.GK} Torhüter, mindestens{" "}
            {MIN_STARTERS.DEF} Verteidiger, mindestens {MIN_STARTERS.MID} Mittelfeldspieler und
            mindestens {MIN_STARTERS.FWD} Stürmer. Nach oben gilt: höchstens{" "}
            {MAX_STARTERS.DEF} {POSITION_LABEL.DEF}, {MAX_STARTERS.MID} {POSITION_LABEL.MID} und{" "}
            {MAX_STARTERS.FWD} {POSITION_LABEL.FWD}.
          </p>
          <p className="rounded-lg bg-brand-deep/5 p-3">
            <b>Automatische Preisanpassung:</b> Erreicht ein Spieler an zwei
            aufeinanderfolgenden Spieltagen ein Rating von mindestens{" "}
            <b>{PREIS_RATING_SCHWELLE}</b>, steigt sein Preis um{" "}
            <b>{PREIS_ANSTIEG} Mio.</b> Bleibt er zweimal in Folge unter{" "}
            <b>{PREIS_SENKUNG_SCHWELLE}</b>, sinkt er um <b>{PREIS_SENKUNG} Mio.</b>{" "}
            (nie unter {PREIS_MINIMUM}). Gezählt wird ab Spieltag {PREIS_AB_SPIELTAG} —
            die erste Anpassung kommt also nach Spieltag {PREIS_AB_SPIELTAG + 1}. Dein bereits
            gekauftes Team behält dabei seinen vollen Wert — auch über dem Basis-Budget.
          </p>
        </Abschnitt>

        <Abschnitt titel="Punkte">
          <div className="overflow-hidden rounded-lg border border-brand-deep/10">
            <table className="w-full border-collapse text-sm">
              <tbody className="divide-y divide-brand-deep/5">
                {punkte.map(([was, wert]) => (
                  <tr key={was}>
                    <td className="px-3 py-1.5">{was}</td>
                    <td
                      className={`w-16 px-3 py-1.5 text-right font-bold tabular-nums ${
                        wert.startsWith("−") ? "text-brand-danger" : "text-brand-deep"
                      }`}
                    >
                      {wert}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Dein <b>Captain</b> bringt die doppelte Punktzahl — auch im Minus. Kommt er gar nicht
            zum Einsatz, übernimmt dein <b>Vize-Captain</b> die Binde. Bankspieler zählen nicht,
            ausser du setzt den Bench Boost ein.
          </p>
          <p className="rounded-lg bg-brand-deep/5 p-3">
            <b>Bonuspunkte (ab Spieltag {BONUS_AB_SPIELTAG}):</b> Nach jeder Partie erhalten die
            drei am besten bewerteten Spieler <b>3, 2 und 1</b> Zusatzpunkte (Basis ist das
            Spieler-Rating). Bei Gleichstand teilen sich Spieler den Rang — zwei geteilte Erste
            bekommen beide 3, der Nächste 1. Der Bonus erscheint, sobald die Partie beendet ist.
          </p>
        </Abschnitt>

        <Abschnitt titel="Automatische Einwechslung">
          <p>
            Kommt ein Spieler deiner Startelf <b>gar nicht zum Einsatz</b> (0 Minuten), rückt nach
            Spielende automatisch ein Bankspieler nach — du verlierst also keinen Platz.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              Auf der Bank steht der <b>Torhüter fix auf Platz 1</b>, danach folgen deine
              Feldspieler in der Reihenfolge <b>1., 2., 3.</b>, die du selbst festlegst.
            </li>
            <li>
              Es rückt der <b>erste Bankspieler</b> nach, mit dem deine Formation gültig bleibt
              (mindestens {MIN_STARTERS.DEF} Verteidiger, {MIN_STARTERS.MID} Mittelfeldspieler und{" "}
              {MIN_STARTERS.FWD} Stürmer). Passt der erste nicht, kommt der zweite, sonst der
              dritte.
            </li>
            <li>Ein <b>Torhüter</b> kann nur durch den Bank-Torhüter ersetzt werden.</li>
            <li>Wer auf der Bank <b>selbst nicht gespielt</b> hat, rückt nicht nach.</li>
            <li>
              Spielt dein <b>Captain</b> keine Minute, übernimmt der <b>Vize-Captain</b> die
              doppelte Wertung — sofern er selbst gespielt hat.
            </li>
          </ul>
          <p className="rounded-lg bg-brand-deep/5 p-3">
            Die Einwechslung passiert erst, wenn <b>alle Partien der Runde beendet</b> sind — bis
            dahin zeigen die Live-Punkte deine ursprüngliche Aufstellung.
          </p>
        </Abschnitt>

        <Abschnitt titel="Transfers">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <b>{gratis} Gratis-Transfer pro Spieltag.</b> Jeder weitere kostet {strafe} Punkte.
            </li>
            <li>
              Nicht genutzte Transfers <b>sammeln sich an</b>, bis maximal {maxBank}.
            </li>
            <li>
              In deiner <b>ersten Runde</b> sind Transfers unbegrenzt.
            </li>
          </ul>
        </Abschnitt>

        <Abschnitt titel="Chips">
          <p>
            Zwei Joker, jeweils <b>einmal pro Saison</b>. Bis zur Deadline kannst du sie wieder
            zurücknehmen, danach sind sie verbraucht.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <b>🃏 Wildcard</b> — beliebig viele Transfers an diesem Spieltag, ohne Punktabzug.
            </li>
            <li>
              <b>🚀 Bench Boost</b> — an diesem Spieltag zählen auch die Punkte deiner
              Bankspieler.
            </li>
          </ul>
        </Abschnitt>

        <p className="text-center text-sm text-brand-deep/60">
          Fragen zu einer konkreten Situation? Die{" "}
          <Link href="/faq" className="font-semibold text-brand-magenta underline">
            häufigen Fragen
          </Link>{" "}
          beantworten die meisten davon.
        </p>
      </div>
    </main>
  );
}
