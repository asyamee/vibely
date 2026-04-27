"use client";

import React, { useEffect, useState } from "react";
import { useUserStore } from "@/shared/store/userStore";
import { getNearestUsers, sendFriendRequest } from "@/shared/api/users.api";
import { UserCard } from "@/entities/user/ui/UserCard";
import type { UserNeighbor } from "@/shared/api/users.api";
import styles from "./MainFeedPage.module.css";

export const MainFeedPage: React.FC = () => {
  const { userId } = useUserStore();
  const [neighbors, setNeighbors] = useState<UserNeighbor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorited, setFavorited] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const loadNeighbors = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getNearestUsers(userId, 10);
        setNeighbors(response.neighbors);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ошибка загрузки похожих пользователей",
        );
      } finally {
        setLoading(false);
      }
    };

    loadNeighbors();
  }, [userId]);

  const handleSendRequest = async (targetUserId: string) => {
    if (!userId) return;

    try {
      await sendFriendRequest(userId, targetUserId);
      alert("Запрос в друзья отправлен");
    } catch (err) {
      console.error("Error sending friend request:", err);
      alert("Ошибка при отправке запроса");
    }
  };

  const handleFavorite = (targetUserId: string) => {
    setFavorited((prev) => {
      const next = new Set(prev);
      if (next.has(targetUserId)) {
        next.delete(targetUserId);
      } else {
        next.add(targetUserId);
      }
      return next;
    });
  };

  if (!userId) {
    return (
      <div className={styles.container}>
        <h1 className={styles.title}>Vibely — подбор похожих пользователей</h1>
        <p className={styles.message}>
          Сначала оцени плейлист на{" "}
          <a href="/model-train" className={styles.link}>
            странице обучения модели
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Похожие пользователи</h1>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.loading}>Загрузка...</p>}

      <div className={styles.grid}>
        {neighbors.map((neighbor) => (
          <UserCard
            key={neighbor.userId}
            user={neighbor}
            onSendRequest={() => handleSendRequest(neighbor.userId)}
            onFavorite={() => handleFavorite(neighbor.userId)}
            isFavorited={favorited.has(neighbor.userId)}
          />
        ))}
      </div>

      {neighbors.length === 0 && !loading && !error && (
        <p className={styles.message}>Нет похожих пользователей</p>
      )}
    </div>
  );
};
