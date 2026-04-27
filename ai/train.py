from __future__ import annotations

import argparse
import logging
import os
import random
from typing import Dict, List, Optional, Tuple

import torch
import torch.nn.functional as F
from torch.optim import Adam
from torch.optim.lr_scheduler import ReduceLROnPlateau

from dataset import build_users_from_events, load_events_from_jsonl
from inference import pad_artists
from model import UserMusicEncoder

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("vibely-train")


def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    torch.manual_seed(seed)


def build_synthetic_users() -> Dict[str, List[Dict]]:
    return {
        "user_pop_1": [
            {"track_id": 1, "genre_id": 1, "artist_ids": [1], "rating": 1.0},
            {"track_id": 2, "genre_id": 1, "artist_ids": [1], "rating": 1.0},
            {"track_id": 3, "genre_id": 1, "artist_ids": [2], "rating": 0.8},
            {"track_id": 30, "genre_id": 3, "artist_ids": [20], "rating": -1.0},
            {"track_id": 50, "genre_id": 5, "artist_ids": [40], "rating": -1.0},
        ],
        "user_pop_2": [
            {"track_id": 4, "genre_id": 1, "artist_ids": [2], "rating": 1.0},
            {"track_id": 5, "genre_id": 2, "artist_ids": [3], "rating": 0.9},
            {"track_id": 6, "genre_id": 1, "artist_ids": [3], "rating": 1.0},
            {"track_id": 31, "genre_id": 4, "artist_ids": [21], "rating": -1.0},
            {"track_id": 51, "genre_id": 5, "artist_ids": [41], "rating": -1.0},
        ],
        "user_rock_1": [
            {"track_id": 30, "genre_id": 3, "artist_ids": [20], "rating": 1.0},
            {"track_id": 31, "genre_id": 3, "artist_ids": [20], "rating": 1.0},
            {"track_id": 32, "genre_id": 4, "artist_ids": [21], "rating": 0.9},
            {"track_id": 1, "genre_id": 1, "artist_ids": [1], "rating": -1.0},
            {"track_id": 50, "genre_id": 5, "artist_ids": [40], "rating": -0.8},
        ],
        "user_rock_2": [
            {"track_id": 33, "genre_id": 3, "artist_ids": [22], "rating": 1.0},
            {"track_id": 34, "genre_id": 4, "artist_ids": [22], "rating": 0.9},
            {"track_id": 35, "genre_id": 3, "artist_ids": [23], "rating": 1.0},
            {"track_id": 2, "genre_id": 1, "artist_ids": [1], "rating": -1.0},
            {"track_id": 52, "genre_id": 6, "artist_ids": [41], "rating": -0.8},
        ],
        "user_rap_1": [
            {"track_id": 50, "genre_id": 5, "artist_ids": [40], "rating": 1.0},
            {"track_id": 51, "genre_id": 5, "artist_ids": [40], "rating": 1.0},
            {"track_id": 52, "genre_id": 5, "artist_ids": [41], "rating": 0.9},
            {"track_id": 3, "genre_id": 1, "artist_ids": [2], "rating": -1.0},
            {"track_id": 30, "genre_id": 3, "artist_ids": [20], "rating": -1.0},
        ],
        "user_ambient_1": [
            {"track_id": 60, "genre_id": 7, "artist_ids": [50], "rating": 1.0},
            {"track_id": 61, "genre_id": 7, "artist_ids": [50], "rating": 1.0},
            {"track_id": 62, "genre_id": 7, "artist_ids": [51], "rating": 0.9},
            {"track_id": 5, "genre_id": 2, "artist_ids": [3], "rating": -1.0},
            {"track_id": 34, "genre_id": 4, "artist_ids": [22], "rating": -1.0},
        ],
        "user_mix": [
            {"track_id": 2, "genre_id": 1, "artist_ids": [1], "rating": 0.8},
            {"track_id": 31, "genre_id": 3, "artist_ids": [20], "rating": 0.8},
            {"track_id": 52, "genre_id": 5, "artist_ids": [41], "rating": 0.8},
            {"track_id": 62, "genre_id": 7, "artist_ids": [51], "rating": 0.8},
        ],
    }


def split_pos_neg(history: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    positives = [x for x in history if x["rating"] > 0]
    negatives = [x for x in history if x["rating"] < 0]
    return positives, negatives


def sample_bpr_loss(
    model,
    users: Dict[str, List[Dict]],
    user_ids: List[str],
    device: str,
    diversity_weight: float = 0.1,
) -> Optional[torch.Tensor]:
    """
    BPR loss + diversity regularization.

    Diversity loss = среднее попарное косинусное сходство между векторами
    пользователей в батче. Минимизация разталкивает их по гиперсфере.
    """
    losses: List[torch.Tensor] = []
    user_vecs: List[torch.Tensor] = []
    all_user_ids = list(users.keys())

    for uid in user_ids:
        history = users[uid]
        positives, negatives = split_pos_neg(history)
        if not positives:
            continue

        pos_item = random.choice(positives)

        if negatives:
            neg_item = random.choice(negatives)
        else:
            other_ids = [u for u in all_user_ids if u != uid]
            if not other_ids:
                continue
            neg_item = random.choice(users[random.choice(other_ids)])

        track_ids = torch.tensor(
            [x["track_id"] for x in history], dtype=torch.long, device=device
        )
        genre_ids = torch.tensor(
            [x["genre_id"] for x in history], dtype=torch.long, device=device
        )
        artist_ids = torch.tensor(
            pad_artists([x["artist_ids"] for x in history]),
            dtype=torch.long,
            device=device,
        )
        ratings = torch.tensor(
            [x["rating"] for x in history], dtype=torch.float32, device=device
        )

        user_vec = model.encode_user(track_ids, artist_ids, genre_ids, ratings)
        user_vecs.append(user_vec)

        pos_track = torch.tensor(pos_item["track_id"], dtype=torch.long, device=device)
        pos_genre = torch.tensor(pos_item["genre_id"], dtype=torch.long, device=device)
        pos_artists = torch.tensor(pos_item["artist_ids"], dtype=torch.long, device=device)
        pos_vec = model.encode_track(pos_track, pos_genre, pos_artists, rating_value=1.0)

        neg_track = torch.tensor(neg_item["track_id"], dtype=torch.long, device=device)
        neg_genre = torch.tensor(neg_item["genre_id"], dtype=torch.long, device=device)
        neg_artists = torch.tensor(neg_item["artist_ids"], dtype=torch.long, device=device)
        neg_vec = model.encode_track(neg_track, neg_genre, neg_artists, rating_value=1.0)

        loss = -F.logsigmoid(torch.sum(user_vec * pos_vec) - torch.sum(user_vec * neg_vec))
        losses.append(loss)

    if not losses:
        return None

    bpr_loss = torch.stack(losses).mean()

    # Diversity loss: штрафуем за высокое среднее сходство между пользователями в батче.
    # Векторы уже единичной длины (F.normalize), поэтому dot product = cosine similarity.
    if diversity_weight > 0 and len(user_vecs) > 1:
        vecs = torch.stack(user_vecs)           # (N, dim)
        sim_matrix = vecs @ vecs.T              # (N, N) — косинусные сходства
        n = sim_matrix.size(0)
        off_diag = sim_matrix[~torch.eye(n, dtype=torch.bool, device=device)]
        diversity_loss = off_diag.mean()
        return bpr_loss + diversity_weight * diversity_loss

    return bpr_loss


def get_max_ids_from_events(events: List[Dict]) -> Tuple[int, int, int]:
    max_track = max_artist = max_genre = 0
    for ev in events:
        max_track = max(max_track, ev["track_id"])
        max_genre = max(max_genre, ev["genre_id"])
        for a in ev["artist_ids"]:
            max_artist = max(max_artist, a)
    return max_track + 1, max_artist + 1, max_genre + 1


def train_model(
    epochs: int = 50,
    steps_per_epoch: int = 200,
    batch_size: int = 8,
    patience: int = 5,
    min_lr: float = 1e-5,
    model_path: str = "user_encoder.pt",
    data_path: Optional[str] = None,
    num_tracks: int = 500_000,
    num_artists: int = 100_000,
    num_genres: int = 64,
    use_gpu: bool = True,
    diversity_weight: float = 0.1,
) -> float:
    """Обучает модель и возвращает лучший val_loss."""
    set_seed(42)
    device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
    logger.info("Device: %s", device)

    # ── Загрузка данных ──────────────────────────────────────────────────────
    if data_path and os.path.exists(data_path):
        logger.info("Loading events from %s", data_path)
        events = load_events_from_jsonl(data_path)
        users = build_users_from_events(events)
        if not users:
            logger.warning("No valid users in dataset, falling back to synthetic data")
            users = build_synthetic_users()
            events = []
        else:
            loaded_tracks, loaded_artists, loaded_genres = get_max_ids_from_events(
                [item for h in users.values() for item in h]
            )
            num_tracks = max(num_tracks, loaded_tracks)
            num_artists = max(num_artists, loaded_artists)
            num_genres = max(num_genres, loaded_genres)
            logger.info("Vocab sizes: tracks=%d, artists=%d, genres=%d", num_tracks, num_artists, num_genres)
    else:
        if data_path:
            logger.warning("Data file %s not found, using synthetic data", data_path)
        users = build_synthetic_users()

    logger.info("Total users: %d", len(users))

    # ── Train / val split ────────────────────────────────────────────────────
    all_ids = list(users.keys())
    random.shuffle(all_ids)

    if len(all_ids) >= 5:
        split = max(1, int(0.8 * len(all_ids)))
        train_ids = all_ids[:split]
        val_ids = all_ids[split:]
    else:
        train_ids = all_ids
        val_ids = all_ids  # при малом числе пользователей валидируем на тех же

    train_users = {k: users[k] for k in train_ids}
    val_users = {k: users[k] for k in val_ids}
    logger.info("Train: %d users | Val: %d users", len(train_users), len(val_users))

    # ── Модель ───────────────────────────────────────────────────────────────
    model = UserMusicEncoder(
        num_tracks=num_tracks,
        num_artists=num_artists,
        num_genres=num_genres,
    ).to(device)

    optimizer = Adam(model.parameters(), lr=1e-3)
    scheduler = ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=3, min_lr=min_lr)

    best_val_loss = float("inf")
    patience_counter = 0
    val_steps = max(10, steps_per_epoch // 5)
    col_w = len(str(epochs))

    # ── Цикл обучения ────────────────────────────────────────────────────────
    for epoch in range(1, epochs + 1):
        # Train
        model.train()
        train_loss_total = 0.0
        train_steps_done = 0

        for _ in range(steps_per_epoch):
            batch = random.sample(train_ids, min(batch_size, len(train_ids)))
            optimizer.zero_grad()
            loss = sample_bpr_loss(model, train_users, batch, device, diversity_weight)
            if loss is None:
                continue
            loss.backward()
            optimizer.step()
            train_loss_total += float(loss.item())
            train_steps_done += 1

        avg_train = train_loss_total / max(train_steps_done, 1)

        # Validation
        model.eval()
        val_loss_total = 0.0
        val_steps_done = 0
        with torch.no_grad():
            for _ in range(val_steps):
                batch = random.sample(val_ids, min(batch_size, len(val_ids)))
                loss = sample_bpr_loss(model, val_users, batch, device, diversity_weight)
                if loss is None:
                    continue
                val_loss_total += float(loss.item())
                val_steps_done += 1

        avg_val = val_loss_total / max(val_steps_done, 1)
        current_lr = optimizer.param_groups[0]["lr"]

        scheduler.step(avg_val)

        # Early stopping + best checkpoint
        marker = ""
        if avg_val < best_val_loss:
            best_val_loss = avg_val
            patience_counter = 0
            torch.save(model.state_dict(), model_path)
            marker = "  ★ best"

        else:
            patience_counter += 1

        logger.info(
            "Epoch %*d/%d | train=%.4f | val=%.4f | lr=%.6f%s",
            col_w, epoch, epochs, avg_train, avg_val, current_lr, marker,
        )

        if patience_counter >= patience:
            logger.info("Early stopping at epoch %d. Best val_loss=%.4f", epoch, best_val_loss)
            break

    logger.info("Model saved to %s", model_path)
    return best_val_loss


def main() -> None:
    parser = argparse.ArgumentParser(description="Train UserMusicEncoder")
    parser.add_argument("--data-path", type=str, default=None)
    parser.add_argument("--model-path", type=str, default="user_encoder.pt")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--steps-per-epoch", type=int, default=200)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--min-lr", type=float, default=1e-5)
    parser.add_argument("--num-tracks", type=int, default=500_000)
    parser.add_argument("--num-artists", type=int, default=100_000)
    parser.add_argument("--num-genres", type=int, default=64)
    parser.add_argument("--use-gpu", action="store_true")
    parser.add_argument(
        "--diversity-weight",
        type=float,
        default=0.1,
        help="Вес diversity loss (0 = отключён). Разталкивает векторы пользователей по гиперсфере.",
    )
    args = parser.parse_args()

    train_model(
        epochs=args.epochs,
        steps_per_epoch=args.steps_per_epoch,
        batch_size=args.batch_size,
        patience=args.patience,
        min_lr=args.min_lr,
        model_path=args.model_path,
        data_path=args.data_path,
        num_tracks=args.num_tracks,
        num_artists=args.num_artists,
        num_genres=args.num_genres,
        use_gpu=args.use_gpu,
        diversity_weight=args.diversity_weight,
    )


if __name__ == "__main__":
    main()
