"use client";

import React, { useState } from "react";
import { sendFriendRequest } from "@/shared/api/users.api";
import { UserCard } from "@/entities/user/ui/UserCard";
import type { UserNeighbor } from "@/shared/api/users.api";
import styles from "./MainFeedPage.module.css";

interface MainFeedPageProps {
  userId: string;
  initialNeighbors: UserNeighbor[];
}

export const MainFeedPage: React.FC<MainFeedPageProps> = ({ userId, initialNeighbors }) => {
  const [neighbors] = useState<UserNeighbor[]>(initialNeighbors);
  const [favorited, setFavorited] = useState<Set<string>>(new Set());

  const handleSendRequest = async (targetUserId: string) => {
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

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Похожие пользователи</h1>

      {neighbors.length === 0 ? (
        <p className={styles.message}>Нет похожих пользователей</p>
      ) : (
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
      )}
    </div>
  );
};
