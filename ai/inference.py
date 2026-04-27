from typing import Dict, List

import numpy as np
import torch

try:
    from .nearest_neighbours import cosine_similarity  # noqa: F401  (re-export)
except ImportError:
    from nearest_neighbours import cosine_similarity  # noqa: F401


def pad_artists(artist_lists: List[List[int]], pad_value: int = 0) -> List[List[int]]:
    if not artist_lists:
        return []
    max_len = max(len(a) for a in artist_lists)
    return [a + [pad_value] * (max_len - len(a)) for a in artist_lists]


def build_user_embedding(model, user_history: List[Dict], device: str = None) -> np.ndarray:
    """
    Строит нормализованный вектор пользователя из его истории прослушиваний.

    Элемент истории:
        track_id   : int
        genre_id   : int
        artist_ids : List[int]
        rating     : float  (>0 нравится, <0 не нравится)
    """
    if not user_history:
        raise ValueError("user_history must not be empty")

    if device is None:
        device = "cuda" if torch.cuda.is_available() else "cpu"

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
