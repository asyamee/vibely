from typing import Dict

import numpy as np
import torch

from model import UserMusicEncoder
from inference import build_user_embedding, cosine_similarity
from train import build_synthetic_users


def print_vector(name: str, vector: np.ndarray) -> None:
    print(f"{name}:")
    print(np.round(vector, 4))
    print()


def compare_all_users(user_embeddings: Dict[str, np.ndarray]) -> None:
    user_ids = list(user_embeddings.keys())

    print("=== Матрица схожести пользователей ===")
    header = "user_id".ljust(16)
    for user_id in user_ids:
        header += user_id.ljust(16)
    print(header)

    for left_user in user_ids:
        row = left_user.ljust(16)
        for right_user in user_ids:
            similarity = cosine_similarity(
                user_embeddings[left_user],
                user_embeddings[right_user],
            )
            row += f"{similarity:.4f}".ljust(16)
        print(row)

    print()


def print_nearest_neighbors(
    target_user_id: str,
    user_embeddings: Dict[str, np.ndarray],
    top_k: int = 3,
) -> None:
    target_vector = user_embeddings[target_user_id]
    scores = []

    for other_user_id, other_vector in user_embeddings.items():
        if other_user_id == target_user_id:
            continue

        similarity = cosine_similarity(target_vector, other_vector)
        scores.append((other_user_id, similarity))

    scores.sort(key=lambda item: item[1], reverse=True)

    print(f"=== Самые похожие пользователи для {target_user_id} ===")
    for user_id, similarity in scores[:top_k]:
        print(f"{user_id}: {similarity:.4f}")
    print()


def main() -> None:
    device = "cpu"

    users = build_synthetic_users()

    model = UserMusicEncoder(
        num_tracks=100,
        num_artists=60,
        num_genres=12,
        track_emb_dim=16,
        artist_emb_dim=8,
        genre_emb_dim=6,
        hidden_dim=32,
        user_emb_dim=16,
    ).to(device)

    model.load_state_dict(torch.load("user_encoder.pt", map_location=device))
    model.eval()

    user_embeddings: Dict[str, np.ndarray] = {}

    for user_id, user_history in users.items():
        embedding = build_user_embedding(
            model=model,
            user_history=user_history,
            device=device,
        )
        user_embeddings[user_id] = embedding

    print("=== Векторы пользователей ===")
    for user_id, embedding in user_embeddings.items():
        print_vector(user_id, embedding)

    compare_all_users(user_embeddings)

    for user_id in users.keys():
        print_nearest_neighbors(user_id, user_embeddings, top_k=2)


if __name__ == "__main__":
    main()