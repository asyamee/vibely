"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/shared/store/userStore";
import { getProfile, getFriends } from "@/shared/api/users.api";
import { Button } from "@/shared/ui/Button/Button";
import styles from "./ProfilePage.module.css";

export const ProfilePage: React.FC = () => {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const hasHydrated = useUserStore((s) => s.hasHydrated);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [friends, setFriends] = useState<Array<{ userId: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!userId) {
      // Гидрация завершена и userId всё ещё нет — не авторизованы.
      // Middleware уже редиректит при отсутствии refreshToken cookie,
      // поэтому здесь просто выходим без принудительного редиректа.
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const profile = await getProfile(userId);
        setDisplayName(profile.displayName);
        setAvatarUrl(profile.avatarUrl);

        const friendsData = await getFriends(userId);
        setFriends(friendsData.friends);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки профиля");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId, hasHydrated]);


  if (loading) return <div className={styles.container}>Загрузка...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img src={avatarUrl} alt="Avatar" className={styles.avatar} />
        <div className={styles.info}>
          <h1 className={styles.name}>{displayName || userId}</h1>
          <Button variant="secondary" onClick={() => router.push("/profile/settings")}>
            Настройки
          </Button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Друзья</h2>
        {friends.length > 0 ? (
          <ul className={styles.friendList}>
            {friends.map((friend) => (
              <li key={friend.userId} className={styles.friendItem}>
                {friend.displayName || friend.userId}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyMessage}>Нет друзей</p>
        )}
      </section>

    </div>
  );
};
