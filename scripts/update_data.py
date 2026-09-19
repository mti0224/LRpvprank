import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests

RANGERBOOK_USAGE_URL = "https://pvp-data.warmycat.com/usage.json"
LEAGUE = "LEGEND"
PLAYER_LIMIT = 200
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
session.headers.update({"User-Agent": "LRpvprank/2.0"})


def fetch_json(url):
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def sorted_rows(counter):
    return [
        {"name": name, "count": count}
        for name, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def rows_to_counter(rows):
    counter = {}
    for row in rows or []:
        if not isinstance(row, dict):
            continue

        name = str(row.get("name") or row.get("rangerId") or "undefined")
        raw_count = row.get("appearanceCount", 0)
        try:
            count = int(raw_count)
        except (TypeError, ValueError):
            count = 0

        if count > 0:
            counter[name] = count

    return counter


def scope_counter(usage_data, top_n):
    scopes = usage_data.get("scopes") or {}
    scope = scopes.get(str(top_n))
    if not isinstance(scope, dict) or not isinstance(scope.get("rangers"), list):
        raise ValueError(f"rangerbook usage.json 缺少 scopes.{top_n}.rangers")
    return rows_to_counter(scope["rangers"])


def main():
    print("Loading rangerbook PvP usage data...")
    usage_data = fetch_json(RANGERBOOK_USAGE_URL)

    metadata = usage_data.get("metadata") or {}
    league = str(metadata.get("league") or LEAGUE).upper()

    snapshots = {
        "top10": scope_counter(usage_data, 10),
        "top50": scope_counter(usage_data, 50),
        "top100": scope_counter(usage_data, 100),
        "all": rows_to_counter(usage_data.get("rangers")),
    }

    if not snapshots["all"]:
        raise ValueError("rangerbook usage.json 的 rangers 資料為空")

    now_utc = datetime.now(timezone.utc)
    now_tw = now_utc.astimezone(timezone(timedelta(hours=8)))

    loaded_players = int(metadata.get("sampleCount") or 0)
    ranking_count = int(metadata.get("rankingCount") or PLAYER_LIMIT)
    failure_count = int(metadata.get("playerDataFailureCount") or 0)

    output = {
        "generatedAt": now_utc.isoformat(),
        "generatedAtTaipei": now_tw.strftime("%Y-%m-%d %H:%M:%S"),
        "dateTitle": f"{now_tw.month}/{now_tw.day}",
        "league": league,
        "leagueName": LEAGUE_TRANSLATE.get(league, league),
        "playerLimit": PLAYER_LIMIT,
        "rangeLabel": "前 200 名玩家的 A/B 隊伍",
        "loadedPlayers": loaded_players,
        "loadedTeams": None,
        "failedMids": [],
        "source": {
            "url": RANGERBOOK_USAGE_URL,
            "generatedAtUtc": metadata.get("generatedAtUtc"),
            "rankingCount": ranking_count,
            "playerDataFailureCount": failure_count,
        },
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
    print(
        f"Wrote {OUTPUT_PATH}: league={league}, "
        f"players={loaded_players}/{ranking_count}, failures={failure_count}"
    )


if __name__ == "__main__":
    main()
