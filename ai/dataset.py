from __future__ import annotations

import json
import logging
from collections import defaultdict
from typing import DefaultDict, Dict, Iterable, List

logger = logging.getLogger("vibely-ai")

Event = Dict[str, object]
UserHistory = List[Dict[str, object]]

_REQUIRED_FIELDS = {"user_id", "track_id", "genre_id", "artist_ids", "rating"}


def load_events_from_jsonl(path: str) -> List[Event]:
    events: List[Event] = []
    skipped = 0
    with open(path, "r", encoding="utf-8") as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                logger.warning("Line %d: invalid JSON, skipping", lineno)
                skipped += 1
                continue

            missing = _REQUIRED_FIELDS - ev.keys()
            if missing:
                logger.warning("Line %d: missing fields %s, skipping", lineno, missing)
                skipped += 1
                continue

            events.append(ev)

    if skipped:
        logger.warning("Skipped %d invalid lines", skipped)
    return events


def build_users_from_events(events: Iterable[Event]) -> Dict[str, UserHistory]:
    users: DefaultDict[str, Dict[int, Dict]] = defaultdict(dict)

    total_events = 0
    for ev in events:
        total_events += 1
        user_id = str(ev["user_id"])
        track_id = int(ev["track_id"])

        item = {
            "track_id": track_id,
            "genre_id": int(ev["genre_id"]),
            "artist_ids": [int(a) for a in ev["artist_ids"]] or [0],
            "rating": max(-1.0, min(1.0, float(ev["rating"]))),
        }
        # Дедупликация: при повторной оценке того же трека берём последнюю
        users[user_id][track_id] = item

    result: Dict[str, UserHistory] = {}
    filtered_users = 0
    for uid, track_map in users.items():
        history = list(track_map.values())
        if len(history) < 2:
            filtered_users += 1
            continue
        if not any(h["rating"] > 0 for h in history):
            filtered_users += 1
            continue
        result[uid] = history

    unique_events = sum(len(h) for h in result.values())
    logger.info(
        "Loaded %d users, %d events (%d users filtered, %d duplicate events removed)",
        len(result),
        unique_events,
        filtered_users,
        total_events - unique_events - filtered_users * 0,
    )
    return result
