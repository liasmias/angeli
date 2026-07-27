# Angeli — Swiss League Fantasy

Fantasy-Football-App für die Swiss Super League 26/27 — FPL-artig: Budget-Kader
aus 15 Spielern, wöchentliche Aufstellung mit Kapitän, limitierte Transfers pro
Spieltag, automatischer Punkte-Sync via API-Football, Admin-Tool für manuelle
Korrekturen.

## Stack

- **Next.js 16** (App Router, Server Actions) — Frontend + Backend
- **Supabase** (Postgres + Auth) — Datenbank, Login, Row Level Security
- **Vercel** — Hosting + Cron
- **API-Football** (api-sports.io) — Live-Spielerstatistiken

## 1. Supabase-Projekt einrichten

1. Neues Projekt auf [supabase.com](https://supabase.com) erstellen (Free- oder
   Pro-Tier reicht für 50-500 Nutzer).
2. Im SQL-Editor den Inhalt von [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   einmal komplett ausführen. Das legt alle Tabellen, Views, Trigger und RLS-Policies an.
3. Unter **Project Settings → API** die drei Werte für `.env.local` kopieren
   (siehe unten): `Project URL`, `anon public` Key, `service_role` Key.
4. In `league_settings` (Tabelle mit genau einer Zeile, `id = 1`) die Saison-
   Parameter setzen (Budget, Kadergrösse, Slots pro Position, Transferkosten).
   Falls die Zeile noch fehlt, einmalig per SQL-Editor einfügen.
5. Clubs, Spieler und Spieltage (`gameweeks`) importieren — entweder manuell
   über den Table Editor oder per SQL-Insert. Pro Spieltag: `season`, `number`,
   `deadline` (Zeitpunkt, ab dem Transfers gesperrt werden).

## 2. API-Football einrichten

1. Account auf [api-football.com](https://www.api-football.com/) anlegen und
   einen Plan wählen, der `/fixtures` und `/fixtures/players` abdeckt.
2. Die Liga-ID der Swiss Super League herausfinden:
   ```
   GET https://v3.football.api-sports.io/leagues?search=Switzerland
   Header: x-apisports-key: <dein-key>
   ```
   Aus der Antwort die `league.id` für "Swiss Super League" notieren.
3. `clubs.api_football_team_id` und `players.api_football_player_id` in
   Supabase mit den entsprechenden IDs aus `/teams` bzw. `/players` befüllen —
   ohne diese Zuordnung kann der Cron-Sync Spieler nicht matchen.

**Bekannte Einschränkung:** Die API liefert keine Eigentore. Diese müssen im
Admin-Panel manuell pro Spieler/Spieltag eingetragen werden.

## 3. Umgebungsvariablen

`.env.local.example` nach `.env.local` kopieren und ausfüllen:

```bash
cp .env.local.example .env.local
```

| Variable | Woher |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (geheim halten!) |
| `API_FOOTBALL_KEY` | api-football.com Dashboard |
| `API_FOOTBALL_BASE_URL` | i.d.R. `https://v3.football.api-sports.io` |
| `API_FOOTBALL_LEAGUE_ID` | siehe Schritt 2 oben |
| `CRON_SECRET` | Zufälliger String, z. B. `openssl rand -base64 32` |

## 3b. Bot-Schutz bei der Registrierung (Cloudflare Turnstile, optional)

Ohne E-Mail-Bestätigung könnten Bots massenhaft Accounts anlegen. Cloudflare
Turnstile ist ein kostenloser CAPTCHA-Ersatz, der Registrierung und Login
schützt (für echte Nutzer meist unsichtbar). Solange kein Site-Key gesetzt
ist, bleibt der Schutz inaktiv und die Formulare laufen normal.

Einrichten:

1. Auf [dash.cloudflare.com](https://dash.cloudflare.com/) → **Turnstile** →
   **Add site**. Domain deiner App eintragen (für lokale Tests zusätzlich
   `localhost`). Widget-Typ „Managed" wählen.
2. Cloudflare liefert zwei Schlüssel:
   - **Site Key** (öffentlich) → in `.env.local` bzw. Vercel als
     `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - **Secret Key** (geheim) → **nicht** in die App, sondern in Supabase:
     **Auth → Bot & Abuse Protection → Enable CAPTCHA protection**, Provider
     „Turnstile", Secret eintragen.
3. Beides gehört zusammen: Erst wenn Site-Key gesetzt **und** CAPTCHA in
   Supabase aktiviert ist, greift der Schutz. Nur eins von beiden führt zu
   fehlschlagenden Logins — daher zusammen ausrollen.

## 4. Lokal entwickeln

```bash
npm install
npm run dev
```

App läuft auf [http://localhost:3000](http://localhost:3000).

## 5. Admin-Rechte vergeben

Es gibt bewusst keinen Weg, sich selbst zum Admin zu machen (Sicherheit gegen
Rechte-Eskalation). Nach der ersten Registrierung manuell in Supabase per
SQL-Editor:

```sql
update profiles set role = 'admin' where username = 'dein-username';
```

Danach ist unter `/admin` das Gameweek-Management sichtbar: Spieltage
sperren/entsperren, Statistiken pro Spieler überschreiben, Punkte neu
berechnen.

## 6. Deployment (Vercel)

1. Repo mit Vercel verbinden, alle Variablen aus Schritt 3 in den Vercel
   Project Settings unter **Environment Variables** eintragen.
2. `vercel.json` ist bereits vorhanden und registriert den Cron-Job
   `/api/cron/sync` (alle 15 Minuten).
   ⚠️ **Vercel Hobby-Plan führt Cron-Jobs nur einmal täglich aus** — für
   Live-Updates während laufender Spiele wird der Pro-Plan (~20 USD/Monat)
   benötigt. Mit Hobby reicht es trotzdem, wenn Ergebnisse bis zum nächsten
   Tag synchronisiert sein müssen.
3. Deploy auslösen — fertig.

## Wie der Punkte-Sync funktioniert

- Der Cron-Job (`src/app/api/cron/sync/route.ts`) synchronisiert immer nur den
  **aktuellsten gesperrten Spieltag** (der mit der höchsten Nummer, dessen
  Deadline verstrichen ist), um das API-Kontingent zu schonen.
- Rohdaten landen in `player_stats`. Admin-Korrekturen leben separat in
  `player_stats_overrides` und werden beim Berechnen der Punkte
  (`src/lib/gameweek-scoring.ts`) darübergelegt — ein Sync überschreibt also
  nie eine manuelle Korrektur.
- Eigentore kommen nie aus dem Sync und müssen immer manuell im Admin-Panel
  gesetzt werden.
