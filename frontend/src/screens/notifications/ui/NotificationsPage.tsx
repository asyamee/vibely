"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  acceptFriendRequest,
  rejectFriendRequest,
  type FriendRequestItem,
} from "@/shared/api/users.api";
import { Button } from "@/shared/ui/Button/Button";
import styles from "./NotificationsPage.module.css";

interface Props {
  me: string;
  initialRequests: FriendRequestItem[];
}

export const NotificationsPage: React.FC<Props> = ({ me, initialRequests }) => {
  const [requests, setRequests] = useState<FriendRequestItem[]>(initialRequests);
  const [busy, setBusy] = useState<string | null>(null);

  const handle = async (
    fromUserId: string,
    fn: (me: string, friendId: string) => Promise<void>,
  ) => {
    setBusy(fromUserId);
    try {
      await fn(me, fromUserId);
      setRequests((prev) => prev.filter((r) => r.userId !== fromUserId));
    } catch {
      // noop
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Заявки в друзья</h1>

      {requests.length === 0 ? (
        <p className={styles.empty}>Новых заявок нет</p>
      ) : (
        <ul className={styles.list}>
          {requests.map((req) => (
            <li key={req.userId} className={styles.item}>
              <Link href={`/users/${req.userId}`} className={styles.userLink}>
                <img src={req.avatarUrl} alt="" className={styles.avatar} />
                <span className={styles.name}>{req.displayName || req.userId}</span>
              </Link>
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  disabled={busy === req.userId}
                  onClick={() => handle(req.userId, acceptFriendRequest)}
                >
                  Принять
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy === req.userId}
                  onClick={() => handle(req.userId, rejectFriendRequest)}
                >
                  Отклонить
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
