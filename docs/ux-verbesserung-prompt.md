# Prompt: UX-Verbesserungen Angeli

> Diesen Text komplett in eine neue Claude-Code-Session im Ordner `fantasy-super-league` einfügen.

---

Nutze den Skill **impeccable** und setze die Befunde aus `docs/ux-audit-2026-11-07.md` um. Lies den Bericht zuerst vollständig.

## Rahmen

- **Nur Verfeinerung, kein Redesign.** Gestaltung, Farben, Schrift (Space Grotesk), `chamfer`-/`fase-knopf`-Formen, Texte und Funktionen bleiben erhalten.
- **Code-Stil:** deutsche Namen und Kommentare wie im bestehenden Code, Tailwind-Klassen, Variablen aus `src/app/globals.css`.
- **Vor jeder UI-Änderung** `reference/craft-floor.md` aus dem Skill lesen.
- **Mobile zuerst:** Nach jedem Block im Browser-Panel bei 375 px und 1280 px prüfen (`.claude/launch.json` → `dev`). Login lokal ist wegen Cloudflare nicht möglich. Eingeloggte Seiten deshalb im Code prüfen und mir sagen, was ich live testen soll.
- **Next.js:** Laut `AGENTS.md` weicht diese Next.js-Version von bekannten APIs ab. Vor Code-Änderungen die passende Doku in `node_modules/next/dist/docs/` lesen.
- **Ein Commit pro Block**, nicht pushen. Am Ende `npm run lint` und `npm run build` ausführen.

## Block 00 – Wertung und Cron (Code-Review C1–C3, C7, C8) – zuerst

1. **C1:** In `src/app/api/cron/sync/route.ts:330–332` zählen verschobene, abgesagte oder abgebrochene Partien (PST, CANC, ABD, AWD, WO) als „offen“. Dadurch laufen Auto-Einwechslung, Vize-Captain und Preisänderung für die Runde nie.
   - Diese Status als abgeschlossen für die Runde behandeln.
   - Prüfen, ob die gezählten Partien dann noch stimmen.
   - Einen Test mit einer verschobenen Partie ergänzen, falls es Tests gibt.
2. **C2:** Die Minuten für Auto-Einwechslung und Captain-Übergabe (`route.ts:443–450`) müssen die Korrekturen aus `player_stats_overrides` berücksichtigen, genau wie `lib/gameweek-scoring.ts:46`. Am besten beide Stellen auf eine gemeinsame Hilfsfunktion umstellen.
3. **C3:** Captain-Übergabe (`route.ts:476–487`) und Einwechslungen (`505–518`) pro Kader atomar schreiben, zum Beispiel per neuer SQL-Funktion wie `kader_speichern` (Migration 0026). Fehler dabei protokollieren.
4. **C7:** `src/app/team/actions.ts:97`: Statt der ganzen `players`-Tabelle nur die abgegebenen Spieler laden (`.in("id", …)`).
5. **C8:** Den Rollover der Aufstellungen (`route.ts:167–206`) mit einer gesammelten Abfrage und einem einzigen Insert umsetzen statt mit Einzelabfragen pro Kader.

Neue Migrationen nur anlegen, nicht anwenden. Mir sagen, was ich in Supabase ausführen muss.

## Block 0 – iPhone-Sofort-Fixes (P1-5, P2-12, P2-13)

1. `src/components/feld.tsx:48`: Das `<select>` von `text-[15px]` auf `text-base` (16 px) setzen, ab `sm:` bleibt `text-sm`. Sonst zoomt iOS Safari beim Antippen von Preis, Club und Sortierung hinein.
2. `TeamBuilder.tsx:1435` und `:1545`: `max-h-[85vh]` durch `max-h-[85dvh]` ersetzen.
3. Feld „Accountname“ in `SignupForm.tsx` und das Bestätigungsfeld in `ProfilFormulare.tsx:131`: `autoComplete="username"` (bzw. `"off"` beim Bestätigungsfeld), `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`.

## Block 1 – Dialoge, Gesten, Konten (P1-2, C5, C6, P2-8)

1. `src/app/team/PastGameweek.tsx:66–74`: Den Dialog auf `useSheet` aus `src/lib/use-sheet.ts` umstellen, genauso wie es `TeamBuilder.tsx:662–664` macht. Danach muss gelten:
   - Escape schließt den Dialog.
   - Der Fokus geht beim Öffnen in den Dialog.
   - Der Fokus kehrt beim Schließen zum auslösenden Spieler-Button zurück.
   - Die Zurück-Taste schließt den Dialog.
2. **C5:** In `src/lib/use-sheet.ts:154` darf `touchcancel` das Sheet nicht schließen. Bei einem Abbruch immer zurückschnappen (`setzen(0)`), also einen eigenen Handler statt `ende` verwenden.
3. **C6:** Accountnamen ohne Unterscheidung von Groß- und Kleinschreibung eindeutig machen.
   - Migration mit eindeutigem Index auf `lower(username)` anlegen.
   - Vorher prüfen, ob es schon Dubletten gibt, und mir diese nennen.
   - Die Prüfungen in `signup/actions.ts` und `profil/actions.ts` (`changeUsername`) entsprechend per `ilike` anpassen.
4. In `/profil` bekommen das Feld „Accountname“ und das Textfeld „Dem Admin etwas melden“ ein echtes `<label>` (darf visuell versteckt sein) oder ein `aria-label`.

## Block 2 – Lesbarkeit (P1-1, P2-7)

1. Alle `text-[8px]` bis `text-[11px]` auf mindestens 12 px anheben (`text-xs`). Schwerpunkte sind `TeamBuilder.tsx` (55×) und `PastGameweek.tsx` (11×), dazu `profil`, `StatsTable.tsx`, `fixtures/page.tsx` und der Footer.
   - Wo es dann eng wird, die Information verdichten statt die Schrift wieder kleiner zu machen. Beispiele:
     - Spielernamen unter Trikots kürzen.
     - In `/stats` die Metadaten-Zeile auf „YB · FWD · 10.0“ reduzieren und Form/Trend nur ab `sm:` zeigen.
2. Sekundärtexte müssen mindestens 4.5:1 Kontrast erreichen:
   - Kaderstand in der mobilen Leiste (`text-white/60`, `TeamBuilder.tsx:~2116`).
   - Platzhalter „Team suchen…“ (2.9:1).
   - Strich-Platzhalter „–“ (3.6:1).
   - Weiß auf dem hellen Ende von `brand-gradient` (2.2:1 auf `/leaderboard`, 4.0:1 in der Nav). Den Verlauf hinter Text dunkler auslaufen lassen oder den Text dort dunkel setzen.
3. Kopfkarte im TeamBuilder: Labels nicht abschneiden („Gesamtpu…“), „SPT“ und „OPT“ ausschreiben oder verständlich machen.

## Block 3 – Touch-Ziele (P1-4)

Alle Ziele mindestens 44×44 px, über Padding oder `min-h-11`. Wo das optisch nicht passt, den Klickbereich per Pseudo-Element vergrößern.

| Bereich | Element | heute |
|---|---|---|
| Header | „EN“ | 35×24 px |
| Header | Burger-Menü | 40×40 px |
| Header | Logo-Link | 28 px hoch |
| Footer | „Impressum & Datenschutz“ | 14 px hoch |
| `/` | „How to play ↓“ | 20 px hoch |
| `/stats` | Sortierköpfe | 16 px hoch |
| `/fixtures` | „Beste Spieler anzeigen ▾“ (`<summary>`) | 25 px hoch |
| `/fixtures` | Torschützen-Chips | 20 px hoch |
| `/leaderboard` | Tabs „Gesamt/Spieltag“ | 32 px hoch |
| `/team` | Spieltag-Pfeile ‹ › | 36×36 px |
| `/squad` | „← Zurück zur Rangliste“ | unter 24 px |

## Block 4 – Nichts verdecken (P1-3)

1. Der Speichern-Button ab `lg` (`TeamBuilder.tsx:~2081`, `sticky bottom-4`) darf keine Spieler überdecken.
   - Entweder dem Spielfeld unten genug Padding geben, damit die letzte Reihe frei bleibt.
   - Oder den Button in eine Leiste unter bzw. neben dem Feld setzen.
2. Meldungen (`TeamBuilder.tsx:~1575, ~1589`, `bottom-28` / `lg:bottom-20`) dürfen nicht mitten über dem Feld liegen. Sie sollen oben unter dem Header erscheinen oder bündig über der mobilen Aktionsleiste, ohne Spieler zu verdecken. Antippen schließt sie.

## Block 5 – Smoothness (P2-1, P2-3, P2-4, P2-6)

1. **Scroll-Sprung:** Beim Ein- und Auswechseln sowie bei „Verwerfen“ darf sich die Scroll-Position nicht ändern (heute 0 → 208 px).
   - Ursache finden: Fokus auf ein neues Element ohne `preventScroll`, `scrollIntoView` oder Layoutwechsel.
   - Fix: Ursache beheben, notfalls die Position merken und wiederherstellen.
2. **Spieltagwechsel** (‹ ›): Die Überschrift wechselt sofort auf den neuen Spieltag. Bis die Daten da sind (~1 s), zeigen Kopfkarte und Feld den bestehenden Skelett-Zustand (`components/skelett.tsx`) oder werden gedimmt, statt alte Daten zu zeigen.
3. **Deaktivierter Speichern-Button:** Er muss deutlich als inaktiv erkennbar sein, zum Beispiel neutral bzw. outline statt Magenta. Der aktive Zustand („bitte speichern“) bleibt kräftig Magenta.
4. **Seiteneintritt** `seite-rein` in `globals.css`: 350 ms auf etwa 180 ms kürzen, und nur `transform` bzw. eine kleine Verschiebung animieren statt Deckkraft ab 0, damit Seiten nicht blass erscheinen. `prefers-reduced-motion` weiter respektieren.
5. **`--kurve-pop`** (`globals.css:161`): Überschwingen entfernen, zum Beispiel mit `cubic-bezier(0.22, 1, 0.36, 1)`.

## Block 6 – Spielermarkt (P2-5, P2-9, P3)

1. Nicht alle 382 Zeilen auf einmal rendern: zuerst rund 50 Zeilen und mehr beim Scrollen nachladen, zum Beispiel per IntersectionObserver. Keine neue schwere Bibliothek ohne Rückfrage.
2. Filter entschlacken:
   - Sichtbar bleiben Positions-Chips, Suche und „Bezahlbar“.
   - Club, Preisstufen und Sortierung kommen hinter einen Button „Filter“, mit Zähler der aktiven Filter.
   - Vorher kurz mit mir abstimmen.
3. Leerzustand „Keine Spieler gefunden.“ um einen Button „Filter zurücksetzen“ ergänzen.

## Block 6b – Konsistenz (ui-taste, P2-10, P2-11)

1. **Regel für Eckenformen.** Vorher mit mir abstimmen.
   - Aktionen und Karten sind `chamfer` / `fase-knopf`.
   - Eingabefelder und Kacheln bekommen `rounded-lg`.
   - Runde Icon-Knöpfe und Badges bekommen `rounded-full`.
   - `rounded`, `rounded-md`, `rounded-xl`, `rounded-2xl` und `rounded-[1.5rem]` auf eine dieser drei Formen umstellen.
   - Die Regel als Kommentar oben in `globals.css` festhalten.
2. **Markenfarben statt Standardfarben.**
   - Für `emerald-*` und `amber-*` (41 Stellen) Variablen in `globals.css` anlegen, etwa `--status-ok` und `--status-warnung` mit Hintergrund- und Textvariante, und überall verwenden.
   - `zinc-*` (15 Stellen) durch `brand-deep/xx` ersetzen.
3. **Druck-Feedback.**
   - `.pressable:active` von `scale(0.93)` auf `scale(0.97)` und Hover von `scale(1.045)` auf `scale(1.02)` setzen.
   - `.pressable-subtle:active` auf Listenzeilen: statt Skalieren den Hintergrund hervorheben.
4. **Emoji-Symbole durch kleine einfarbige SVG-Icons ersetzen.**
   - `👥` im Spielermarkt (`TeamBuilder.tsx:568`).
   - `🚀` beim Bench Boost (`TeamBuilder.tsx:30`, Regeln).
   - `🍀` in der Meldung bleibt.
5. „Login“ und „Einloggen“ vereinheitlichen, nur noch „Einloggen“ verwenden.

## Block 7 – Kleinigkeiten (P3)

- `app/page.tsx:37`: Verlaufstext „Swiss League Fantasy“ durch einfarbiges `text-brand-lime` ersetzen. **Vorher fragen**, das ist Geschmackssache.
- Cloudflare-Turnstile (`components/turnstile.tsx`): Platzhalter mit fester Höhe (65 px), damit Login, Registrierung und Profil nicht springen.

## Abschluss

1. `/impeccable polish` über die geänderten Dateien laufen lassen.
2. `/impeccable audit` erneut laufen lassen und die Punkte mit vorher vergleichen (Audit 14/20, Heuristiken 26/40).
3. **Kurze Zusammenfassung an mich:**
   - Was pro Block geändert wurde.
   - Was live mit Login noch zu testen ist: `PastGameweek`-Dialog, Scroll-Sprung, Spieltagwechsel, Spielermarkt auf dem Handy, Wischen zum Schließen.
   - Welche Migrationen ich in Supabase anwenden muss.
   - Welche Entscheidungen offen sind.
