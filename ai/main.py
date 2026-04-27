"""
Demo-скрипт: загружает checkpoint, вычисляет embeddings синтетических пользователей
и выводит матрицу сходства.

Использование:
    python main.py [--model-path user_encoder.pt]
"""
from __future__ import annotations

import argparse
import os
import sys
from typing import Dict

import numpy as np
import torch

from inference import build_user_embedding
from model import UserMusicEncoder
from nearest_neighbours import cosine_similarity
from train import build_synthetic_users


def main() -> None:
    parser = argparse.ArgumentParser(description="Demo: similarity matrix for synthetic users")
    parser.add_argument("--model-path", type=str, default="user_encoder.pt")
    args = parser.parse_args()

    if not os.path.exists(args.model_path):
        print(f"Model not found at '{args.model_path}'. Run first:")
        print("    python train.py")
        print("    python retrain.py --backend-url http://localhost:3001")
        sys.exit(1)

    device = "cpu"
    state_dict = torch.load(args.model_path, map_location=device, weights_only=True)

    track_size = state_dict.get("track_emb.weight", torch.empty(0)).size(0) or 500_000
    artist_size = state_dict.get("artist_emb.weight", torch.empty(0)).size(0) or 100_000
    genre_size = state_dict.get("genre_emb.weight", torch.empty(0)).size(0) or 64

    model = UserMusicEncoder(
        num_tracks=track_size,
        num_artists=artist_size,
        num_genres=genre_size,
    ).to(device)
    model.load_state_dict(state_dict)
    model.eval()

    users = build_synthetic_users()
    embeddings: Dict[str, np.ndarray] = {
        uid: build_user_embedding(model, hist, device=device)
        for uid, hist in users.items()
    }

    # Матрица сходства
    ids = list(embeddings.keys())
    print("=== Матрица сходства пользователей ===")
    header = "".ljust(16) + "".join(uid.ljust(16) for uid in ids)
    print(header)
    for left in ids:
        row = left.ljust(16)
        for right in ids:
            row += f"{cosine_similarity(embeddings[left], embeddings[right]):.4f}".ljust(16)
        print(row)

    # Ближайшие соседи для каждого
    print("\n=== Ближайшие соседи ===")
    for uid in ids:
        others = sorted(
            [(o, cosine_similarity(embeddings[uid], embeddings[o])) for o in ids if o != uid],
            key=lambda x: x[1],
            reverse=True,
        )
        top = ", ".join(f"{o}({s:.3f})" for o, s in others[:2])
        print(f"{uid}: {top}")


if __name__ == "__main__":
    main()
