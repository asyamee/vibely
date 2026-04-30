"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addUserPlaylist,
  listUserPlaylists,
  removeUserPlaylist,
  type UserPlaylist,
} from "@/shared/api/users.api";
import { getPlaylist, type PlaylistResponse, type RatingItem } from "@/shared/api/ratings.api";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import styles from "./MyPlaylistsPage.module.css";

interface Props {
  userId: string;
  initialPlaylists: UserPlaylist[];
}

const extractPlaylistId = (input: string): string => {
  const match = input.match(/playlists\/([^/?#]+)/);
  return match ? match[1] : input.trim();
};

export const MyPlaylistsPage: React.FC<Props> = ({ userId, initialPlaylists }) => {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(initialPlaylists);
  const [uuidInput, setUuidInput] = useState("");
  const [loaded, setLoaded] = useState<PlaylistResponse | null>(null);
  const [ratings, setRatings] = useState<Record<number, 1 | 2 | 3 | 4 | 5>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = async () => {
    const fresh = await listUserPlaylists(userId);
    setPlaylists(fresh.playlists);
  };

  const handleLoad = async () => {
    setError(null);
    setInfo(null);
    if (!uuidInput.trim()) return;
    setBusy(true);
    try {
      const data = await getPlaylist(extractPlaylistId(uuidInput), { shuffle: true, limit: 25 });
      setLoaded(data);
      setRatings({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки плейлиста");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!loaded) return;
    setBusy(true);
    setError(null);
    setInfo("Пересчитываем эмбеддинг...");
    try {
      const ratedItems: RatingItem[] = loaded.tracks
        .filter((t) => ratings[t.id])
        .map((t) => ({
          playlistUuid: loaded.playlistUuid,
          trackId: t.id,
          title: t.track.title,
          artistsIds: t.track.artists.map((a) => a.id),
          trackGenre: t.track.albums?.[0]?.genre ?? null,
          coverUrl: t.track.ogImage,
          stars: ratings[t.id]!,
        }));
      if (ratedItems.length === 0) {
        setError("Оцените хотя бы один трек");
        setBusy(false);
        setInfo(null);
        return;
      }
      await addUserPlaylist(userId, {
        playlistUuid: loaded.playlistUuid,
        title: loaded.title,
        ratings: ratedItems,
      });
      setLoaded(null);
      setUuidInput("");
      setRatings({});
      setInfo("Плейлист добавлен, эмбеддинг пересчитан");
      await refresh();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
      setInfo(null);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (playlistUuid: string) => {
    if (!confirm("Удалить плейлист и пересчитать вектор?")) return;
    setBusy(true);
    setError(null);
    try {
      await removeUserPlaylist(userId, playlistUuid);
      await refresh();
      setInfo("Плейлист удалён, эмбеддинг пересчитан");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Мои плейлисты</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Учтённые плейлисты</h2>
        {playlists.length === 0 ? (
          <p className={styles.empty}>Список пуст</p>
        ) : (
          <ul className={styles.list}>
            {playlists.map((p) => (
              <li key={p.playlistUuid} className={styles.item}>
                <div>
                  <strong>{p.title || p.playlistUuid}</strong>
                  {p.isPrimary && <span className={styles.badge}>основной</span>}
                  <div className={styles.muted}>{new Date(p.addedAt).toLocaleDateString()}</div>
                </div>
                {!p.isPrimary && (
                  <Button
                    variant="secondary"
                    onClick={() => handleRemove(p.playlistUuid)}
                    disabled={busy}
                  >
                    Удалить
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Добавить плейлист</h2>
        <p className={styles.muted}>
          Эти оценки повлияют только на ваш эмбеддинг и не попадут в общий датасет обучения.
        </p>
        {!loaded ? (
          <div className={styles.row}>
            <Input
              placeholder="UUID или ссылка на плейлист"
              value={uuidInput}
              onChange={(e) => setUuidInput(e.target.value)}
            />
            <Button variant="primary" onClick={handleLoad} disabled={busy || !uuidInput.trim()}>
              {busy ? "Загрузка..." : "Загрузить"}
            </Button>
          </div>
        ) : (
          <div className={styles.rateBlock}>
            <h3 className={styles.subTitle}>{loaded.title}</h3>
            <div className={styles.trackList}>
              {loaded.tracks.map((t) => (
                <div key={t.id} className={styles.trackRow}>
                  <div className={styles.trackInfo}>
                    <div className={styles.trackTitle}>{t.track.title}</div>
                    <div className={styles.muted}>
                      {t.track.artists.map((a) => a.name).join(", ")}
                    </div>
                  </div>
                  <div className={styles.stars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        className={`${styles.star} ${(ratings[t.id] ?? 0) >= s ? styles.starActive : ""}`}
                        onClick={() =>
                          setRatings((prev) => ({ ...prev, [t.id]: s as 1 | 2 | 3 | 4 | 5 }))
                        }
                        type="button"
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              <Button variant="secondary" onClick={() => setLoaded(null)} disabled={busy}>
                Отмена
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={busy}>
                {busy ? "Сохраняем..." : "Сохранить и пересчитать"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {error && <p className={styles.error}>{error}</p>}
      {info && <p className={styles.info}>{info}</p>}
    </div>
  );
};
