#!/usr/bin/env python3
"""Importiert den kompletten Spielplan der Saison und legt fehlende Spieltage an.

Aufruf aus dem Projektordner:

    set -a && source .env.local && set +a && python3 scripts/import_fixtures.py

- Holt alle Fixtures der Saison (Regular Season) von API-Football.
- Legt fehlende gameweeks an: Deadline = frühester Anpfiff der Runde − 1 Stunde.
- Upsertet alle Fixtures inkl. Resultat (falls schon gespielt).

Hinweis: Die Split-Runden im Frühjahr (Championship/Relegation Round) haben
eigene Rundennamen und werden beim ersten Auftauchen separat ergänzt.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta

API_KEY = os.environ.get("API_FOOTBALL_KEY", "")
SB_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
LEAGUE_ID = os.environ.get("API_FOOTBALL_LEAGUE_ID", "207")
SEASON = "2026"

if not API_KEY or not SB_URL or not SB_KEY:
    sys.exit("Env-Variablen fehlen — vorher `set -a && source .env.local && set +a` ausführen.")


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
    return data["response"]


def sb(path, method="GET", payload=None, prefer=None):
    headers = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(SB_URL + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as r:
        body = r.read()
        return json.loads(body) if body else None


def main():
    fixtures = api_get("/fixtures", {"league": LEAGUE_ID, "season": SEASON})
    print(f"{len(fixtures)} Spiele geladen")

    clubs = sb("/rest/v1/clubs?select=id,api_football_team_id")
    club_by_api = {c["api_football_team_id"]: c["id"] for c in clubs if c["api_football_team_id"]}

    # Nach Runde gruppieren (nur "Regular Season - N" hat eine klare Nummer)
    rounds = {}
    for f in fixtures:
        m = re.match(r"Regular Season - (\d+)$", f["league"]["round"])
        if not m:
            print(f"  Übersprungen (Sonderrunde): {f['league']['round']}")
            continue
        rounds.setdefault(int(m.group(1)), []).append(f)

    existing = sb(f"/rest/v1/gameweeks?select=id,number&season=eq.{SEASON}")
    gw_by_number = {g["number"]: g["id"] for g in existing}

    for number in sorted(rounds):
        matches = rounds[number]
        if number not in gw_by_number:
            first_kickoff = min(datetime.fromisoformat(m["fixture"]["date"]) for m in matches)
            deadline = (first_kickoff - timedelta(hours=1)).isoformat()
            row = sb(
                "/rest/v1/gameweeks",
                "POST",
                {"season": SEASON, "number": number, "deadline": deadline, "is_locked": False},
                "return=representation",
            )
            gw_by_number[number] = row[0]["id"]
            print(f"Spieltag {number} angelegt (Deadline {deadline})")

        payload = [
            {
                "api_football_fixture_id": m["fixture"]["id"],
                "gameweek_id": gw_by_number[number],
                "home_club_id": club_by_api.get(m["teams"]["home"]["id"]),
                "away_club_id": club_by_api.get(m["teams"]["away"]["id"]),
                "kickoff": m["fixture"]["date"],
                "status": m["fixture"]["status"]["short"],
                "home_goals": m["goals"]["home"],
                "away_goals": m["goals"]["away"],
            }
            for m in matches
        ]
        sb(
            "/rest/v1/fixtures?on_conflict=api_football_fixture_id",
            "POST",
            payload,
            "resolution=merge-duplicates",
        )

    print(f"Fertig: {sum(len(v) for v in rounds.values())} Spiele in {len(rounds)} Runden.")


if __name__ == "__main__":
    main()
