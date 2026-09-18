from __future__ import annotations


def liked_to_rating(liked: bool | None) -> float:
    if liked is True:
        return 1.0
    if liked is False:
        return -1.0
    return 0.0


def liked_str_to_rating(liked: str | None) -> float:
    """Convert string liked values from API payload to rating float."""
    if liked == "strong_like":
        return 1.0
    if liked == "like":
        return 0.5
    if liked == "dislike":
        return -0.5
    if liked == "strong_dislike":
        return -1.0
    return -0.1
