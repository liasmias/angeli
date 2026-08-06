import Link from "next/link";
import { MIN_STARTERS, POSITION_LABEL } from "@/lib/formation";
import { BONUS_AB_SPIELTAG } from "@/lib/bonus";
import { getLang } from "@/lib/lang";

export const metadata = {
  title: "Häufige Fragen — Angeli",
  description:
    "Antworten zu Deadline, Punkten, automatischen Einwechslungen, Bonuspunkten und Korrekturen.",
};

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

function Gruppe({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="chamfer bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-brand-deep">{titel}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-brand-deep/80">
        {children}
      </div>
    </section>
  );
}

export default async function FaqPage() {
  const lang = await getLang();

  // Mindestbesetzung aus dem Regelmodul, damit die Erklärung der
  // automatischen Einwechslungen nicht von der tatsächlichen Prüfung abweicht.
  // POSITION_LABEL ist deutsch — fürs Englische eine eigene Tabelle.
  const LABEL_EN: Record<"GK" | "DEF" | "MID" | "FWD", string> = {
    GK: "goalkeeper",
    DEF: "defenders",
    MID: "midfielders",
    FWD: "forward",
  };
  const minimum = (["GK", "DEF", "MID", "FWD"] as const)
    .map((p) => `${MIN_STARTERS[p]} ${lang === "en" ? LABEL_EN[p] : POSITION_LABEL[p]}`)
    .join(", ");

  if (lang === "en") {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">
          Frequently asked questions
        </h1>
        <p className="mb-6 text-sm text-brand-deep/60">
          The rules themselves are on the{" "}
          <Link href="/regeln" className="font-semibold text-brand-magenta underline">
            rules page
          </Link>
          .
        </p>

        <div className="flex flex-col gap-4">
          <Gruppe titel="Lineup and deadline">
            <Frage frage="When do I have to submit my lineup?">
              Before the deadline of each gameweek — it is shown above your lineup and sits one
              hour before the round&apos;s first kick-off. After that, your XI is locked.
            </Frage>
            <Frage frage="What happens if I don't save anything for a gameweek?">
              Your last lineup carries over automatically. You are never left without a team just
              because you did not open the app — but transfers, captain changes and chips only
              take effect if you save them before the deadline.
            </Frage>
            <Frage frage="What happens if one of my starters doesn't play?">
              A bench player comes in automatically after the round — you do not lose the slot.
              The substitution follows the bench order you set: the first bench player who keeps
              the formation valid comes in. Two restrictions apply: a goalkeeper can only be
              replaced by your bench goalkeeper, and a bench player who did not play himself
              cannot come in.
              <br />
              <br />
              The formation must still satisfy the minimum of {minimum} — if no bench player
              fits, the slot stays empty and the player scores 0.
            </Frage>
            <Frage frage="What if my captain doesn't play?">
              Your vice-captain takes over the doubling. If neither of them plays, nothing is
              doubled that round.
            </Frage>
            <Frage frage="Can I see other people's teams?">
              Yes, via the leaderboard — but only after each gameweek&apos;s deadline. If live
              lineups were visible, you could simply copy them.
            </Frage>
          </Gruppe>

          <Gruppe titel="Points">
            <Frage frage="When are points updated?">
              Automatically every 5 minutes while matches are running. Interim scores can still
              change — numbers are final only after the final whistle.
            </Frage>
            <Frage frage="How do bonus points work?">
              After each match Angeli looks at the ratings of everyone who played: the top-rated
              player gets <b>+3</b>, the second <b>+2</b>, the third <b>+1</b> — on top of the
              normal points, doubled for your captain like everything else. Ties share the rank:
              two joint firsts both get +3 and the next-best is third (+1). Example from
              gameweek 1, YB 4:2 Sion: Essende (rating 8.9) +3, Sanches (7.9) +2, Fernandes
              (7.6) +1. Bonus appears once the match has finished, starting from gameweek{" "}
              {BONUS_AB_SPIELTAG}.
            </Frage>
            <Frage frage="What does the rating in the statistics mean?">
              A performance rating from the data provider (roughly 6.0 to 10.0). It decides the{" "}
              <b>bonus points</b> (top 3 of each match) and the automatic <b>price changes</b> —
              it does not feed into the normal event points (goals, assists, cards …).
            </Frage>
            <Frage frage="A player's points look wrong. What now?">
              Report it to the admin — open the menu in the <b>top right</b>, tap your account
              name and use the report form on your{" "}
              <Link href="/profil" className="font-semibold text-brand-magenta underline">
                profile page
              </Link>
              . The data comes from an external provider and is rarely, but not never, wrong. Own
              goals, for instance, are not delivered by the API at all — the admin enters them
              manually. Corrections apply retroactively to the leaderboard.
            </Frage>
          </Gruppe>

          <Gruppe titel="Squad and market">
            <Frage frage="Why does a player have a coloured mark?">
              A <b className="text-amber-500">yellow</b> mark means doubtful — injured, suspended
              or carrying a knock. A <b className="text-brand-magenta">red</b> mark means the
              player is out, for instance after a transfer or a long-term injury. Marked players
              can still be picked and still score; the mark is a warning, not a block.
            </Frage>
            <Frage frage="Why did a player's price change?">
              Prices follow performance automatically: two consecutive gameweeks with a strong
              rating raise the price, two weak ones lower it. If you bought the player before a
              rise, you keep your purchase price — which is why your squad value can grow beyond
              the starting budget.
            </Frage>
            <Frage frage="I joined mid-season. Do I still stand a chance?">
              Yes. Your first round is transfer-free, so you build your team without penalty
              points.
              <br />
              <br />
              If you join <b>within the first 5 rounds</b>, you are additionally credited the{" "}
              <b>average points scored so far</b> — you do not start from zero while everyone
              else is ahead. Ask the admin via the menu in the <b>top right</b> →{" "}
              <Link href="/profil" className="font-semibold text-brand-magenta underline">
                your account
              </Link>
              , and the credit gets entered.
            </Frage>
          </Gruppe>

          <Gruppe titel="Account">
            <Frage frage="How do I change my account name or password?">
              Open the menu in the <b>top right</b> and tap your name. On your{" "}
              <Link href="/profil" className="font-semibold text-brand-magenta underline">
                profile page
              </Link>{" "}
              you can change both and delete your account if needed.
            </Frage>
            <Frage frage="How do I save the game as an app on my phone?">
              iPhone: tap Share in Safari, then “Add to Home Screen”. Android: tap the menu (⋮)
              in Chrome, then “Add to Home screen”. It then behaves like an installed app,
              without an app store.
            </Frage>
            <Frage frage="Something else is unclear. How do I reach the admin?">
              Open the menu in the <b>top right</b>, tap your account name and write a message on
              your{" "}
              <Link href="/profil" className="font-semibold text-brand-magenta underline">
                profile page
              </Link>
              .
            </Frage>
          </Gruppe>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-brand-deep">Häufige Fragen</h1>
      <p className="mb-6 text-sm text-brand-deep/60">
        Die Regeln selbst stehen auf der{" "}
        <Link href="/regeln" className="font-semibold text-brand-magenta underline">
          Regelseite
        </Link>
        .
      </p>

      <div className="flex flex-col gap-4">
        <Gruppe titel="Aufstellung und Deadline">
          <Frage frage="Wann muss ich meine Aufstellung abgeben?">
            Vor der Deadline des jeweiligen Spieltags — sie steht über deiner Aufstellung und
            liegt eine Stunde vor dem ersten Anpfiff der Runde. Danach ist deine Elf fix.
          </Frage>
          <Frage frage="Was passiert, wenn ich für einen Spieltag nichts speichere?">
            Deine letzte Aufstellung läuft automatisch weiter. Du stehst also nie ohne Team da,
            nur weil du die App nicht geöffnet hast — Transfers, Captain-Wechsel und Chips wirken
            aber nur, wenn du sie vor der Deadline speicherst.
          </Frage>
          <Frage frage="Was passiert, wenn ein Spieler meiner Startelf nicht spielt?">
            Ein Bankspieler rückt nach dem Spieltag automatisch nach — der Platz verfällt also
            nicht. Eingewechselt wird nach der Bank-Reihenfolge, die du selbst festgelegt hast:
            Es kommt der erste Bankspieler, mit dem die Formation gültig bleibt. Zwei
            Einschränkungen gelten: Ein Torhüter kann nur durch den Bank-Torhüter ersetzt werden,
            und wer selbst nicht gespielt hat, rückt nicht nach.
            <br />
            <br />
            Die Formation muss weiterhin mindestens {minimum} enthalten — passt kein Bankspieler,
            bleibt der Platz leer und der Spieler bringt 0 Punkte.
          </Frage>
          <Frage frage="Was ist, wenn mein Captain nicht spielt?">
            Dein Vize-Captain übernimmt die Verdopplung. Spielt auch er nicht, wird in dieser
            Runde nichts verdoppelt.
          </Frage>
          <Frage frage="Kann ich die Teams der anderen sehen?">
            Ja, über die Rangliste — aber erst nach der Deadline des jeweiligen Spieltags. Wäre
            die laufende Aufstellung sichtbar, könnte man einfach abschreiben.
          </Frage>
        </Gruppe>

        <Gruppe titel="Punkte">
          <Frage frage="Wann werden die Punkte aktualisiert?">
            Automatisch alle 5 Minuten, solange Spiele laufen. Zwischenstände können sich deshalb
            noch ändern — endgültig sind die Zahlen erst nach Abpfiff.
          </Frage>
          <Frage frage="Wie funktionieren die Bonuspunkte?">
            Nach jeder Partie schaut Angeli auf die Ratings aller Eingesetzten: Der Bestbewertete
            erhält <b>+3</b>, der Zweite <b>+2</b>, der Dritte <b>+1</b> — zusätzlich zu den
            normalen Punkten, und beim Captain verdoppelt wie alles andere. Bei Gleichstand
            teilen sich Spieler den Rang: Stehen zwei gemeinsam zuoberst, bekommen beide +3, und
            der Nächstbeste ist Dritter (+1). Beispiel Spieltag 1, YB 4:2 Sion: Essende (Rating
            8.9) +3, Sanches (7.9) +2, Fernandes (7.6) +1. Der Bonus erscheint erst nach Abpfiff
            der Partie und gilt ab Spieltag {BONUS_AB_SPIELTAG}.
          </Frage>
          <Frage frage="Was bedeutet das Rating in den Statistiken?">
            Eine Bewertung der Datenquelle zur Leistung im Spiel (etwa 6.0 bis 10.0). Sie
            entscheidet über die <b>Bonuspunkte</b> (Top 3 jeder Partie) und die automatischen{" "}
            <b>Preisanpassungen</b> — in die normalen Ereignispunkte (Tore, Assists, Karten …)
            fliesst sie nicht ein.
          </Frage>
          <Frage frage="Die Punkte eines Spielers stimmen nicht. Was nun?">
            Melde es dem Admin — dazu oben <b>rechts im Menü</b> auf deinen Kontonamen tippen und
            auf der{" "}
            <Link href="/profil" className="font-semibold text-brand-magenta underline">
              Profilseite
            </Link>{" "}
            das Meldeformular nutzen. Die Daten stammen von einem externen Anbieter und sind
            selten, aber nicht nie fehlerhaft. Eigentore etwa liefert die Schnittstelle gar nicht
            — die trägt der Admin von Hand nach. Korrekturen wirken rückwirkend auf die Rangliste.
          </Frage>
        </Gruppe>

        <Gruppe titel="Kader und Markt">
          <Frage frage="Warum hat ein Spieler eine farbige Markierung?">
            <b className="text-amber-500">Gelb</b> heisst fraglich — verletzt, gesperrt oder
            angeschlagen. <b className="text-brand-magenta">Rot</b> heisst, der Spieler fällt aus,
            etwa nach einem Vereinswechsel oder bei einer Langzeitverletzung. Markierte Spieler
            bleiben aufstellbar und punkten normal; die Markierung ist eine Warnung, keine Sperre.
          </Frage>
          <Frage frage="Warum hat sich der Preis eines Spielers geändert?">
            Preise folgen der Leistung automatisch: Zwei Runden in Folge mit starkem Rating heben
            den Preis, zwei schwache senken ihn. Hast du den Spieler vor einem Anstieg gekauft,
            behältst du deinen Einkaufspreis — deshalb kann dein Teamwert über das Startbudget
            hinauswachsen.
          </Frage>
          <Frage frage="Ich bin erst mitten in der Saison dazugestossen. Habe ich noch eine Chance?">
            Ja. Deine erste Runde ist transferfrei, du baust dein Team also ohne Strafpunkte auf.
            <br />
            <br />
            Steigst du <b>innerhalb der ersten 5 Runden</b> ein, erhältst du zusätzlich die bis
            dahin <b>durchschnittlich erspielten Punkte</b> gutgeschrieben — du startest also
            nicht bei null, während die anderen schon vorgelegt haben. Melde dich dafür beim
            Admin: oben <b>rechts im Menü</b> auf deinen Kontonamen tippen und auf der{" "}
            <Link href="/profil" className="font-semibold text-brand-magenta underline">
              Profilseite
            </Link>{" "}
            schreiben.
          </Frage>
        </Gruppe>

        <Gruppe titel="Konto">
          <Frage frage="Wie ändere ich meinen Accountnamen oder mein Passwort?">
            Oben <b>rechts im Menü</b> auf deinen Namen tippen. Auf der{" "}
            <Link href="/profil" className="font-semibold text-brand-magenta underline">
              Profilseite
            </Link>{" "}
            kannst du beides ändern und dein Konto bei Bedarf auch löschen.
          </Frage>
          <Frage frage="Wie speichere ich das Spiel als App auf dem Handy?">
            iPhone: in Safari auf Teilen tippen, dann «Zum Home-Bildschirm». Android: in Chrome
            aufs Menü (⋮) tippen, dann «Zum Startbildschirm hinzufügen». Danach verhält es sich
            wie eine installierte App, ganz ohne App Store.
          </Frage>
          <Frage frage="Etwas anderes ist unklar. Wie erreiche ich den Admin?">
            Oben <b>rechts im Menü</b> auf deinen Kontonamen tippen und auf der{" "}
            <Link href="/profil" className="font-semibold text-brand-magenta underline">
              Profilseite
            </Link>{" "}
            eine Nachricht schreiben.
          </Frage>
        </Gruppe>
      </div>
    </main>
  );
}
