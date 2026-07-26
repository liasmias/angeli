#!/usr/bin/env python3
"""Berechnet Spielerpreise aus den Statistiken der Vorsaison (25/26).

Benötigt einen API-Football-Plan mit Zugriff auf Saison 2025.
Aufruf aus dem Projektordner:

    set -a && source .env.local && set +a && python3 scripts/recalc_prices.py

Logik:
- Saison-25/26-Statistiken pro Spieler laden (Super League 207; für Vaduz
  zusätzlich Challenge League 208, mit Abschlag).
- Daraus einen Punkte-Score nach unserem Fantasy-Scoring approximieren.
- Pro Position werden die Spieler nach Score gerankt und auf die Preisspanne
  verteilt (0.5er-Schritte):
      GK 4.0-5.5 · DEF 4.0-6.5 · MID 4.5-9.0 · FWD 4.5-10.0
- Spieler ohne Vorsaison-Daten erhalten den Positions-Basispreis und werden
  am Ende aufgelistet — im Admin-Panel (/admin/players) manuell nachjustieren.
"""

import json
import os
import sys
import time
import urllib.request

API_KEY = os.environ.get("API_FOOTBALL_KEY", "")
SB_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not API_KEY or not SB_URL or not SB_KEY:
    sys.exit("Env-Variablen fehlen — vorher `set -a && source .env.local && set +a` ausführen.")

LAST_SEASON = "2025"
PRICE_RANGES = {"GK": (4.0, 5.5), "DEF": (4.0, 6.5), "MID": (4.5, 9.0), "FWD": (4.5, 10.0)}
DEFAULT_PRICE = {"GK": 4.5, "DEF": 4.5, "MID": 5.0, "FWD": 5.5}
CHALLENGE_LEAGUE_DISCOUNT = 0.85  # Vaduz-Spieler: Punkte aus der Challenge League zählen weniger


def api_get(path, params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(
        f"https://v3.football.api-sports.io{path}?{query}",
        headers={"x-apisports-key": API_KEY},
    )
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
    errs = data.get("errors")
    if errs and (not isinstance(errs, list) or errs):
        sys.exit(f"API-Fehler: {errs}")
    return data


def sb(path, method="GET", payload=None):
    headers = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json",
    }
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(SB_URL + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        body = r.read()
        return json.loads(body) if body else None


def season_scores(league_id):
    """Aggregierter Fantasy-Score pro api_football_player_id für eine Liga/Saison."""
    scores = {}
    page = 1
    while True:
        data = api_get("/players", {"league": league_id, "season": LAST_SEASON, "page": page})
        for entry in data.get("response", []):
            pid = entry["player"]["id"]
            total = 0.0
            for s in entry.get("statistics", []):
                games = s.get("games", {}) or {}
                goals = s.get("goals", {}) or {}
                cards = s.get("cards", {}) or {}
                penalty = s.get("penalty", {}) or {}
                apps = games.get("appearences") or 0
                minutes = games.get("minutes") or 0
                avg_min = minutes / apps if apps else 0
                # Minutenpunkte: 2 bei ≥60 Min. Schnitt, sonst 1 pro Einsatz
                total += apps * (2 if avg_min >= 60 else 1)
                pos = (games.get("position") or "").lower()
                goal_value = 6 if pos in ("goalkeeper", "defender") else 5 if pos == "midfielder" else 4
                total += (goals.get("total") or 0) * goal_value
                total += (goals.get("assists") or 0) * 3
                total += (goals.get("saves") or 0) / 2
                total -= (goals.get("conceded") or 0) / 2 if pos in ("goalkeeper", "defender") else 0
                total -= (cards.get("yellow") or 0)
                total -= (cards.get("red") or 0) * 3
                total += (penalty.get("saved") or 0) * 5
                total -= (penalty.get("commited") or 0) * 2
            scores[pid] = scores.get(pid, 0.0) + total
        paging = data.get("paging", {})
        print(f"  Liga {league_id}: Seite {paging.get('current')}/{paging.get('total')}")
        if paging.get("current", 1) >= paging.get("total", 1):
            break
        page += 1
        time.sleep(0.4)
    return scores


def round_half(x):
    return round(x * 2) / 2


def main():
    print("Lade Vorsaison-Statistiken …")
    scores = season_scores(207)
    for pid, sc in season_scores(208).items():
        scores.setdefault(pid, sc * CHALLENGE_LEAGUE_DISCOUNT)

    players = sb("/rest/v1/players?select=id,last_name,position,api_football_player_id&is_active=eq.true")

    by_position = {}
    for p in players:
        by_position.setdefault(p["position"], []).append(p)

    unmatched = []
    updates = []
    for pos, group in by_position.items():
        lo, hi = PRICE_RANGES[pos]
        scored = [(p, scores.get(p["api_football_player_id"])) for p in group]
        with_score = sorted(
            (t for t in scored if t[1] is not None and t[1] > 0),
            key=lambda t: t[1],
        )
        for p, sc in scored:
            if sc is None or sc <= 0:
                unmatched.append((p, pos))
                updates.append((p["id"], DEFAULT_PRICE[pos]))
        n = len(with_score)
        for rank, (p, sc) in enumerate(with_score):
            # Rang-basierte Verteilung: bester Spieler = Maximum der Spanne
            frac = rank / (n - 1) if n > 1 else 1.0
            updates.append((p["id"], round_half(lo + (hi - lo) * frac)))

    print(f"\nSchreibe {len(updates)} Preise …")
    for player_id, price in updates:
        sb(f"/rest/v1/players?id=eq.{player_id}", "PATCH", {"price": price})

    print(f"\nFertig. {len(unmatched)} Spieler ohne Vorsaison-Daten (Basispreis gesetzt):")
    for p, pos in sorted(unmatched, key=lambda t: t[1]):
        print(f"  {pos}: {p['last_name']}")
    print("\nDiese Spieler im Admin-Panel (/admin/players) manuell prüfen.")


if __name__ == "__main__":
    main()
