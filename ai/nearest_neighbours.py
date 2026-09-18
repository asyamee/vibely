
import heapq

import numpy as np

EPSILON = 1e-8


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + EPSILON))


def find_nearest_users(
    target_embedding: np.ndarray,
    all_embeddings: dict[str, np.ndarray],
    top_k: int = 10,
) -> list[tuple[str, float]]:
    results = [
        (user_id, cosine_similarity(target_embedding, emb))
        for user_id, emb in all_embeddings.items()
    ]
    return heapq.nlargest(top_k, results, key=lambda x: x[1])
