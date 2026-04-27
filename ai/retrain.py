"""
Скачивает события из бэкенда и переобучает модель за одну команду.

Использование:
    python retrain.py --backend-url http://localhost:3001 --model-path user_encoder.pt
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys

import numpy as np
import requests
import torch

from dataset import build_users_from_events, load_events_from_jsonl
from inference import build_user_embedding
from model import UserMusicEncoder
from train import train_model

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("vibely-retrain")

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
DEFAULT_JSONL = os.path.join(DATA_DIR, "user_events.jsonl")


def download_events(backend_url: str, out_path: str, token: str | None = None) -> int:
    url = backend_url.rstrip("/") + "/api/ratings/export-jsonl"
    logger.info("Downloading events from %s", url)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error("Failed to download events: %s", e)
        sys.exit(1)

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    content = resp.text.strip()
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(content)
        if content:
            f.write("\n")

    count = len([l for l in content.splitlines() if l.strip()])
    logger.info("Saved %d events to %s", count, out_path)
    return count


def update_user_embeddings(
    backend_url: str,
    model_path: str,
    data_path: str,
    token: str | None = None,
    device: str = "cpu",
) -> int:
    """Пересчитывает embeddings для всех пользователей и сохраняет их на бэкенде."""
    try:
        # Загрузить обученную модель
        state_dict = torch.load(model_path, map_location=device, weights_only=True)
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

        logger.info("Model loaded for embedding computation")

        # Загрузить события и построить пользователей
        events = load_events_from_jsonl(data_path)
        users = build_users_from_events(events)

        if not users:
            logger.warning("No users found for embedding update")
            return 0

        # Пересчитать embeddings
        updated_count = 0
        for user_id, history in users.items():
            embedding = build_user_embedding(model, history, device=device)

            # Отправить embedding на бэкенд
            url = backend_url.rstrip("/") + f"/api/users/{user_id}/embedding"
            headers = {"Authorization": f"Bearer {token}"} if token else {}
            try:
                resp = requests.post(
                    url,
                    json={"embedding": embedding.astype(float).tolist()},
                    headers=headers,
                    timeout=10,
                )
                if resp.status_code == 200:
                    updated_count += 1
                    logger.debug("Updated embedding for user %s", user_id)
                else:
                    logger.warning("Failed to update embedding for user %s: %s", user_id, resp.text)
            except requests.RequestException as e:
                logger.warning("Failed to send embedding for user %s: %s", user_id, e)

        logger.info("Updated embeddings for %d users", updated_count)
        return updated_count

    except Exception as e:
        logger.error("Failed to update embeddings: %s", e)
        return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Download events and retrain model")
    parser.add_argument("--backend-url", type=str, default="http://localhost:3001")
    parser.add_argument("--model-path", type=str, default="user_encoder.pt")
    parser.add_argument("--data-path", type=str, default=DEFAULT_JSONL,
                        help="Путь для сохранения JSONL (по умолчанию data/user_events.jsonl)")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--steps-per-epoch", type=int, default=200)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--use-gpu", action="store_true")
    parser.add_argument("--token", type=str, default=None,
                        help="JWT Bearer-токен для авторизации на бэкенде")
    args = parser.parse_args()

    count = download_events(args.backend_url, args.data_path, token=args.token)
    if count == 0:
        logger.warning("No events downloaded. Training on synthetic data.")

    best_loss = train_model(
        epochs=args.epochs,
        steps_per_epoch=args.steps_per_epoch,
        batch_size=args.batch_size,
        patience=args.patience,
        model_path=args.model_path,
        data_path=args.data_path if count > 0 else None,
        use_gpu=args.use_gpu,
    )

    logger.info("Done. Best val_loss=%.4f. Model: %s", best_loss, args.model_path)

    # Пересчитать embeddings для всех пользователей
    logger.info("Updating user embeddings...")
    device = "cuda" if args.use_gpu else "cpu"
    updated = update_user_embeddings(
        backend_url=args.backend_url,
        model_path=args.model_path,
        data_path=args.data_path,
        token=args.token,
        device=device,
    )
    logger.info("Updated embeddings for %d users", updated)


if __name__ == "__main__":
    main()
