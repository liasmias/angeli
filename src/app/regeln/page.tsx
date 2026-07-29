import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MAX_PER_CLUB, MAX_STARTERS, MIN_STARTERS, POSITION_LABEL } from "@/lib/formation";
import { getLang } from "@/lib/lang";

export const metadata = {
  title: "Regeln & FAQ — Angeli",
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
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Rules & FAQ</h1>
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

          <Abschnitt titel="Frequently asked questions">
            <Frage frage="When do I have to submit my lineup?">
              Before the deadline of each gameweek — it is shown above your lineup and sits one
              hour before the round&apos;s first kick-off. After that, your XI is locked.
            </Frage>
            <Frage frage="I joined mid-season. Do I still stand a chance?">
              Yes. Your first round is transfer-free, so you build your team without penalty
              points.
              <br />
              <br />
              If you join <b>within the first 5 rounds</b>, you are additionally credited the{" "}
              <b>average points scored so far</b> — you do not start from zero while everyone
              else is ahead. Just message the admin, who enters the credit.
            </Frage>
            <Frage frage="When are points updated?">
              Automatically every 15 minutes, including during live matches. Interim scores can
              still change — numbers are final only after the final whistle.
            </Frage>
            <Frage frage="Can I see other people's teams?">
              Yes, via the leaderboard — but only after each gameweek&apos;s deadline. If live
              lineups were visible, you could simply copy them.
            </Frage>
            <Frage frage="What happens if one of my players doesn't play?">
              They score 0 points. Unlike some other games, bench players do not step in
              automatically — plan your starting XI with the schedule in mind.
            </Frage>
            <Frage frage="A player's points look wrong. What now?">
              Report it to the admin. The data comes from an external provider and is rarely,
              but not never, wrong. Own goals, for instance, are not delivered by the API at
              all — the admin enters them manually. Corrections apply retroactively to the
              leaderboard.
            </Frage>
            <Frage frage="How do I change my account name or password?">
              Tap your name in the top right. There you can change both and delete your account
              if needed.
            </Frage>
            <Frage frage="What does the rating in the statistics mean?">
              A performance rating from the data provider (roughly 6.0 to 10.0). It is purely a
              guide for picking players and does <b>not</b> count towards your fantasy points.
            </Frage>
          </Abschnitt>

          <p className="text-center text-sm text-brand-deep/60">
            Still unclear? Ask the admin — or head straight to{" "}
            <Link href="/stats" className="font-semibold text-brand-magenta underline">
              the statistics
            </Link>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Regeln & FAQ</h1>
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

        <Abschnitt titel="Häufige Fragen">
          <Frage frage="Wann muss ich meine Aufstellung abgeben?">
            Vor der Deadline des jeweiligen Spieltags — sie steht über deiner Aufstellung und
            liegt eine Stunde vor dem ersten Anpfiff der Runde. Danach ist deine Elf fix.
          </Frage>
          <Frage frage="Ich bin erst mitten in der Saison dazugestossen. Habe ich noch eine Chance?">
            Ja. Deine erste Runde ist transferfrei, du baust dein Team also ohne Strafpunkte auf.
            <br />
            <br />
            Steigst du <b>innerhalb der ersten 5 Runden</b> ein, erhältst du zusätzlich die bis
            dahin <b>durchschnittlich erspielten Punkte</b> gutgeschrieben — du startest also
            nicht bei null, während die anderen schon vorgelegt haben. Melde dich dafür einfach
            beim Admin, er trägt die Gutschrift ein.
          </Frage>
          <Frage frage="Wann werden die Punkte aktualisiert?">
            Automatisch alle 15 Minuten, auch während laufender Spiele. Zwischenstände können
            sich deshalb noch ändern — endgültig sind die Zahlen erst nach Abpfiff.
          </Frage>
          <Frage frage="Kann ich die Teams der anderen sehen?">
            Ja, über die Rangliste — aber erst nach der Deadline des jeweiligen Spieltags. Wäre
            die laufende Aufstellung sichtbar, könnte man einfach abschreiben.
          </Frage>
          <Frage frage="Was passiert, wenn ein Spieler nicht spielt?">
            Er bringt 0 Punkte. Anders als bei manchen anderen Spielen rücken Bankspieler nicht
            automatisch nach — plane deine Startelf also mit Blick auf die Ansetzungen.
          </Frage>
          <Frage frage="Die Punkte eines Spielers stimmen nicht. Was nun?">
            Melde es dem Admin. Die Daten stammen von einem externen Anbieter und sind selten,
            aber nicht nie fehlerhaft. Eigentore etwa liefert die Schnittstelle gar nicht — die
            trägt der Admin von Hand nach. Korrekturen wirken rückwirkend auf die Rangliste.
          </Frage>
          <Frage frage="Wie ändere ich meinen Accountnamen oder mein Passwort?">
            Oben rechts auf deinen Namen tippen. Dort kannst du beides ändern und dein Konto bei
            Bedarf auch löschen.
          </Frage>
          <Frage frage="Was bedeutet das Rating in den Statistiken?">
            Eine Bewertung der Datenquelle zur Leistung im Spiel (etwa 6.0 bis 10.0). Sie ist
            reine Orientierungshilfe bei der Spielerauswahl und fliesst <b>nicht</b> in deine
            Fantasy-Punkte ein.
          </Frage>
        </Abschnitt>

        <p className="text-center text-sm text-brand-deep/60">
          Noch etwas unklar? Frag den Admin — oder schau direkt in{" "}
          <Link href="/stats" className="font-semibold text-brand-magenta underline">
            die Statistiken
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
