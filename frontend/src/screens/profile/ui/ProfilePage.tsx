"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { UserProfile, UserFriend } from "@/shared/api/users.api";
import { Button } from "@/shared/ui/Button/Button";
import styles from "./ProfilePage.module.css";

interface ProfilePageProps {
  userId: string;
  initialProfile: UserProfile;
  initialFriends: UserFriend[];
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userId,
  initialProfile,
  initialFriends,
}) => {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img src={initialProfile.avatarUrl} alt="Avatar" className={styles.avatar} />
        <div className={styles.info}>
          <h1 className={styles.name}>{initialProfile.displayName || userId}</h1>
          <Button variant="secondary" onClick={() => router.push("/profile/settings")}>
            Настройки
          </Button>
        </div>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Друзья</h2>
        {initialFriends.length > 0 ? (
          <ul className={styles.friendList}>
            {initialFriends.map((friend) => (
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
