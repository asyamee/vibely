"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, Music, Mail, Phone, MessageCircle } from "lucide-react";

import {
  removeFriend,
  type IUserFriend,
  type IUserProfile,
} from "@/shared/api/users";
import { onAvatarError } from "@/shared/lib/avatarFallback";
import { GenreTag } from "@/shared/ui/GenreTag/GenreTag";
import { Button } from "@/shared/ui/Button/Button";
import { Modal } from "@/shared/ui/Modal/Modal";
import { useToast } from "@/shared/ui/Toast/useToast";
import { ToastContainer } from "@/shared/ui/Toast/ToastContainer";

import styles from "./ProfilePage.module.css";

interface IProfilePageProps {
  userId: string;
  initialProfile: IUserProfile;
  initialFriends: IUserFriend[];
}

export const ProfilePage: React.FC<IProfilePageProps> = ({
  userId,
  initialProfile,
  initialFriends,
}) => {
  const router = useRouter();
  const contacts = initialProfile.contacts;
  const [friends, setFriends] = useState<IUserFriend[]>(initialFriends);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const { toasts, show, dismiss } = useToast();

  const handleRemove = async (friendId: string) => {
    setConfirmRemove(null);
    setBusy(friendId);
    try {
      await removeFriend(userId, friendId);
      setFriends((prev) => prev.filter((f) => f.userId !== friendId));
      router.refresh();
    } catch {
      show("Не удалось удалить друга", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.container}>
      {/* Top bar with icon buttons */}
      <div className={styles.topBar}>
        <Link href="/profile/settings" className={styles.iconButton} aria-label="Настройки">
          <Settings size={20} />
        </Link>
      </div>

      {/* Header: avatar + name + genres */}
      <div className={styles.header}>
        <div className={styles.avatarWrapper}>
          <img
            src={initialProfile.avatarUrl}
            alt={initialProfile.displayName || "Аватар"}
            onError={onAvatarError}
            className={styles.avatar}
          />
        </div>
        <h1 className={styles.name}>{initialProfile.displayName || userId}</h1>
        {initialProfile.genres.length > 0 && (
          <div className={styles.genres}>
            {initialProfile.genres.map((g) => (
              <GenreTag key={g} label={g} />
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{friends.length}</span>
          <span className={styles.statLabel}>Друзья</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{initialProfile.genres.length}</span>
          <span className={styles.statLabel}>Жанры</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{initialProfile.favoriteTracks.length}</span>
          <span className={styles.statLabel}>Треки</span>
        </div>
      </div>

      {/* Contacts */}
      {contacts && (contacts.telegram || contacts.phone || contacts.contactEmail) && (
        <div className={styles.contactsCard}>
          {contacts.telegram && (
            <div className={styles.contactRow}>
              <MessageCircle size={16} className={styles.contactIcon} />
              <span className={styles.contactLabel}>Telegram</span>
              <span>{contacts.telegram}</span>
            </div>
          )}
          {contacts.phone && (
            <div className={styles.contactRow}>
              <Phone size={16} className={styles.contactIcon} />
              <span className={styles.contactLabel}>Телефон</span>
              <span>{contacts.phone}</span>
            </div>
          )}
          {contacts.contactEmail && (
            <div className={styles.contactRow}>
              <Mail size={16} className={styles.contactIcon} />
              <span className={styles.contactLabel}>Email</span>
              <span>{contacts.contactEmail}</span>
            </div>
          )}
        </div>
      )}

      {/* Favorite tracks */}
      {initialProfile.favoriteTracks.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Любимые треки</h2>
          <div className={styles.trackList}>
            {initialProfile.favoriteTracks.slice(0, 5).map((t, i) => (
              <div key={t.track_id} className={styles.trackItem}>
                <span className={styles.trackIndex}>{i + 1}</span>
                <span className={styles.trackTitle}>{t.title}</span>
                <span className={styles.trackArtist}>{t.artist}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Playlists link */}
      <div className={styles.centered}>
        <Button variant="secondary" onClick={() => router.push("/playlists")}>
          <Music size={16} /> Мои плейлисты
        </Button>
      </div>

      {/* Friends */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Друзья</h2>
        {friends.length > 0 ? (
          <ul className={styles.friendList}>
            {friends.map((friend) => (
              <li key={friend.userId} className={styles.friendItem}>
                <img
                  src={friend.avatarUrl}
                  alt={friend.displayName || friend.userId}
                  onError={onAvatarError}
                  className={styles.friendAvatar}
                />
                <div className={styles.friendInfo}>
                  <Link href={`/users/${friend.userId}`} className={styles.friendLink}>
                    <span className={styles.friendName}>{friend.displayName || friend.userId}</span>
                  </Link>
                  {friend.contacts && (friend.contacts.telegram || friend.contacts.phone || friend.contacts.contactEmail) && (
                    <div className={styles.friendContacts}>
                      {friend.contacts.telegram && <span>TG: {friend.contacts.telegram}</span>}
                      {friend.contacts.phone && <span> · {friend.contacts.phone}</span>}
                      {friend.contacts.contactEmail && <span> · {friend.contacts.contactEmail}</span>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(friend.userId)}
                  disabled={busy === friend.userId}
                  className={styles.removeBtn}
                >
                  {busy === friend.userId ? "..." : "Удалить"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyMessage}>Пока нет друзей — ищи похожих на главной</p>
        )}
      </section>

      {confirmRemove && (
        <Modal onClose={() => setConfirmRemove(null)} title="Удалить из друзей?">
          <p>Это действие нельзя отменить.</p>
          <div className={styles.modalActions}>
            <Button variant="secondary" onClick={() => setConfirmRemove(null)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={() => handleRemove(confirmRemove)}>
              Удалить
            </Button>
          </div>
        </Modal>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};
