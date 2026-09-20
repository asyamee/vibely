"use client";

import React from "react";
import Link from "next/link";
import { Heart, UserRound, ExternalLink } from "lucide-react";

import { onAvatarError } from "@/shared/lib/avatarFallback";
import { GenreTag } from "@/shared/ui/GenreTag/GenreTag";

import styles from "./UserCard.module.css";
import type { IUserCardData } from "../model/types";

interface IUserCardProps {
  user: IUserCardData;
  onSendRequest?: () => void;
  onFavorite?: () => void;
  isFavorited?: boolean;
}

export const UserCard: React.FC<IUserCardProps> = ({
  user,
  onSendRequest,
  onFavorite,
  isFavorited = false,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Link href={`/users/${user.userId}`} className={styles.avatarLink}>
          <img
            src={user.avatarUrl}
            alt={user.displayName || user.userId}
            onError={onAvatarError}
            className={styles.avatar}
          />
        </Link>
        <div className={styles.info}>
          <Link href={`/users/${user.userId}`} className={styles.nameLink}>
            <h3 className={styles.name}>{user.displayName || user.userId}</h3>
          </Link>
          {user.genres && user.genres.length > 0 && (
            <div className={styles.genreList}>
              {user.genres.slice(0, 3).map((genre) => (
                <GenreTag key={genre} label={genre} />
              ))}
            </div>
          )}
        </div>
      </div>

      {user.favoriteTracks && user.favoriteTracks.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Любимые треки</h4>
          <div className={styles.trackList}>
            {user.favoriteTracks.map((track) => (
              <div key={track.track_id} className={styles.track}>
                <div className={styles.trackContent}>
                  <div className={styles.trackImage} />
                  <div className={styles.trackInfo}>
                    <p className={styles.trackTitle}>{track.title}</p>
                    <p className={styles.trackArtist}>{track.artist}</p>
                  </div>
                </div>
                <ExternalLink className={styles.trackIcon} size={24} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.actions}>
        {onSendRequest && (
          <button className={styles.primaryButton} onClick={onSendRequest}>
            <UserRound className={styles.icon} size={24} />
            Отправить запрос
          </button>
        )}
        <button className={styles.actionButton} onClick={onFavorite} aria-label={isFavorited ? "Убрать из избранного" : "В избранное"}>
          <Heart
            className={styles.icon}
            size={24}
            fill={isFavorited ? "currentColor" : "none"}
          />
        </button>
      </div>
    </div>
  );
};
