
import logging

import numpy as np
import torch

from model import UserMusicEncoder
from nearest_neighbours import cosine_similarity  # noqa: F401

logger = logging.getLogger("vibely-inference")


def pad_artists(artist_lists: list[list[int]], pad_value: int = 0) -> list[list[int]]:
    if not artist_lists:
        return []
    max_len = max(len(a) for a in artist_lists)
    return [a + [pad_value] * (max_len - len(a)) for a in artist_lists]


def _resolve_device(requested: str | None = None) -> torch.device:
    if requested is None:
        requested = "cuda" if torch.cuda.is_available() else "cpu"
    if requested == "cuda" and not torch.cuda.is_available():
        logger.warning("CUDA requested but unavailable, falling back to CPU")
        return torch.device("cpu")
    return torch.device(requested)


def build_user_embedding(
    model: UserMusicEncoder,
    user_history: list[dict[str, object]],
    device: str | None = None,
) -> np.ndarray:
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

    device = _resolve_device(device)

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
