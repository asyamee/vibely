from __future__ import annotations

import json
from collections import defaultdict
from typing import DefaultDict, Dict, Iterable, List


Event = Dict[str, object]
UserHistory = List[Dict[str, object]]


def load_events_from_jsonl(path: str) -> List[Event]:
    """
    Загружает сырые события из JSONL-файла.

    Формат строки:
    {
      "user_id": "user_123",
      "track_id": int,
      "genre_id": int,
      "artist_ids": [int, ...],
      "rating": float
    }
    """
    events: List[Event] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            events.append(json.loads(line))
    return events


def build_users_from_events(events: Iterable[Event]) -> Dict[str, UserHistory]:
    """
    Преобразует поток событий в словарь:
    user_id -> история событий в формате, который ожидает модель.
    """
    users: DefaultDict[str, UserHistory] = defaultdict(list)

    for ev in events:
        user_id = str(ev["user_id"])

        history_item = {
            "track_id": int(ev["track_id"]),
            "genre_id": int(ev["genre_id"]),
            "artist_ids": [int(a) for a in ev["artist_ids"]],
            "rating": float(ev["rating"]),
        }
        users[user_id].append(history_item)

    # Фильтруем пользователей без хотя бы одного положительного события
    filtered: Dict[str, UserHistory] = {}
    for uid, hist in users.items():
        if any(h["rating"] > 0 for h in hist):
            filtered[uid] = hist

    return filtered

