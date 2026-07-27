export const metadata = {
  title: "Impressum & Datenschutz — Angeli",
  description: "Kontakt, rechtliche Hinweise und Datenschutzerklärung für Angeli.",
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

export default function ImpressumPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-brand-deep">
        Impressum &amp; Datenschutz
      </h1>

      <div className="flex flex-col gap-4">
        <Abschnitt titel="Kontakt">
          <p>
            Angeli — Swiss League Fantasy ist ein privates, nicht-kommerzielles Fan-Projekt.
            Verantwortlich für Betrieb und Inhalt:
          </p>
          <p>
            E-Mail:{" "}
            <a href="mailto:spaetzliblitz@gmail.com" className="font-semibold text-brand-magenta">
              spaetzliblitz@gmail.com
            </a>
          </p>
        </Abschnitt>

        <Abschnitt titel="Rechtliche Hinweise">
          <p>
            Angeli ist ein <strong>inoffizielles Fan-Projekt</strong> und steht in keiner
            Verbindung zur Swiss Football League, deren Clubs oder Spielern. Genannte Club- und
            Spielernamen dienen ausschliesslich der sachlichen Bezeichnung im Rahmen des Spiels.
            Es werden keine offiziellen Logos, Wappen oder Spielerfotos verwendet.
          </p>
          <p>
            Die Teilnahme ist kostenlos. Es werden keine Einsätze erhoben und keine Geldgewinne
            ausgeschüttet.
          </p>
          <p>
            Spieldaten (Resultate, Statistiken) stammen von Drittanbietern und werden regelmässig
            automatisch aktualisiert. Für Richtigkeit und Vollständigkeit wird keine Gewähr
            übernommen; massgeblich sind die offiziellen Resultate der Liga. Offensichtliche
            Datenfehler korrigieren die Administratoren nach bestem Wissen.
          </p>
        </Abschnitt>

        <Abschnitt titel="Datenschutzerklärung">
          <p>
            <strong>Welche Daten wir bearbeiten.</strong> Für den Spielbetrieb speichern wir deinen
            Accountnamen, deine E-Mail-Adresse, dein Passwort (ausschliesslich verschlüsselt als
            Hash) sowie deine Spielstände (Kader, Aufstellungen, Transfers, Punkte). Beim Aufruf
            der Seite fallen zudem technische Zugriffsdaten an (z.&nbsp;B. IP-Adresse) — sie dienen
            der Auslieferung und Absicherung der Seite.
          </p>
          <p>
            <strong>Wofür.</strong> Login und Kontoverwaltung, Berechnung der Punkte, Anzeige der
            Rangliste sowie E-Mails zum Zurücksetzen des Passworts. Dein Accountname und deine
            Aufstellungen vergangener Spieltage sind für andere Mitglieder sichtbar — das ist Teil
            des Spiels. Deine E-Mail-Adresse ist nie öffentlich.
          </p>
          <p>
            <strong>Kein Tracking.</strong> Wir schalten keine Werbung, setzen keine Analyse- oder
            Marketing-Cookies und geben keine Daten zu Werbezwecken weiter. Verwendet werden nur
            technisch notwendige Cookies für die Login-Sitzung.
          </p>
          <p>
            <strong>Dienstleister.</strong> Für den Betrieb setzen wir folgende Auftragsbearbeiter
            ein, die Daten teilweise im Ausland bearbeiten: Supabase (Datenbank und
            Benutzerkonten), Vercel (Hosting und Auslieferung), Cloudflare Turnstile (Schutz vor
            automatisierten Anmeldungen) und Resend (Versand von System-E-Mails, etwa
            Passwort-Zurücksetzen).
          </p>
          <p>
            <strong>Aufbewahrung und Löschung.</strong> Deine Daten bleiben gespeichert, solange
            dein Konto besteht. Du kannst dein Konto jederzeit selbst unter „Mein Konto" endgültig
            löschen — damit werden auch Kader, Aufstellungen und Punkte entfernt. Für Auskunft,
            Berichtigung oder Löschung kannst du dich ausserdem jederzeit an{" "}
            <a href="mailto:spaetzliblitz@gmail.com" className="font-semibold text-brand-magenta">
              spaetzliblitz@gmail.com
            </a>{" "}
            wenden.
          </p>
          <p className="text-xs text-brand-deep/50">
            Stand: Juli 2026. Diese Erklärung wird angepasst, wenn sich der Dienst ändert.
          </p>
        </Abschnitt>
      </div>
    </main>
  );
}
