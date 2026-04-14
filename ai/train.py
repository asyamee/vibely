import argparse
import os
import random
from typing import Dict, List, Tuple

import torch
import torch.nn.functional as F
from torch.optim import Adam

from dataset import build_users_from_events, load_events_from_jsonl
from inference import pad_artists
from model import UserMusicEncoder


def set_seed(seed: int = 42) -> None:
    random.seed(seed)
    torch.manual_seed(seed)


def build_synthetic_users() -> Dict[str, List[Dict]]:
    """
    Простейшие синтетические пользователи в новом формате.
    Используется, если продовых данных ещё нет.
    """
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


def sample_training_example(users: Dict[str, List[Dict]]) -> Tuple[List[Dict], Dict, Dict]:
    user_id = random.choice(list(users.keys()))
    history = users[user_id]

    positives, negatives = split_pos_neg(history)

    pos_item = random.choice(positives)

    if negatives:
        neg_item = random.choice(negatives)
    else:
        other_user_id = random.choice([u for u in users.keys() if u != user_id])
        neg_item = random.choice(users[other_user_id])

    return history, pos_item, neg_item


def history_to_tensors(history: List[Dict], device: str):
    track_ids = torch.tensor(
        [x["track_id"] for x in history],
        dtype=torch.long,
        device=device,
    )
    genre_ids = torch.tensor(
        [x["genre_id"] for x in history],
        dtype=torch.long,
        device=device,
    )
    artist_ids = torch.tensor(
        pad_artists([x["artist_ids"] for x in history]),
        dtype=torch.long,
        device=device,
    )
    ratings = torch.tensor(
        [x["rating"] for x in history],
        dtype=torch.float32,
        device=device,
    )
    return track_ids, artist_ids, genre_ids, ratings


def item_to_tensors(item: Dict, device: str):
    track_id = torch.tensor(item["track_id"], dtype=torch.long, device=device)
    genre_id = torch.tensor(item["genre_id"], dtype=torch.long, device=device)
    artist_ids = torch.tensor(item["artist_ids"], dtype=torch.long, device=device)
    return track_id, genre_id, artist_ids


def get_max_ids_from_events(events):
    """Определяет максимальные ID из событий для корректной инициализации модели."""
    max_track_id = 0
    max_artist_id = 0
    max_genre_id = 0
    
    for event in events:
        max_track_id = max(max_track_id, event['track_id'])
        max_genre_id = max(max_genre_id, event['genre_id'])
        for artist_id in event['artist_ids']:
            max_artist_id = max(max_artist_id, artist_id)
    
    # Добавляем запас в 10% для будущих данных
    buffer = 0.1
    return (
        max(100, int(max_track_id * (1 + buffer)) + 1),  # Минимум 100 для треков
        max(100, int(max_artist_id * (1 + buffer)) + 1), # Минимум 100 для артистов
        max(100, int(max_genre_id * (1 + buffer)) + 1)  # Минимум 100 для жанров
    )

def train_model(
    epochs: int = 20,
    steps_per_epoch: int = 1000,
    model_path: str = "user_encoder.pt",
    data_path: str | None = None,
    num_tracks: int = 500_000,
    num_artists: int = 100_000,
    num_genres: int = 64,
    use_gpu: bool = True,
) -> None:
    set_seed(42)
    device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    if data_path is not None and os.path.exists(data_path):
        print(f"Загружаю продовые события из {data_path} ...")
        events = load_events_from_jsonl(data_path)
        users = build_users_from_events(events)
        
        if not users:
            print("Не нашёл валидных пользователей в датаcете, падаю обратно на synthetic.")
            users = build_synthetic_users()
        else:
            # Автоматически определяем размеры embedding из данных
            max_tracks, max_artists, max_genres = get_max_ids_from_events(events)
            
            # Используем максимальные значения из данных или заданные параметры, whichever больше
            num_tracks = max(num_tracks, max_tracks)
            num_artists = max(num_artists, max_artists)
            num_genres = max(num_genres, max_genres)
            
            print(f"Максимальные ID из данных: tracks={max_tracks}, artists={max_artists}, genres={max_genres}")
            print(f"Размеры embedding: tracks={num_tracks}, artists={num_artists}, genres={num_genres}")
    else:
        if data_path is not None:
            print(f"Файл с данными {data_path} не найден, использую synthetic users.")
        users = build_synthetic_users()

    print(f"Всего пользователей для обучения: {len(users)}")

    model = UserMusicEncoder(
        num_tracks=num_tracks,
        num_artists=num_artists,
        num_genres=num_genres,
        track_emb_dim=16,
        artist_emb_dim=8,
        genre_emb_dim=6,
        hidden_dim=32,
        user_emb_dim=16,
    ).to(device)

    optimizer = Adam(model.parameters(), lr=1e-3)

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0

        for _ in range(steps_per_epoch):
            history, pos_item, neg_item = sample_training_example(users)

            track_ids, artist_ids, genre_ids, ratings = history_to_tensors(history, device)
            pos_track_id, pos_genre_id, pos_artist_ids = item_to_tensors(pos_item, device)
            neg_track_id, neg_genre_id, neg_artist_ids = item_to_tensors(neg_item, device)

            user_vec = model.encode_user(track_ids, artist_ids, genre_ids, ratings)
            pos_vec = model.encode_track(pos_track_id, pos_genre_id, pos_artist_ids, rating_value=1.0)
            neg_vec = model.encode_track(neg_track_id, neg_genre_id, neg_artist_ids, rating_value=1.0)

            pos_score = torch.sum(user_vec * pos_vec)
            neg_score = torch.sum(user_vec * neg_vec)

            loss = -F.logsigmoid(pos_score - neg_score)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += float(loss.item())

        avg_loss = total_loss / steps_per_epoch
        print(f"Epoch {epoch:03d} | loss = {avg_loss:.4f}")

    torch.save(model.state_dict(), model_path)
    print(f"\nМодель сохранена в {model_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Train UserMusicEncoder model.")
    parser.add_argument(
        "--data-path",
        type=str,
        default=None,
        help="Путь к JSONL-файлу с продовыми событиями. Если не указан или файл не найден, используется synthetic dataset.",
    )
    parser.add_argument(
        "--model-path",
        type=str,
        default="user_encoder.pt",
        help="Куда сохранить веса модели.",
    )
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--steps-per-epoch", type=int, default=1000)
    parser.add_argument("--num-tracks", type=int, default=500_000)
    parser.add_argument("--num-artists", type=int, default=100_000)
    parser.add_argument("--num-genres", type=int, default=64)
    parser.add_argument("--use-gpu", action="store_true", help="Использовать GPU для тренировки, если доступно")

    args = parser.parse_args()

    train_model(
        epochs=args.epochs,
        steps_per_epoch=args.steps_per_epoch,
        model_path=args.model_path,
        data_path=args.data_path,
        num_tracks=args.num_tracks,
        num_artists=args.num_artists,
        num_genres=args.num_genres,
        use_gpu=args.use_gpu,
    )


if __name__ == "__main__":
    main()