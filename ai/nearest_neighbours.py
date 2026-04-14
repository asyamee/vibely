import numpy as np
from typing import Dict, List, Tuple


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-8))


def find_nearest_users(
    target_embedding: np.ndarray,
    all_embeddings: Dict[str, np.ndarray],
    top_k: int = 10,
) -> List[Tuple[str, float]]:
    result = []

    for user_id, emb in all_embeddings.items():
        sim = cosine_similarity(target_embedding, emb)
        result.append((user_id, sim))

    result.sort(key=lambda x: x[1], reverse=True)
    return result[:top_k]