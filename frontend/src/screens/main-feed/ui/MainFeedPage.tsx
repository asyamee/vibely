"use client";

import React, { useState } from "react";

import { useUserStore } from "@/shared/store/userStore";
import { sendFriendRequest, type IUserNeighbor } from "@/shared/api/users";
import { UserCard } from "@/entities/user/ui/UserCard";
import { useToast } from "@/shared/ui/Toast/useToast";
import { ToastContainer } from "@/shared/ui/Toast/ToastContainer";

import styles from "./MainFeedPage.module.css";

interface IMainFeedPageProps {
  userId: string;
  initialNeighbors: IUserNeighbor[];
}

export const MainFeedPage: React.FC<IMainFeedPageProps> = ({ userId, initialNeighbors }) => {
  const [neighbors] = useState<IUserNeighbor[]>(initialNeighbors);
  const favoritedUserIds = useUserStore((s) => s.favoritedUserIds);
  const toggleFavorite = useUserStore((s) => s.toggleFavorite);
  const { toasts, show, dismiss } = useToast();

  const handleSendRequest = async (targetUserId: string) => {
    try {
      await sendFriendRequest(userId, targetUserId);
      show("Запрос в друзья отправлен", "success");
    } catch (err) {
      console.error("Error sending friend request:", err);
      show("Ошибка при отправке запроса", "error");
    }
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
              onFavorite={() => toggleFavorite(neighbor.userId)}
              isFavorited={favoritedUserIds.includes(neighbor.userId)}
            />
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};
