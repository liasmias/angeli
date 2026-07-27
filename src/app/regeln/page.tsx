import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MAX_STARTERS, MIN_STARTERS, POSITION_LABEL } from "@/lib/formation";

export const metadata = {
  title: "Regeln & FAQ — Angeli",
  description: "Wie Angeli funktioniert: Punkte, Kader, Transfers und Chips.",
};

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
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
    ["Je 2 Gegentore (Torhüter, Verteidiger)", "−1"],
    ["Je 2 Paraden eines Torhüters", "+1"],
    ["Gehaltener Elfmeter", "+5"],
    ["Gelbe Karte", "−1"],
    ["Rote Karte", "−3"],
    ["Verursachter Elfmeter", "−2"],
    ["Eigentor", "−2"],
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Regeln & FAQ</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        Alles, was du zum Mitspielen wissen musst — in zwei Minuten gelesen.
      </p>

      <div className="flex flex-col gap-4">
        <Abschnitt titel="So funktioniert’s">
          <p>
            Du stellst aus den Spielern der Swiss Super League ein Team zusammen und sammelst
            Punkte danach, wie deine Spieler in echten Partien abschneiden. Vor jedem Spieltag
            bestimmst du deine Startelf und deinen Captain. Nach der Deadline ist die Aufstellung
            fix und wird automatisch ausgewertet.
          </p>
        </Abschnitt>

        <Abschnitt titel="Dein Kader">
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <b>{kader} Spieler</b> mit einem Budget von <b>{budget} Mio.</b>
            </li>
            <li>
              {s?.gk_slots ?? 2} Torhüter, {s?.def_slots ?? 5} Verteidiger, {s?.mid_slots ?? 5}{" "}
              Mittelfeldspieler, {s?.fwd_slots ?? 3} Stürmer
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
            Dein <b>Captain</b> bringt die doppelte Punktzahl — auch im Minus. Bankspieler zählen
            nicht, ausser du setzt den Bench Boost ein.
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
              In deiner <b>ersten Runde</b> sind Transfers unbegrenzt und gratis — du sollst dein
              Team ohne Strafe aufbauen können, egal wann du einsteigst.
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
            Deine erste Runde ist transferfrei, du baust dein Team also ohne Strafpunkte auf.
            Zusätzlich kann der Admin Nachzüglern ein Startguthaben gutschreiben, damit der
            Rückstand nicht von Beginn weg aussichtslos ist.
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
