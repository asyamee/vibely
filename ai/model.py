import torch
import torch.nn as nn
import torch.nn.functional as F


class SafeEmbedding(nn.Module):
    """Обертка для Embedding, которая безопасно обрабатывает индексы за пределами диапазона."""
    
    def __init__(self, num_embeddings: int, embedding_dim: int):
        super().__init__()
        self.num_embeddings = num_embeddings
        self.embedding_layer = nn.Embedding(num_embeddings, embedding_dim)
    
    def forward(self, indices: torch.Tensor) -> torch.Tensor:
        # Обрезаем индексы, чтобы они не выходили за пределы
        safe_indices = torch.clamp(indices, 0, self.num_embeddings - 1)
        return self.embedding_layer(safe_indices)


class UserMusicEncoder(nn.Module):
    def __init__(
        self,
        num_tracks: int,
        num_artists: int,
        num_genres: int,
        track_emb_dim: int = 16,
        artist_emb_dim: int = 8,
        genre_emb_dim: int = 6,
        hidden_dim: int = 32,
        user_emb_dim: int = 16,
    ):
        super().__init__()

        self.track_emb = SafeEmbedding(num_tracks, track_emb_dim)
        self.artist_emb = SafeEmbedding(num_artists, artist_emb_dim)
        self.genre_emb = SafeEmbedding(num_genres, genre_emb_dim)

        # track + aggregated artists + single genre + rating
        input_dim = track_emb_dim + artist_emb_dim + genre_emb_dim + 1

        self.event_mlp = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, user_emb_dim),
        )

        self.user_mlp = nn.Sequential(
            nn.Linear(user_emb_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, user_emb_dim),
        )

    def encode_events(
        self,
        track_ids: torch.Tensor,
        artist_ids: torch.Tensor,
        genre_ids: torch.Tensor,
        ratings: torch.Tensor,
    ) -> torch.Tensor:
        """
        track_ids:  (N,)
        artist_ids: (N, A_max)  - список артистов, усредняем по оси артистов
        genre_ids:  (N,)        - один жанр на трек
        ratings:    (N,)
        """
        track_vec = self.track_emb(track_ids)  # (N, track_emb_dim)
        artist_vec = self.artist_emb(artist_ids).mean(dim=1)  # (N, artist_emb_dim)
        genre_vec = self.genre_emb(genre_ids)  # (N, genre_emb_dim)
        rating_vec = ratings.unsqueeze(1)  # (N, 1)

        x = torch.cat([track_vec, artist_vec, genre_vec, rating_vec], dim=1)
        return self.event_mlp(x)

    def encode_user(
        self,
        track_ids: torch.Tensor,
        artist_ids: torch.Tensor,
        genre_ids: torch.Tensor,
        ratings: torch.Tensor,
    ) -> torch.Tensor:
        """
        Агрегируем события пользователя в один вектор пользователя.
        """
        event_vecs = self.encode_events(track_ids, artist_ids, genre_ids, ratings)

        weights = ratings.abs().unsqueeze(1) + 1e-8
        user_vec = (event_vecs * weights).sum(dim=0) / weights.sum(dim=0)

        user_vec = self.user_mlp(user_vec.unsqueeze(0)).squeeze(0)
        user_vec = F.normalize(user_vec, dim=0)

        return user_vec

    def encode_track(
        self,
        track_id: torch.Tensor,
        genre_id: torch.Tensor,
        artist_ids: torch.Tensor,
        rating_value: float = 1.0,
    ) -> torch.Tensor:
        """
        Кодируем один трек в то же пространство, что и пользователя.
        track_id:   scalar или (N,)
        genre_id:   scalar или (N,)
        artist_ids: (A,) или (N, A)
        """
        if track_id.dim() == 0:
            track_id = track_id.unsqueeze(0)
        if genre_id.dim() == 0:
            genre_id = genre_id.unsqueeze(0)
        if artist_ids.dim() == 1:
            artist_ids = artist_ids.unsqueeze(0)

        ratings = torch.full(
            size=track_id.shape,
            fill_value=rating_value,
            dtype=torch.float32,
            device=track_id.device,
        )

        track_vec = self.encode_events(track_id, artist_ids, genre_id, ratings)[0]
        track_vec = F.normalize(track_vec, dim=0)
        return track_vec