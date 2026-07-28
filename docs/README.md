# Dokumentation

`Angeli-Technische-Dokumentation.pdf` beschreibt Aufbau, Spielregeln, Datenmodell
und Betrieb vollständig — detailliert genug, um das Spiel von Grund auf nachzubauen.

Die HTML-Datei daneben ist die Quelle. Zum Neuerzeugen des PDF:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer \
  --print-to-pdf=docs/Angeli-Technische-Dokumentation.pdf \
  "file://$(pwd)/docs/Angeli-Technische-Dokumentation.html"
```

Die Grafiken sind eingebettetes SVG, es gibt keine externen Abhängigkeiten.
