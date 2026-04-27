from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time

from dotenv import load_dotenv
load_dotenv()
from typing import Dict, List, Literal, Optional

import numpy as np
import torch
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

try:
    from .dataset import build_users_from_events, load_events_from_jsonl
    from .inference import build_user_embedding
    from .model import UserMusicEncoder
    from .nearest_neighbours import find_nearest_users
except ImportError:
    from dataset import build_users_from_events, load_events_from_jsonl
    from inference import build_user_embedding
    from model import UserMusicEncoder
    from nearest_neighbours import find_nearest_users

logging.basicConfig(level=logging.INFO, format="%(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("vibely-ai")

DEVICE = os.getenv("AI_DEVICE", "cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = os.getenv("AI_MODEL_PATH", "user_encoder.pt")
AI_ADMIN_TOKEN = os.getenv("AI_ADMIN_TOKEN", "")

NUM_TRACKS = int(os.getenv("AI_NUM_TRACKS", "500000"))
NUM_ARTISTS = int(os.getenv("AI_NUM_ARTISTS", "100000"))
NUM_GENRES = int(os.getenv("AI_NUM_GENRES", "64"))

# ── Admin training state ─────────────────────────────────────────────────────

class _TrainState:
    def __init__(self) -> None:
        self._status = "idle"
        self._logs: list[str] = []
        self._lock = threading.Lock()

    def reset(self) -> None:
        with self._lock:
            self._status = "running"
            self._logs = []

    def add_log(self, msg: str) -> None:
        with self._lock:
            self._logs.append(msg)

    def finish(self, ok: bool) -> None:
        with self._lock:
            self._status = "done" if ok else "failed"

    def snapshot(self) -> tuple[str, list[str]]:
        with self._lock:
            return self._status, list(self._logs)


class _StateLogHandler(logging.Handler):
    def __init__(self, state: _TrainState) -> None:
        super().__init__()
        self.state = state

    def emit(self, record: logging.LogRecord) -> None:
        self.state.add_log(self.format(record))


_train_state = _TrainState()
_train_thread: threading.Thread | None = None


# ── Pydantic models ──────────────────────────────────────────────────────────

class TrackPayload(BaseModel):
    id: int = Field(..., ge=0)
    genre_id: int = Field(..., ge=0)
    artist_ids: List[int] = Field(..., min_length=1)
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


class ComputeEmbeddingTrack(BaseModel):
    id: int = Field(..., ge=0)
    genre_id: int = Field(..., ge=0)
    artist_ids: List[int] = Field(..., min_length=1)
    rating: float


class ComputeEmbeddingRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    tracks: List[ComputeEmbeddingTrack] = Field(..., min_length=1)


class RetrainRequest(BaseModel):
    events_jsonl: Optional[str] = None
    epochs: int = Field(50, ge=1, le=500)
    diversity_weight: float = Field(0.1, ge=0.0, le=1.0)


# ── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="Vibely AI Service", version="0.1.0")


def _get_model_params_from_state_dict(state_dict: dict) -> tuple[int, int, int]:
    track_size = state_dict.get("track_emb.weight", torch.empty(0)).size(0)
    artist_size = state_dict.get("artist_emb.weight", torch.empty(0)).size(0)
    genre_size = state_dict.get("genre_emb.weight", torch.empty(0)).size(0)
    return track_size, artist_size, genre_size


def _load_model_from_disk() -> None:
    global NUM_TRACKS, NUM_ARTISTS, NUM_GENRES

    state_dict = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True)
    loaded_tracks, loaded_artists, loaded_genres = _get_model_params_from_state_dict(state_dict)
    NUM_TRACKS = max(NUM_TRACKS, loaded_tracks)
    NUM_ARTISTS = max(NUM_ARTISTS, loaded_artists)
    NUM_GENRES = max(NUM_GENRES, loaded_genres)

    model = UserMusicEncoder(
        num_tracks=NUM_TRACKS,
        num_artists=NUM_ARTISTS,
        num_genres=NUM_GENRES,
    ).to(DEVICE)
    model.load_state_dict(state_dict)
    model.eval()
    app.state.model = model


@app.on_event("startup")
def _startup() -> None:
    try:
        _load_model_from_disk()
    except FileNotFoundError as e:
        raise RuntimeError(
            f"Model weights not found at '{MODEL_PATH}'. "
            "Run: python train.py  (or python retrain.py --backend-url ...)"
        ) from e

    app.state.user_embeddings: Dict[str, np.ndarray] = {}
    logger.info("Model loaded: tracks=%d, artists=%d, genres=%d", NUM_TRACKS, NUM_ARTISTS, NUM_GENRES)


# ── Admin helpers ────────────────────────────────────────────────────────────

def _require_admin(token: str) -> None:
    if not AI_ADMIN_TOKEN or token != AI_ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Admin token required")


def _retrain_bg(events_jsonl: str | None, epochs: int, diversity_weight: float) -> None:
    train_logger = logging.getLogger("vibely-train")
    retrain_logger = logging.getLogger("vibely-retrain")
    handler = _StateLogHandler(_train_state)
    handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
    train_logger.addHandler(handler)
    retrain_logger.addHandler(handler)

    try:
        # 1. Save JSONL data if provided
        if events_jsonl:
            data_dir = os.path.join(os.path.dirname(__file__), "data")
            os.makedirs(data_dir, exist_ok=True)
            data_path = os.path.join(data_dir, "user_events.jsonl")
            with open(data_path, "w", encoding="utf-8") as f:
                f.write(events_jsonl)
            line_count = sum(1 for l in events_jsonl.splitlines() if l.strip())
            _train_state.add_log(f"INFO: Saved {line_count} events to {data_path}")
        else:
            data_path = os.path.join(os.path.dirname(__file__), "data", "user_events.jsonl")
            if not os.path.exists(data_path):
                _train_state.add_log("INFO: No JSONL found, using synthetic data")
                data_path = None

        # 2. Train
        try:
            from train import train_model
        except ImportError:
            from .train import train_model  # type: ignore

        _train_state.add_log(f"INFO: diversity_weight={diversity_weight}")
        best_loss = train_model(
            epochs=epochs,
            data_path=data_path,
            model_path=MODEL_PATH,
            diversity_weight=diversity_weight,
        )
        _train_state.add_log(f"INFO: Training complete. Best val_loss={best_loss:.4f}")

        # 3. Reload model weights into memory
        _load_model_from_disk()
        _train_state.add_log("INFO: Model reloaded into memory")

        # 4. Recompute embeddings for all users in the training data
        if data_path and os.path.exists(data_path):
            _recompute_embeddings(data_path)

        _train_state.finish(True)

    except Exception as exc:
        _train_state.add_log(f"ERROR: {exc}")
        _train_state.finish(False)
    finally:
        train_logger.removeHandler(handler)
        retrain_logger.removeHandler(handler)


def _recompute_embeddings(data_path: str) -> None:
    events = load_events_from_jsonl(data_path)
    users = build_users_from_events(events)
    for user_id, history in users.items():
        emb = build_user_embedding(app.state.model, history, device=DEVICE)
        app.state.user_embeddings[user_id] = emb
    _train_state.add_log(f"INFO: Recomputed embeddings for {len(users)} users")


# ── Public endpoints ─────────────────────────────────────────────────────────

def _validate_ids(payload: RegisterUserRequest) -> None:
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
    return -0.1


def _payload_to_history(payload: RegisterUserRequest) -> List[Dict]:
    return [
        {
            "track_id": t.id,
            "genre_id": t.genre_id,
            "artist_ids": t.artist_ids,
            "rating": _liked_to_rating(t.liked),
        }
        for t in payload.tracks
    ]


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
    all_embs = {k: v for k, v in app.state.user_embeddings.items() if k != user_id}
    neighbors = find_nearest_users(target, all_embs, top_k=top_k)
    return NearestUsersResponse(
        user_id=user_id,
        neighbors=[Neighbor(user_id=uid, similarity=float(sim)) for uid, sim in neighbors],
    )


@app.post("/compute-embedding", response_model=UserEmbeddingResponse)
def compute_embedding(payload: ComputeEmbeddingRequest) -> UserEmbeddingResponse:
    t0 = time.monotonic()
    history = [
        {
            "track_id": t.id,
            "genre_id": t.genre_id,
            "artist_ids": t.artist_ids,
            "rating": t.rating,
        }
        for t in payload.tracks
    ]
    embedding = build_user_embedding(app.state.model, history, device=DEVICE)
    app.state.user_embeddings[payload.user_id] = embedding
    logger.info("Embedding for user_id=%s computed in %.3fs", payload.user_id, time.monotonic() - t0)
    return UserEmbeddingResponse(
        user_id=payload.user_id,
        embedding=embedding.astype(float).tolist(),
    )


# ── Admin endpoints ──────────────────────────────────────────────────────────

@app.get("/admin/stats")
def admin_stats(x_admin_token: str = Header(default="")) -> Dict:
    _require_admin(x_admin_token)
    status, logs = _train_state.snapshot()
    return {
        "train_status": status,
        "registered_users": len(app.state.user_embeddings),
        "num_tracks": NUM_TRACKS,
        "num_artists": NUM_ARTISTS,
        "num_genres": NUM_GENRES,
        "last_log": logs[-1] if logs else None,
    }


@app.post("/admin/retrain")
def admin_retrain(
    payload: RetrainRequest,
    x_admin_token: str = Header(default=""),
) -> Dict:
    _require_admin(x_admin_token)
    global _train_thread
    if _train_thread and _train_thread.is_alive():
        raise HTTPException(status_code=409, detail="Training already in progress")
    _train_state.reset()
    _train_thread = threading.Thread(
        target=_retrain_bg,
        args=(payload.events_jsonl, payload.epochs, payload.diversity_weight),
        daemon=True,
    )
    _train_thread.start()
    return {"status": "started"}


@app.post("/admin/reload")
def admin_reload(x_admin_token: str = Header(default="")) -> Dict:
    _require_admin(x_admin_token)
    try:
        _load_model_from_disk()
        return {"status": "reloaded", "num_tracks": NUM_TRACKS, "num_artists": NUM_ARTISTS}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Model file not found: {MODEL_PATH}")


@app.get("/admin/retrain/stream")
async def admin_retrain_stream(x_admin_token: str = Header(default="")):
    _require_admin(x_admin_token)

    async def event_gen():
        last_idx = 0
        while True:
            status, all_logs = _train_state.snapshot()
            new_logs = all_logs[last_idx:]

            for line in new_logs:
                yield f"data: {json.dumps({'log': line})}\n\n"
            last_idx += len(new_logs)

            if status in ("done", "failed") and not new_logs:
                yield f"data: {json.dumps({'status': status, 'done': True})}\n\n"
                return

            await asyncio.sleep(0.4)

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
