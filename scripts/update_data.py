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
session.headers.update({"User-Agent": "LRpvprank/2.1"})


def fetch_json(url):
    response = session.get(url, timeout=30)
    response.raise_for_status()
    return response.json()


def sorted_rows(counter):
    return [
        {"name": name, "count": count}
        for name, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def appearance_count(row):
    try:
        return max(0, int(row.get("appearanceCount") or 0))
    except (TypeError, ValueError, AttributeError):
        return 0


def rows_to_counter(rows):
    counter = {}
    for row in rows or []:
        if not isinstance(row, dict):
            continue

        name = str(row.get("name") or row.get("rangerId") or "undefined")
        count = appearance_count(row)
        if count > 0:
            counter[name] = count

    return counter


def scope_counter(usage_data, top_n):
    scopes = usage_data.get("scopes") or {}
    scope = scopes.get(str(top_n))
    if not isinstance(scope, dict) or not isinstance(scope.get("rangers"), list):
        raise ValueError(f"rangerbook usage.json 缺少 scopes.{top_n}.rangers")
    return rows_to_counter(scope["rangers"])


def parse_generated_at(value):
    text = str(value or "").strip()
    if not text:
        return datetime.now(timezone.utc)

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def existing_source_timestamp():
    if not OUTPUT_PATH.is_file():
        return None

    try:
        existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None

    source = existing.get("source") if isinstance(existing, dict) else None
    return source.get("generatedAtUtc") if isinstance(source, dict) else None


def main():
    print("Loading rangerbook PvP usage data...")
    usage_data = fetch_json(RANGERBOOK_USAGE_URL)

    metadata = usage_data.get("metadata") or {}
    source_generated_at = str(metadata.get("generatedAtUtc") or "").strip() or None

    if source_generated_at and existing_source_timestamp() == source_generated_at:
        print(f"No rangerbook update: generatedAtUtc={source_generated_at}")
        return

    league = str(metadata.get("league") or LEAGUE).upper()

    snapshots = {
        "top10": scope_counter(usage_data, 10),
        "top50": scope_counter(usage_data, 50),
        "top100": scope_counter(usage_data, 100),
        "all": rows_to_counter(usage_data.get("rangers")),
    }

    if not snapshots["all"]:
        raise ValueError("rangerbook usage.json 的 rangers 資料為空")

    source_utc = parse_generated_at(source_generated_at)
    source_tw = source_utc.astimezone(timezone(timedelta(hours=8)))

    loaded_players = int(metadata.get("sampleCount") or 0)
    ranking_count = int(metadata.get("rankingCount") or PLAYER_LIMIT)
    failure_count = int(metadata.get("playerDataFailureCount") or 0)

    ranger_rows = usage_data.get("rangers") or []
    total_appearances = sum(
        appearance_count(row)
        for row in ranger_rows
        if isinstance(row, dict)
    )
    loaded_team_count = round(total_appearances / 5) if total_appearances else None

    output = {
        "generatedAt": source_utc.isoformat(),
        "generatedAtTaipei": source_tw.strftime("%Y-%m-%d %H:%M:%S"),
        "dateTitle": f"{source_tw.month}/{source_tw.day}",
        "league": league,
        "leagueName": LEAGUE_TRANSLATE.get(league, league),
        "playerLimit": PLAYER_LIMIT,
        "rangeLabel": "前 200 名玩家的 A/B 隊伍",
        "loadedPlayers": loaded_players,
        "loadedTeams": loaded_team_count,
        "failedMids": [],
        "source": {
            "url": RANGERBOOK_USAGE_URL,
            "generatedAtUtc": source_generated_at,
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
        f"Wrote {OUTPUT_PATH}: source={source_generated_at}, "
        f"league={league}, players={loaded_players}/{ranking_count}, "
        f"teams={loaded_team_count}, failures={failure_count}"
    )


if __name__ == "__main__":
    main()
