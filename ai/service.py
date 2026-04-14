from __future__ import annotations

import os
from typing import Dict, List, Literal, Optional

import numpy as np
import torch
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

try:
    # Если запускаем как пакет: `uvicorn ai.service:app`
    from .inference import build_user_embedding
    from .model import UserMusicEncoder
    from .nearest_neighbours import find_nearest_users
except ImportError:
    # Если запускаем из папки `ai`: `uvicorn service:app`
    from inference import build_user_embedding
    from model import UserMusicEncoder
    from nearest_neighbours import find_nearest_users


DEVICE = os.getenv("AI_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = os.getenv("AI_MODEL_PATH", "user_encoder.pt")

# IMPORTANT: эти размеры должны соответствовать вашему словарю id-шников (mapping).
# По умолчанию ставим значения под крупный сервис, но лучше задавать их через env.
# Пример: AI_NUM_TRACKS=500000, AI_NUM_ARTISTS=100000, AI_NUM_GENRES=64
NUM_TRACKS = int(os.getenv("AI_NUM_TRACKS", "500000"))
NUM_ARTISTS = int(os.getenv("AI_NUM_ARTISTS", "100000"))
NUM_GENRES = int(os.getenv("AI_NUM_GENRES", "64"))


class TrackPayload(BaseModel):
    id: int = Field(..., ge=0)
    genre_id: int = Field(..., ge=0)
    artist_ids: List[int] = Field(..., min_length=1)
    # Шкала отношения к треку:
    # - "strong_like"   -> +1.0
    # - "like"          -> +0.5
    # - "neutral"       -> -0.1
    # - "dislike"       -> -0.5
    # - "strong_dislike"-> -1.0
    liked: Optional[
        Literal["strong_like", "like", "neutral", "dislike", "strong_dislike"]
    ] = None


class RegisterUserRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    tracks: List[TrackPayload] = Field(..., min_length=1)


class UserEmbeddingResponse(BaseModel):
    user_id: str
    embedding: List[float]


class Neighbor(BaseModel):
    user_id: str
    similarity: float


class NearestUsersResponse(BaseModel):
    user_id: str
    neighbors: List[Neighbor]


def _validate_ids(payload: RegisterUserRequest) -> None:
    # Используем значения из env переменных
    for t in payload.tracks:
        if t.id >= NUM_TRACKS:
            raise HTTPException(
                status_code=400,
                detail=f"track id {t.id} out of range (0..{NUM_TRACKS-1})",
            )
        if t.genre_id >= NUM_GENRES:
            raise HTTPException(
                status_code=400,
                detail=f"genre id {t.genre_id} out of range (0..{NUM_GENRES-1})",
            )
        for a in t.artist_ids:
            if a < 0 or a >= NUM_ARTISTS:
                raise HTTPException(
                    status_code=400,
                    detail=f"artist id {a} out of range (0..{NUM_ARTISTS-1})",
                )


def _liked_to_rating(liked: Optional[str]) -> float:
    if liked == "strong_like":
        return 1.0
    if liked == "like":
        return 0.5
    if liked == "dislike":
        return -0.5
    if liked == "strong_dislike":
        return -1.0
    # "neutral" или None
    return -0.1


def _payload_to_history(payload: RegisterUserRequest) -> List[Dict]:
    history: List[Dict] = []
    for t in payload.tracks:
        rating = _liked_to_rating(t.liked)
        history.append(
            {
                "track_id": t.id,
                "genre_id": t.genre_id,
                "artist_ids": t.artist_ids,
                "rating": rating,
            }
        )
    return history


app = FastAPI(title="Vibely AI Service", version="0.1.0")


def _get_model_params_from_state_dict(state_dict: dict) -> tuple[int, int, int]:
    """
    Извлекает параметры модели из state_dict для корректной инициализации.
    """
    # Извлекаем размеры embedding из ключей state_dict
    track_size = artist_size = genre_size = 0
    
    for key in state_dict.keys():
        if key.startswith('track_emb.embedding_layer.weight'):
            track_size = state_dict[key].size(0)
        elif key.startswith('artist_emb.embedding_layer.weight'):
            artist_size = state_dict[key].size(0)
        elif key.startswith('genre_emb.embedding_layer.weight'):
            genre_size = state_dict[key].size(0)
    
    return track_size, artist_size, genre_size


@app.on_event("startup")
def _startup() -> None:
    try:
        state_dict = torch.load(MODEL_PATH, map_location=DEVICE)
    except FileNotFoundError as e:
        raise RuntimeError(
            f"Model weights not found at '{MODEL_PATH}'. "
            f"Train and save weights first (ai/train.py), or set AI_MODEL_PATH."
        ) from e

    # Определяем параметры модели из state_dict
    loaded_num_tracks, loaded_num_artists, loaded_num_genres = _get_model_params_from_state_dict(state_dict)
    
    # Используем загруженные параметры, если они больше, чем заданные в env
    num_tracks = max(NUM_TRACKS, loaded_num_tracks)
    num_artists = max(NUM_ARTISTS, loaded_num_artists)
    num_genres = max(NUM_GENRES, loaded_num_genres)
    
    print(f"Initializing model with: tracks={num_tracks}, artists={num_artists}, genres={num_genres}")

    # Глобальные singletons: модель + in-memory хранилище эмбеддингов (MVP).
    model = UserMusicEncoder(
        num_tracks=num_tracks,
        num_artists=num_artists,
        num_genres=num_genres,
    ).to(DEVICE)

    model.load_state_dict(state_dict)
    model.eval()

    app.state.model = model
    app.state.user_embeddings: Dict[str, np.ndarray] = {}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/users/register", response_model=UserEmbeddingResponse)
def register_user(payload: RegisterUserRequest) -> UserEmbeddingResponse:
    _validate_ids(payload)

    history = _payload_to_history(payload)
    embedding = build_user_embedding(app.state.model, history, device=DEVICE)
    app.state.user_embeddings[payload.user_id] = embedding

    return UserEmbeddingResponse(
        user_id=payload.user_id,
        embedding=embedding.astype(float).tolist(),
    )


@app.get("/users/{user_id}/embedding", response_model=UserEmbeddingResponse)
def get_user_embedding(user_id: str) -> UserEmbeddingResponse:
    emb = app.state.user_embeddings.get(user_id)
    if emb is None:
        raise HTTPException(status_code=404, detail="user not found")

    return UserEmbeddingResponse(user_id=user_id, embedding=emb.astype(float).tolist())


@app.get("/users/{user_id}/nearest", response_model=NearestUsersResponse)
def nearest_users(
    user_id: str,
    top_k: int = Query(10, ge=1, le=100),
    mode: Literal["cosine"] = "cosine",
) -> NearestUsersResponse:
    if mode != "cosine":
        raise HTTPException(status_code=400, detail="only cosine mode supported")

    target = app.state.user_embeddings.get(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="user not found")

    # Не возвращаем самого пользователя в списке соседей.
    all_embs = {k: v for k, v in app.state.user_embeddings.items() if k != user_id}
    neighbors = find_nearest_users(target, all_embs, top_k=top_k)

    return NearestUsersResponse(
        user_id=user_id,
        neighbors=[Neighbor(user_id=uid, similarity=float(sim)) for uid, sim in neighbors],
    )

