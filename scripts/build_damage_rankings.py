#!/usr/bin/env python3
"""Build six-place damage posters from Rangerbook's current ranger statistics.

Each skill is evaluated separately. A skill's damage is
  (physical ATK + magical ATK) * (single-hit % + sum(DoT % * seconds)) / 100.
The highest-scoring skill per Ranger is selected; skills whose damage cannot
be evaluated with these terms are excluded instead of inventing values.
"""
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import requests

SOURCE = "https://raw.githubusercontent.com/mti0224/rangerbook/main/res/Rangers_data.json"
OUTPUT = Path("data/skill-damage.json")
STARS = ("super8", "star9")
ELEMENTS = ("lightdark-with-nft", "lightdark-without-nft", "fire", "wood", "water")
DAMAGE_EFFECTS = {"傷害 (單擊)", "傷害 (持續)"}
COEFFICIENT = re.compile(r"^攻擊力\s*[*×xX]\s*(\d+(?:\.\d+)?)\s*%$")
DURATION = re.compile(r"^(\d+(?:\.\d+)?)\s*秒$")


def numeric(value):
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return 0.0


def score_skill(skill, attack):
    if not isinstance(skill, dict) or not isinstance(skill.get("技能組"), list):
        return None
    direct_percent = 0.0
    dots = []
    for effect in skill["技能組"]:
        if not isinstance(effect, dict) or effect.get("效果") not in DAMAGE_EFFECTS:
            continue
        coefficient = COEFFICIENT.fullmatch(str(effect.get("係數") or "").strip())
        if not coefficient:
            return None  # HP-based or otherwise non-ATK damage is not comparable.
        percent = float(coefficient.group(1))
        if effect["效果"] == "傷害 (單擊)":
            direct_percent += percent
        else:
            duration = DURATION.fullmatch(str(effect.get("有效時間") or "").strip())
            if not duration or float(duration.group(1)) <= 0:
                return None  # Never assume a DoT tick count/duration.
            dots.append({"percent": percent, "seconds": float(duration.group(1))})
    total_percent = direct_percent + sum(x["percent"] * x["seconds"] for x in dots)
    if total_percent <= 0:
        return None
    return {
        "skillName": str(skill.get("技能名稱") or "未命名技能"),
        "directPercent": direct_percent,
        "dots": dots,
        "damage": int(round(attack * total_percent / 100)),
    }


def read_ranger(row):
    if not isinstance(row, dict):
        return None
    star = str(row.get("Ranger星數") or "").strip()
    if star == "9星":
        star_key = "star9"
    elif star == "超進化8星":
        star_key = "super8"
    else:
        return None
    element = str(row.get("屬性") or "").strip()
    if element not in {"光", "暗", "火", "木", "水"}:
        return None
    attack = numeric(row.get("物理攻擊力")) + numeric(row.get("魔法攻擊力"))
    if attack <= 0:
        return None
    options = [
        score_skill(row.get(key), attack)
        for key in ("技能1", "技能2")
    ]
    options = [candidate for candidate in options if candidate is not None]
    if not options:
        return None
    winner = max(options, key=lambda item: item["damage"])
    return {
        "id": str(row.get("ranger_id") or row.get("unitCode") or ""),
        "name": str(row.get("Ranger名稱") or "").strip(),
        "star": star,
        "starKey": star_key,
        "element": element,
        "attack": int(attack) if attack.is_integer() else attack,
        **winner,
    }


def build_payload(rangers, generated_at=None):
    rows = [row for record in rangers if (row := read_ranger(record))]
    rankings = {}
    candidate_counts = {}
    for element in ELEMENTS:
        rankings[element] = {}
        candidate_counts[element] = {}
        for star_key in STARS:
            def included(row):
                if row["starKey"] != star_key:
                    return False
                if element.startswith("lightdark"):
                    if row["element"] not in ("光", "暗"):
                        return False
                    return element == "lightdark-with-nft" or "[T]" not in row["name"]
                return row["element"] == {
                    "fire": "火", "wood": "木", "water": "水"
                }[element]

            selected = [row for row in rows if included(row)]
            selected.sort(key=lambda item: (
                -item["damage"], item["name"], item["id"]
            ))
            candidate_counts[element][star_key] = len(selected)
            rankings[element][star_key] = selected[:6]

    return {
        "schemaVersion": 1,
        "source": SOURCE,
        "generatedAtUtc": generated_at or datetime.now(timezone.utc).isoformat(),
        "candidateCounts": candidate_counts,
        "rankings": rankings,
    }


def main():
    response = requests.get(SOURCE, timeout=90, headers={
        "User-Agent": "LRpvprank-skill-damage/1.0"
    })
    response.raise_for_status()
    rows = response.json()
    if not isinstance(rows, list) or len(rows) < 50:
        raise ValueError("Rangerbook Rangers_data.json is not a valid ranger list")
    payload = build_payload(rows)
    if any(not payload["rankings"][element][star] for element in ELEMENTS for star in STARS):
        raise ValueError("One or more damage poster groups have no calculable data")
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            if (previous.get("rankings") == payload["rankings"]
                    and previous.get("candidateCounts") == payload["candidateCounts"]):
                print("No skill damage ranking changes")
                return
        except (OSError, json.JSONDecodeError, AttributeError):
            pass
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Updated", OUTPUT, "- 10 groups of six Rangers")


if __name__ == "__main__":
    main()
