"""Post: Top 11. Daten: node tools/instagram/daten.mjs top11 <von> [bis]"""
import json
from basis import AUSGABE, fase, rendern, trikot

D = json.loads((AUSGABE / "top11.json").read_text())
spieler = D["spieler"]
wert = sum(float(s["preis"]) for s in spieler)


def karte(s):
    return f"""<div class="slot">
      <div class="trikot"><img class="trikot-schatten" src="{trikot(s['club'])}"><span class="pkt">{s['pts']}</span></div>
      <div class="schild"><span class="name">{s['name']}</span>
        <span class="meta">{s['club']} · {s['pos']} · {float(s['preis']):.1f}m</span></div>
    </div>"""


reihen = "".join(
    f'<div class="reihe r{i}">{"".join(karte(s) for s in spieler if s["pos"] == p)}</div>'
    for i, p in enumerate(["GK", "DEF", "MID", "FWD"], 1)
)

CSS = f"""
.inhalt {{ overflow:hidden; clip-path:{fase(19)};
  background:repeating-linear-gradient(to bottom,#09a849 0,#09a849 68px,#0b9a43 68px,#0b9a43 136px) }}
.linie {{ position:absolute; left:17px; right:17px; top:8px; bottom:8px; border:2px solid rgba(255,255,255,.32) }}
.box {{ position:absolute; top:8px; left:50%; transform:translateX(-50%); width:297px; height:105px;
  border:2px solid rgba(255,255,255,.32); border-top:none }}
.kreis {{ position:absolute; left:50%; top:809px; transform:translateX(-50%); width:213px; height:213px;
  border:2px solid rgba(255,255,255,.32); border-radius:50% }}
.reihe {{ position:absolute; left:0; right:0; display:flex; justify-content:center }}
.r1 {{ top:74px }} .r2 {{ top:264px }} .r3 {{ top:454px }} .r4 {{ top:644px }}
.slot {{ width:146px; display:flex; flex-direction:column; align-items:center }}
.trikot {{ position:relative; width:92px; height:92px; margin-bottom:-6px }}
.trikot img {{ width:92px; height:92px; object-fit:contain; display:block }}
.pkt {{ position:absolute; top:-2px; right:-18px; min-width:33px; height:33px; padding:0 7px; border-radius:999px;
  background:#ff7dff; color:#0a2e19; font-size:15px; font-weight:700; display:flex; align-items:center;
  justify-content:center; box-shadow:0 0 0 2.5px rgba(255,255,255,.85) }}
.schild {{ margin-top:6px; width:135px; border-radius:4px; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,.18) }}
.name {{ display:block; background:#fff; padding:4px 6px 3px; text-align:center; font-size:13.5px; font-weight:700;
  color:#0a2e19; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }}
.meta {{ display:block; background:#0d2e1a; padding:3px 6px 4px; text-align:center; font-size:10.5px;
  font-weight:600; color:#fff; white-space:nowrap }}
"""

ziel = rendern(
    name="top11",
    kicker=D["kicker"],
    titel="Top 11",
    unterzeile=f"Formation {D['formation']} · Squad value {wert:.1f}m",
    kennzahl=D["gesamt"],
    kennzahl_etikett="POINTS",
    inhalt_html=f'<div class="linie"></div><div class="box"></div><div class="kreis"></div>{reihen}',
    inhalt_css=CSS,
)
print(ziel)
