from typing import Dict, List
import numpy as np
import torch


def pad_artists(artist_lists: List[List[int]], pad_value: int = 0) -> List[List[int]]:
    """
    Приводим список артистов к одинаковой длине.
    """
    if not artist_lists:
        return []

    max_len = max(len(a) for a in artist_lists)
    return [a + [pad_value] * (max_len - len(a)) for a in artist_lists]


def build_user_embedding(model, user_history: List[Dict], device: str = None) -> np.ndarray:
    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    """
    Ожидаемый формат элемента истории:
    {
        "track_id": int,
        "genre_id": int,          # один жанр на трек
        "artist_ids": [int, ...], # один или несколько артистов
        "rating": float,          # >0 нравится, <0 не нравится
    }
    """
    track_ids = torch.tensor(
        [item["track_id"] for item in user_history],
        dtype=torch.long,
        device=device,
    )

    genre_ids = torch.tensor(
        [item["genre_id"] for item in user_history],
        dtype=torch.long,
        device=device,
    )

    artist_ids = torch.tensor(
        pad_artists([item["artist_ids"] for item in user_history]),
        dtype=torch.long,
        device=device,
    )

    ratings = torch.tensor(
        [item["rating"] for item in user_history],
        dtype=torch.float32,
        device=device,
    )

    model.eval()
    with torch.no_grad():
        user_vec = model.encode_user(track_ids, artist_ids, genre_ids, ratings)

    return user_vec.cpu().numpy()


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8))