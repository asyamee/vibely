"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/shared/store/userStore";
import { getPlaylist, getRandomTracks, saveRatings } from "@/shared/api/ratings.api";
import type { PlaylistResponse, PlaylistTrackItem, RatingItem } from "@/shared/api/ratings.api";
import { Button } from "@/shared/ui/Button/Button";
import styles from "./ModelTrainPage.module.css";

const MAIN_PLAYLIST_LIMIT = 25;
const EXTRA_TRACKS_COUNT = 10;
const VIBELY_RANDOM_UUID = "vibely-random";

type RatedTrack = RatingItem;
type Phase = "input" | "rating_main" | "rating_extra" | "done";

export const ModelTrainPage: React.FC = () => {
  const router = useRouter();
  const { userId } = useUserStore();
  const [playlistUUID, setPlaylistUUID] = useState("");
  const [mainPlaylist, setMainPlaylist] = useState<PlaylistResponse | null>(null);
  const [extraTracks, setExtraTracks] = useState<PlaylistTrackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ratings, setRatings] = useState<RatedTrack[]>([]);
  const [phase, setPhase] = useState<Phase>("input");

  const mainRatedCount = useMemo(() => {
    if (!mainPlaylist) return 0;
    return ratings.filter((r) => r.playlistUuid === mainPlaylist.playlistUuid).length;
  }, [mainPlaylist, ratings]);

  const setRating = (
    playlistUuidValue: string,
    item: PlaylistTrackItem,
    stars: 1 | 2 | 3 | 4 | 5,
  ) => {
    const genre =
      item.track.albums && item.track.albums[0]
        ? (item.track.albums[0].genre ?? null)
        : null;

    const rated: RatedTrack = {
      playlistUuid: playlistUuidValue,
      trackId: item.id,
      title: item.track.title,
      artistsIds: item.track.artists.map((a) => a.id),
      trackGenre: genre,
      coverUrl: item.track.ogImage,
      stars,
    };

    setRatings((prev) => {
      const withoutThis = prev.filter(
        (r) => !(r.playlistUuid === rated.playlistUuid && r.trackId === rated.trackId),
      );
      return [...withoutThis, rated];
    });
  };

  const extractPlaylistId = (input: string): string => {
    const match = input.match(/playlists\/([^/?#]+)/);
    if (match) return match[1];
    return input.trim();
  };

  const handleLoadPlaylist = async () => {
    const trimmedInput = playlistUUID.trim();
    if (!trimmedInput) {
      setError("Введите UUID плейлиста или ссылку на плейлист Яндекс.Музыки");
      return;
    }

    const extractedId = extractPlaylistId(trimmedInput);
    setLoading(true);
    setError(null);
    setRatings([]);

    try {
      const data = await getPlaylist(extractedId, { shuffle: true, limit: MAIN_PLAYLIST_LIMIT });
      setMainPlaylist(data);
      setPhase("rating_main");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки плейлиста");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadExtraTracks = async () => {
    if (mainRatedCount === 0) {
      setError("Оцени хотя бы один трек основного плейлиста");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const tracks = await getRandomTracks(EXTRA_TRACKS_COUNT);
      setExtraTracks(tracks);
      setPhase("rating_extra");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки дополнительных треков");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!mainPlaylist || ratings.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      await saveRatings({
        mainPlaylistUuid: mainPlaylist.playlistUuid,
        ratings,
      });
      setPhase("done");
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении оценок");
    } finally {
      setLoading(false);
    }
  };

  if (phase === "input") {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Обучение модели</h1>
          <p className={styles.description}>
            Загрузи плейлист из Яндекс.Музыки и оцени его треки, чтобы система нашла похожих на
            тебя пользователей.
          </p>

          <div className={styles.formGroup}>
            <label htmlFor="playlistId" className={styles.label}>
              UUID плейлиста
            </label>
            <input
              id="playlistId"
              type="text"
              placeholder="1746...4 или полная ссылка"
              value={playlistUUID}
              onChange={(e) => setPlaylistUUID(e.target.value)}
              className={styles.input}
            />
            <p className={styles.hint}>
              Найдешь UUID в URL плейлиста: music.yandex.ru/users/{userId}/playlists/[UUID]
            </p>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <Button
            variant="primary"
            onClick={handleLoadPlaylist}
            disabled={loading || !playlistUUID.trim()}
            className={styles.submitButton}
          >
            {loading ? "Загрузка..." : "Загрузить плейлист"}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "rating_main" && mainPlaylist) {
    const totalMain = mainPlaylist.tracks.length;

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.subtitle}>Основной плейлист</h2>
            <span className={styles.progress}>
              {mainRatedCount} / {totalMain}
            </span>
          </div>

          <div className={styles.trackList}>
            {mainPlaylist.tracks.map((track) => {
              const rating = ratings.find(
                (r) => r.playlistUuid === mainPlaylist.playlistUuid && r.trackId === track.id,
              );
              return (
                <TrackRatingRow
                  key={track.id}
                  track={track}
                  rating={rating?.stars || 0}
                  onRate={(stars) => setRating(mainPlaylist.playlistUuid, track, stars)}
                />
              );
            })}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <Button
            variant="primary"
            onClick={handleLoadExtraTracks}
            disabled={loading || mainRatedCount === 0}
            className={styles.submitButton}
          >
            {loading ? "Загрузка..." : "Далее"}
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "rating_extra") {
    const extraRatedCount = ratings.filter(
      (r) => r.playlistUuid === VIBELY_RANDOM_UUID && extraTracks.some((t) => t.id === r.trackId),
    ).length;

    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h2 className={styles.subtitle}>Дополнительные треки</h2>
            <span className={styles.progress}>
              {extraRatedCount} / {extraTracks.length}
            </span>
          </div>

          <div className={styles.trackList}>
            {extraTracks.map((track) => {
              const rating = ratings.find(
                (r) => r.playlistUuid === VIBELY_RANDOM_UUID && r.trackId === track.id,
              );
              return (
                <TrackRatingRow
                  key={track.id}
                  track={track}
                  rating={rating?.stars || 0}
                  onRate={(stars) => setRating(VIBELY_RANDOM_UUID, track, stars)}
                />
              );
            })}
          </div>

          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => setPhase("rating_main")}>
              Назад
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Сохранение..." : "Завершить"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h2 className={styles.subtitle}>✓ Спасибо!</h2>
          <p className={styles.description}>
            Твой профиль создан. Сейчас будут найдены похожие пользователи...
          </p>

          <Button variant="primary" onClick={() => router.push("/")} disabled={loading}>
            На главную
          </Button>
        </div>
      </div>
    );
  }

  return null;
};

interface TrackRatingRowProps {
  track: PlaylistTrackItem;
  rating: number;
  onRate: (stars: 1 | 2 | 3 | 4 | 5) => void;
}

const TrackRatingRow: React.FC<TrackRatingRowProps> = ({ track, rating, onRate }) => {
  const artistName =
    track.track.artists && track.track.artists.length > 0 && track.track.artists[0]!.name
      ? track.track.artists[0].name
      : "Неизвестный исполнитель";

  return (
    <div className={styles.trackRow}>
      <div className={styles.trackInfo}>
        <p className={styles.trackTitle}>{track.track.title}</p>
        <p className={styles.trackArtist}>{artistName}</p>
      </div>

      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            className={`${styles.star} ${rating >= star ? styles.starActive : ""}`}
            onClick={() => onRate(star as 1 | 2 | 3 | 4 | 5)}
            aria-label={`Оценка ${star}`}
            type="button"
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
};
