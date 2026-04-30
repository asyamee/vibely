"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  removeFriend,
  type UserFriend,
  type UserProfile,
} from "@/shared/api/users.api";
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
  const contacts = initialProfile.contacts;
  const [friends, setFriends] = useState<UserFriend[]>(initialFriends);
  const [busy, setBusy] = useState<string | null>(null);

  const handleRemove = async (friendId: string) => {
    if (!confirm("Удалить из друзей?")) return;
    setBusy(friendId);
    try {
      await removeFriend(userId, friendId);
      setFriends((prev) => prev.filter((f) => f.userId !== friendId));
      router.refresh();
    } catch {
      alert("Не удалось удалить друга");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <img src={initialProfile.avatarUrl} alt="Avatar" className={styles.avatar} />
        <div className={styles.info}>
          <h1 className={styles.name}>{initialProfile.displayName || userId}</h1>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => router.push("/profile/settings")}>
              Настройки
            </Button>
            <Link href="/notifications" className={styles.settingsLink}>
              Уведомления
            </Link>
            <Link href="/playlists" className={styles.settingsLink}>
              Мои плейлисты
            </Link>
          </div>
        </div>
      </div>

      {contacts && (contacts.telegram || contacts.phone || contacts.contactEmail) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Контакты</h2>
          <ul className={styles.friendList}>
            {contacts.telegram && <li className={styles.friendItem}>Telegram: {contacts.telegram}</li>}
            {contacts.phone && <li className={styles.friendItem}>Телефон: {contacts.phone}</li>}
            {contacts.contactEmail && (
              <li className={styles.friendItem}>Email: {contacts.contactEmail}</li>
            )}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Друзья</h2>
        {friends.length > 0 ? (
          <ul className={styles.friendList}>
            {friends.map((friend) => (
              <li key={friend.userId} className={styles.friendItem}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/users/${friend.userId}`} style={{ color: "inherit", textDecoration: "none" }}>
                      <strong>{friend.displayName || friend.userId}</strong>
                    </Link>
                    {friend.contacts && (friend.contacts.telegram || friend.contacts.phone || friend.contacts.contactEmail) && (
                      <div style={{ fontSize: 14, opacity: 0.8, marginTop: 4 }}>
                        {friend.contacts.telegram && <div>Telegram: {friend.contacts.telegram}</div>}
                        {friend.contacts.phone && <div>Телефон: {friend.contacts.phone}</div>}
                        {friend.contacts.contactEmail && <div>Email: {friend.contacts.contactEmail}</div>}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(friend.userId)}
                    disabled={busy === friend.userId}
                    className={styles.removeBtn}
                  >
                    {busy === friend.userId ? "..." : "Удалить"}
                  </button>
                </div>
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
