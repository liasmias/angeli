"""Grundgerüst aller Instagram-Posts — Masse und Farben siehe VORLAGE.md.

Ein Post liefert nur seinen Inhalt (HTML + CSS für die Inhaltsfläche);
Leinwand, Karte, Kopf und Fuss kommen von hier, damit alles gleich aussieht.
"""
import base64, pathlib, subprocess

PROJEKT = pathlib.Path(__file__).resolve().parents[2]
AUSGABE = pathlib.Path(__file__).parent / "ausgabe"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

LOGO = ('<svg viewBox="0 0 319.9 302.69" fill="#0a2e19" width="19" height="18">'
        '<path d="M319.9,0v17.22H20.08v285.47H0V8.28C0,3.71,3.71,0,8.28,0h311.62Z"/>'
        '<path d="M9.45,20.15v20.88l44.78,13.28v59.97l-44.78,13.28v20.88l165.25-50.55c3.45-1.05,5.8-4.24,'
        '5.8-7.84v-11.63c0-3.54-2.31-6.66-5.69-7.7L9.45,20.15ZM73.84,108.47v-48.34l81.5,24.17-81.5,24.17Z"/></svg>')


def fase(px):
    """clip-path für gefaste Ecken — dieselbe Form wie in der App."""
    return (f"polygon({px}px 0,calc(100% - {px}px) 0,100% {px}px,100% calc(100% - {px}px),"
            f"calc(100% - {px}px) 100%,{px}px 100%,0 calc(100% - {px}px),0 {px}px)")


def trikot(club):
    """Trikot als data-URL aus public/jerseys — dieselben Bilder wie die App."""
    pfad = PROJEKT / "public" / "jerseys" / f"{club}.png"
    return "data:image/png;base64," + base64.b64encode(pfad.read_bytes()).decode()


GRUND_CSS = f"""
* {{ margin:0; padding:0; box-sizing:border-box }}
body {{ width:1080px; height:1440px; overflow:hidden; font-family:"Space Grotesk",sans-serif;
  display:flex; align-items:center; justify-content:center;
  background:
    radial-gradient(ellipse 80% 60% at 85% 8%, rgba(142,242,168,.30), transparent),
    radial-gradient(ellipse 60% 50% at 8% 92%, rgba(130,150,180,.30), transparent),
    linear-gradient(115deg,#0a2e19 0%,#145c30 60%,#082616 100%); }}
.karte {{ width:829px; height:1085px; background:#f3f6f3; position:relative; clip-path:{fase(23)} }}
.kicker {{ position:absolute; left:33px; top:31px; height:24px; padding:0 13px; display:flex; align-items:center;
  background:#ff7dff; color:#0a2e19; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:.12em;
  text-transform:uppercase }}
h1 {{ position:absolute; left:31px; top:64px; font-size:47px; font-weight:700; letter-spacing:-.03em;
  color:#0a2e19; line-height:1 }}
.sub {{ position:absolute; left:33px; top:114px; font-size:15px; color:rgba(10,46,25,.55) }}
.kennzahl {{ position:absolute; right:33px; top:34px; text-align:right }}
.kennzahl b {{ display:block; font-size:56px; line-height:.9; font-weight:700; letter-spacing:-.04em;
  background:linear-gradient(100deg,#c21fc2 0%,#8a3f9a 45%,#2c6a45 100%);
  -webkit-background-clip:text; background-clip:text; color:transparent }}
.kennzahl span {{ display:block; margin-top:8px; font-size:10px; font-weight:700; letter-spacing:.16em;
  color:rgba(10,46,25,.5) }}
.inhalt {{ position:absolute; left:23px; right:23px; top:153px; height:869px }}
.fuss {{ position:absolute; left:33px; right:33px; bottom:23px; display:flex; align-items:center;
  justify-content:space-between }}
.marke {{ display:flex; align-items:center; gap:10px; font-size:16px; font-weight:700; color:#0a2e19 }}
.url {{ font-size:13px; color:rgba(10,46,25,.5) }}
.trikot-schatten {{ filter:drop-shadow(0 6px 7px rgba(0,0,0,.38)) }}
"""


def rendern(*, name, kicker, titel, unterzeile, inhalt_html, inhalt_css="", kennzahl=None, kennzahl_etikett=""):
    """Baut den Post und speichert ihn als PNG unter tools/instagram/ausgabe/<name>.png."""
    AUSGABE.mkdir(exist_ok=True)
    zahl = (f'<div class="kennzahl"><b>{kennzahl}</b><span>{kennzahl_etikett}</span></div>'
            if kennzahl is not None else "")
    html = f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{GRUND_CSS}{inhalt_css}</style></head><body>
<div class="karte">
  <div class="kicker">{kicker}</div>
  <h1>{titel}</h1>
  {zahl}
  <div class="sub">{unterzeile}</div>
  <div class="inhalt">{inhalt_html}</div>
  <div class="fuss"><div class="marke">{LOGO}<span>Angeli — Swiss League Fantasy</span></div>
    <span class="url">angeli-fantasy.org</span></div>
</div></body></html>"""
    seite = AUSGABE / f"{name}.html"
    ziel = AUSGABE / f"{name}.png"
    seite.write_text(html)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                    "--window-size=1080,1440", "--virtual-time-budget=5000", f"--screenshot={ziel}",
                    f"file://{seite}"], check=True, capture_output=True)
    return ziel
