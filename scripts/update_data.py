import json
import time
from copy import deepcopy
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

API_BASE = "https://rangers.lerico.net/api"
LEAGUE = "LEGEND"
PLAYER_LIMIT = 100
OUTPUT_PATH = Path("data/latest.json")

LEAGUE_TRANSLATE = {
    "LEGEND": "傳奇",
    "MASTER_1": "大師1",
    "MASTER_2": "大師2",
    "MASTER_3": "大師3",
    "DIAMOND_1": "鑽石1",
    "DIAMOND_2": "鑽石2",
    "DIAMOND_3": "鑽石3",
    "GOLD_1": "黃金1",
    "GOLD_2": "黃金2",
    "GOLD_3": "黃金3",
}

session = requests.Session()
session.headers.update({"User-Agent": "LRpvprank/1.0"})


def fetch_json(url):
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def sorted_rows(counter):
    return [
        {"name": name, "count": count}
        for name, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def extract_teams(player_data):
    team_group = player_data.get("playerUnitTeamGroupMap") or {}
    pvpteam = team_group.get("pvpteam") or {}

    teams = []
    if isinstance(pvpteam.get("1"), list):
        teams.append(pvpteam["1"])
    if isinstance(pvpteam.get("2"), list):
        teams.append(pvpteam["2"])
    return teams


def main():
    print("Loading translations...")
    zh_data = fetch_json(f"{API_BASE}/v2/translate?keys=zh:UNIT")

    print("Loading ranger basics...")
    rangers_data = fetch_json(f"{API_BASE}/getRangersBasics")

    unit_names = zh_data.get("zh:UNIT", {})
    rangers_dict = {}
    for ranger in rangers_data:
        unit_code = ranger.get("unitCode")
        unit_name_code = ranger.get("unitNameCode")
        if unit_code:
            rangers_dict[unit_code] = unit_names.get(unit_name_code, unit_code)

    print(f"Loading {LEAGUE} ranking...")
    rank_data = fetch_json(f"{API_BASE}/v2/pvp/league/rank/{LEAGUE}")
    top100 = rank_data.get("top100") or []
    mids = [player.get("mid") for player in top100[:PLAYER_LIMIT] if player.get("mid")]

    result = {}
    snapshots = {"top10": {}, "top50": {}, "top100": {}, "all": {}}
    failed_mids = []

    for rank, mid in enumerate(mids, start=1):
        print(f"Loading player {rank}/{len(mids)}: {mid}")
        try:
            player_data = fetch_json(f"{API_BASE}/getPlayer/{mid}")
            teams = extract_teams(player_data)

            for team in teams:
                for unit in team:
                    unit_code = unit.get("unitCode")
                    unit_name = rangers_dict.get(unit_code, unit_code or "undefined")
                    result[unit_name] = result.get(unit_name, 0) + 1
        except Exception as exc:
            print(f"Failed to load player {mid}: {exc}")
            failed_mids.append(mid)

        if rank == 10:
            snapshots["top10"] = deepcopy(result)
        elif rank == 50:
            snapshots["top50"] = deepcopy(result)
        elif rank == 100:
            snapshots["top100"] = deepcopy(result)

        time.sleep(0.12)

    if not snapshots["top10"]:
        snapshots["top10"] = deepcopy(result)
    if not snapshots["top50"]:
        snapshots["top50"] = deepcopy(result)
    if not snapshots["top100"]:
        snapshots["top100"] = deepcopy(result)
    snapshots["all"] = deepcopy(result)

    now_utc = datetime.now(timezone.utc)
    now_tw = now_utc.astimezone(timezone(timedelta(hours=8)))

    output = {
        "generatedAt": now_utc.isoformat(),
        "generatedAtTaipei": now_tw.strftime("%Y-%m-%d %H:%M:%S"),
        "dateTitle": f"{now_tw.month}/{now_tw.day}",
        "league": LEAGUE,
        "leagueName": LEAGUE_TRANSLATE.get(LEAGUE, LEAGUE),
        "playerLimit": PLAYER_LIMIT,
        "loadedPlayers": len(mids) - len(failed_mids),
        "failedMids": failed_mids,
        "snapshots": snapshots,
        "sorted": {
            "top10": sorted_rows(snapshots["top10"]),
            "top50": sorted_rows(snapshots["top50"]),
            "top100": sorted_rows(snapshots["top100"]),
            "all": sorted_rows(snapshots["all"]),
        },
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
