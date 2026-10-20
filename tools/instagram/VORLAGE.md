# Instagram-Vorlage — Angeli

Verbindliche Gestaltung für alle Instagram-Posts. Grundlage ist der Post
„Top 11 · Gameweek 2". Alle Masse in Pixeln auf der Leinwand 1080 × 1440
(Hochformat 3:4). Umgesetzt in `basis.py` — neue Posts bauen darauf auf und
setzen nur ihren Inhalt ein.

## Leinwand und Karte

| Element | Wert |
|---|---|
| Leinwand | 1080 × 1440 |
| Hintergrund | Verlauf 115°: `#0a2e19` → `#145c30` (60 %) → `#082616`; Licht oben rechts `rgba(142,242,168,.30)`, unten links `rgba(130,150,180,.30)` |
| Karte | 829 × 1085, mittig, Fläche `#f3f6f3` |
| Ecken der Karte | gefast, 23 px |
| Schrift | Space Grotesk (400–700) |
| Sprache | Englisch |

## Kopf

| Element | Position | Gestaltung |
|---|---|---|
| Kicker (z. B. „GAMEWEEK 1–10") | links 33, oben 31 | Pille 24 px hoch, `#ff7dff`, Text `#0a2e19`, 12 px, fett, Sperrung .12em, Versalien |
| Titel (z. B. „Top 11") | links 31, oben 64 | 47 px, fett, Laufweite −.03em, `#0a2e19` |
| Unterzeile | links 33, oben 114 | 15 px, `rgba(10,46,25,.55)` |
| Kennzahl oben rechts | rechts 33, oben 34 | Zahl 56 px fett, Verlauf `#c21fc2` → `#8a3f9a` → `#2c6a45`; Etikett 10 px fett, Sperrung .16em, `rgba(10,46,25,.5)` |

## Inhaltsfläche

Links 23, rechts 23, oben 153, Höhe 869, Ecken gefast 19 px.

**Spielfeld** (Top 11): Streifen `#09a849` / `#0b9a43` à 68 px. Linien 2 px
`rgba(255,255,255,.32)`: Aussenlinie 17 px seitlich und 8 px oben/unten
eingerückt, Strafraum oben 297 × 105, Mittelkreis 213 px unten angeschnitten.

**Listen** (Preisänderungen u. ä.): weisse Felder mit gefasten Ecken (14 px)
direkt auf der Kartenfläche.

## Spieler

| Element | Gestaltung |
|---|---|
| Trikot | 92 px (Liste: 52 px), Schlagschatten `drop-shadow(0 6px 7px rgba(0,0,0,.38))` |
| Punkteblase | `#ff7dff`, Zahl `#0a2e19` 15 px fett, weisser Ring 2.5 px, Kreis ≥ 33 px |
| Namensschild | 135 px breit; oben weiss, Name 13.5 px fett `#0a2e19`; unten `#0d2e1a`, „CLUB · POS · Preis" 10.5 px weiss |
| Spaltenabstand | 146 px je Spieler |
| Namen | wie in der App: nur Nachname, Initiale nur bei doppelten Nachnamen |

## Wertänderungen (Badges)

Gefast 6 px. Anstieg: `#8ef2a8` mit `#0a2e19`. Rückgang: `#ff7dff` mit `#0a2e19`.

## Fuss

Unten 23, links/rechts 33. Links Logo (19 × 18, `#0a2e19`) und
„Angeli — Swiss League Fantasy" 16 px fett. Rechts „angeli-fantasy.org"
13 px, `rgba(10,46,25,.5)`.

## Regeln

- Gleichstände an einer Grenze nie willkürlich abschneiden: entweder alle
  Gleichplatzierten zeigen oder die Grenze davor setzen.
- Trikots immer aus `public/jerseys/` — dieselben Bilder wie in der App.
- Keine Vereinslogos, keine Spielerfotos.

## Bedienung

```bash
node tools/instagram/daten.mjs top11 1 10   # Top 11 über die Runden 1–10 (oder: top11 7 für eine Runde)
python3 tools/instagram/top11.py

node tools/instagram/daten.mjs preise       # Preisänderungen seit Saisonstart
python3 tools/instagram/preise.py
```

Bilder landen in `tools/instagram/ausgabe/` (nicht im Repository).

Ein neuer Post-Typ ist eine eigene Datei nach dem Muster von `preise.py`:
Daten laden, Inhalts-HTML und -CSS bauen, `rendern()` aufrufen. Leinwand,
Karte, Kopf, Kennzahl und Fuss nicht neu bauen — sie kommen aus `basis.py`.
