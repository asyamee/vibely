"use client";

import React from "react";
import { Heart, UserRound, ExternalLink } from "lucide-react";
import { GenreTag } from "@/shared/ui/GenreTag/GenreTag";
import styles from "./UserCard.module.css";
import type { UserCardData } from "../model/types";

interface UserCardProps {
  user: UserCardData;
  onSendRequest?: () => void;
  onFavorite?: () => void;
  isFavorited?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onSendRequest,
  onFavorite,
  isFavorited = false,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <img
          src={user.avatarUrl}
          alt={user.displayName || user.userId}
          className={styles.avatar}
        />
        <div className={styles.info}>
          <h3 className={styles.name}>{user.displayName || user.userId}</h3>
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
        <button className={styles.actionButton} onClick={onFavorite}>
          <UserRound className={styles.icon} size={24} />
        </button>
        {onSendRequest && (
          <button className={styles.primaryButton} onClick={onSendRequest}>
            Отправить запрос
          </button>
        )}
        <button className={styles.actionButton} onClick={onFavorite}>
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
