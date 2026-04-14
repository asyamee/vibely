"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Neighbor = {
  userId: string;
  similarity: number;
};

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000/api";

const MainPage = () => {
  const [userId, setUserId] = useState("");
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    try {
      setError(null);
      setLoading(true);
      setNeighbors([]);

      const res = await fetch(
        `${BACKEND_URL}/users/${encodeURIComponent(userId)}/nearest?top_k=10`,
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data?.message ??
          (res.status === 404
            ? "Эмбеддинг пользователя не найден. Сначала оцени плейлист на /rates и пересчитай эмбеддинги."
            : "Не удалось получить похожих пользователей");
        setError(msg);
        return;
      }

      const data = (await res.json()) as { userId: string; neighbors: Neighbor[] };
      setNeighbors(data.neighbors ?? []);
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : "Не удалось получить похожих пользователей",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.heading}>Vibely — подбор похожих пользователей</h1>

        <section className={styles.section}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>
                ID пользователя или UUID плейлиста
              </label>
              <input
                className={styles.input}
                placeholder="user_123 или UUID плейлиста"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={!userId || loading}
            onClick={handleSearch}
            className={styles.buttonPrimary}
          >
            {loading ? "Ищу..." : "Найти похожих"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </section>

        {neighbors.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.playlistTitle}>Похожие пользователи</h2>
            <p className={styles.playlistDescription}>
              Здесь будут пользователи, наиболее близкие к выбранному по
              музыкальному вектору.
            </p>
            <ul className={styles.trackList}>
              {neighbors.map((n) => (
                <li key={n.userId} className={styles.trackItem}>
                  <div className={styles.trackInfo}>
                    <div className={styles.trackTitle}>{n.userId}</div>
                    <div className={styles.trackArtists}>
                      cosine ≈ {n.similarity.toFixed(3)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section}>
          <p className={styles.playlistDescription}>
            Чтобы модель знала твой вкус, перейди на страницу{" "}
            <a href="/rates" style={{ color: "#a5b4fc" }}>
              оценки плейлистов
            </a>{" "}
            и проставь оценки трекам.
          </p>
        </section>
      </div>
    </main>
  );
};

export default MainPage;
