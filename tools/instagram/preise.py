"""Post: grösste Preisänderungen. Daten: node tools/instagram/daten.mjs preise"""
import json
from basis import AUSGABE, fase, rendern, trikot

D = json.loads((AUSGABE / "preise.json").read_text())


def zeile(s, steigt):
    vorz = "+" if steigt else "−"
    return f"""<div class="zeile">
      <img class="trikot-schatten" src="{trikot(s['club'])}">
      <div class="wer"><b>{s['name']}</b><span>{s['club']} · {s['pos']}</span></div>
      <div class="preis"><span>{s['start']:.1f}</span><i>→</i><b>{s['jetzt']:.1f}</b></div>
      <div class="badge {'auf' if steigt else 'ab'}">{vorz}{abs(s['delta']):.1f}</div>
    </div>"""


def feld(titel, pfeil, liste, steigt):
    return f"""<section class="feld">
      <h2><span class="{'auf' if steigt else 'ab'}">{pfeil}</span>{titel}</h2>
      {''.join(zeile(s, steigt) for s in liste)}
    </section>"""


CSS = f"""
.inhalt {{ display:flex; flex-direction:column; gap:16px; padding:0 10px }}
.feld {{ background:#fff; clip-path:{fase(14)}; padding:4px 18px 8px }}
h2 {{ display:flex; align-items:center; gap:9px; height:42px; font-size:12px; font-weight:700;
  letter-spacing:.14em; color:rgba(10,46,25,.6); border-bottom:1px solid rgba(10,46,25,.08) }}
h2 span {{ display:flex; align-items:center; justify-content:center; width:20px; height:20px;
  clip-path:{fase(5)}; font-size:10px; color:#0a2e19 }}
h2 .auf {{ background:#8ef2a8 }} h2 .ab {{ background:#ff7dff }}
.zeile {{ display:flex; align-items:center; gap:14px; height:61px; border-bottom:1px solid rgba(10,46,25,.06) }}
.zeile:last-child {{ border-bottom:none }}
.zeile img {{ width:46px; height:46px; object-fit:contain; flex:none }}
.wer {{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px }}
.wer b {{ font-size:18px; font-weight:700; color:#0a2e19; white-space:nowrap }}
.wer span {{ font-size:12px; font-weight:600; color:rgba(10,46,25,.55); letter-spacing:.02em }}
.preis {{ display:flex; align-items:baseline; gap:7px; font-size:16px; font-variant-numeric:tabular-nums }}
.preis span {{ color:rgba(10,46,25,.5) }} .preis i {{ font-style:normal; color:rgba(10,46,25,.35) }}
.preis b {{ font-weight:700; color:#0a2e19 }}
.badge {{ width:64px; height:30px; display:flex; align-items:center; justify-content:center; clip-path:{fase(6)};
  font-size:15px; font-weight:700; color:#0a2e19; font-variant-numeric:tabular-nums }}
.badge.auf {{ background:#8ef2a8 }} .badge.ab {{ background:#ff7dff }}
"""

ziel = rendern(
    name="preise",
    kicker=f"GAMEWEEK 1–{D['bisRunde']}",
    titel="Price changes",
    unterzeile="Biggest risers and fallers since the start of the season",
    kennzahl=D["buchungen"],
    kennzahl_etikett="PRICE CHANGES",
    inhalt_html=feld("BIGGEST RISERS", "▲", D["auf"], True) + feld("BIGGEST FALLERS", "▼", D["ab"], False),
    inhalt_css=CSS,
)
print(ziel)
