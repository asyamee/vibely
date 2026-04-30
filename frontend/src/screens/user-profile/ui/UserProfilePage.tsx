"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
  type FriendshipStatus,
  type UserProfile,
} from "@/shared/api/users.api";
import { Button } from "@/shared/ui/Button/Button";
import { GenreTag } from "@/shared/ui/GenreTag/GenreTag";
import { BackButton } from "@/shared/ui/BackButton/BackButton";
import styles from "./UserProfilePage.module.css";

interface Props {
  me: string;
  profile: UserProfile;
}

export const UserProfilePage: React.FC<Props> = ({ me, profile }) => {
  const router = useRouter();
  const [status, setStatus] = useState<FriendshipStatus>(profile.friendshipStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (
    fn: () => Promise<void>,
    nextStatus: FriendshipStatus,
    refreshOnSuccess = false,
  ) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setStatus(nextStatus);
      if (refreshOnSuccess) router.refresh();
    } catch {
      setError("Не удалось выполнить действие");
    } finally {
      setBusy(false);
    }
  };

  const renderActions = () => {
    switch (status) {
      case "none":
        return (
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              handle(() => sendFriendRequest(me, profile.userId), "pending_outgoing")
            }
          >
            Добавить в друзья
          </Button>
        );
      case "pending_outgoing":
        return (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => handle(() => rejectFriendRequest(me, profile.userId), "none")}
          >
            Отменить заявку
          </Button>
        );
      case "pending_incoming":
        return (
          <>
            <Button
              variant="primary"
              disabled={busy}
              onClick={() =>
                handle(() => acceptFriendRequest(me, profile.userId), "accepted", true)
              }
            >
              Принять заявку
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => handle(() => rejectFriendRequest(me, profile.userId), "none")}
            >
              Отклонить
            </Button>
          </>
        );
      case "accepted":
        return (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              if (!confirm("Удалить из друзей?")) return;
              handle(() => removeFriend(me, profile.userId), "none", true);
            }}
            className={styles.dangerBtn}
          >
            Удалить из друзей
          </Button>
        );
      default:
        return null;
    }
  };

  const statusLabel: Record<FriendshipStatus, string | null> = {
    self: null,
    none: null,
    pending_outgoing: "Заявка отправлена, ждём ответа",
    pending_incoming: "Этот пользователь отправил вам заявку",
    accepted: "Вы друзья",
  };

  return (
    <div className={styles.container}>
      <BackButton fallbackHref="/" />
      <div className={styles.header}>
        <img src={profile.avatarUrl} alt="" className={styles.avatar} />
        <div className={styles.info}>
          <h1 className={styles.name}>{profile.displayName || profile.userId}</h1>
          {profile.genres.length > 0 && (
            <div className={styles.genres}>
              {profile.genres.map((g) => (
                <GenreTag key={g} label={g} />
              ))}
            </div>
          )}
          {statusLabel[status] && (
            <p className={styles.statusBadge}>{statusLabel[status]}</p>
          )}
        </div>
      </div>

      <div className={styles.actions}>{renderActions()}</div>
      {error && <p className={styles.error}>{error}</p>}

      {status === "accepted" && profile.contacts ? (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Контакты</h2>
          <ul className={styles.contactList}>
            {profile.contacts.telegram && (
              <li>Telegram: {profile.contacts.telegram}</li>
            )}
            {profile.contacts.phone && <li>Телефон: {profile.contacts.phone}</li>}
            {profile.contacts.contactEmail && (
              <li>Email: {profile.contacts.contactEmail}</li>
            )}
            {!profile.contacts.telegram &&
              !profile.contacts.phone &&
              !profile.contacts.contactEmail && (
                <li className={styles.muted}>Контакты не указаны</li>
              )}
          </ul>
        </section>
      ) : (
        <p className={styles.muted}>
          Контакты появятся после принятия заявки в друзья.
        </p>
      )}

      {profile.favoriteTracks.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Любимые треки</h2>
          <ul className={styles.trackList}>
            {profile.favoriteTracks.map((t) => (
              <li key={t.track_id}>{t.title}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
