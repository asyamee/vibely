"use client";

import styles from "../page.module.css";
import { PlaylistSection } from "./PlaylistSection";
import { usePlaylistFlow } from "./usePlaylistFlow";

const RatesPage = () => {
  const {
    phase,
    loading,
    error,
    playlistUuid,
    setPlaylistUuid,
    mainPlaylist,
    extraTracks,
    ratings,
    allMainRated,
    allExtraRated,
    setRating,
    fetchPlaylist,
    loadExtraTracks,
    submitRatings,
  } = usePlaylistFlow();

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.heading}>Оценка плейлиста</h1>

        <section className={styles.section}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>UUID плейлиста</label>
              <input
                className={styles.input}
                placeholder="вставь UUID плейлиста Я.Музыки"
                value={playlistUuid}
                onChange={(e) => setPlaylistUuid(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={fetchPlaylist}
            disabled={!playlistUuid || loading}
            className={styles.buttonPrimary}
          >
            {loading ? "Загружаю..." : "Загрузить плейлист"}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </section>

        {mainPlaylist && (
          <PlaylistSection
            title={mainPlaylist.title}
            description="Оцени треки от 1 до 5 — это поможет собрать твой вкусовой профиль."
            playlistUuid={mainPlaylist.playlistUuid}
            tracks={mainPlaylist.tracks}
            ratings={ratings}
            onRate={setRating}
            footer={
              phase === "rating_main" ? (
                <div className={styles.footer}>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    disabled={!allMainRated || loading}
                    onClick={loadExtraTracks}
                  >
                    Продолжить — ещё треки
                  </button>
                </div>
              ) : null
            }
          />
        )}

        {phase === "rating_extra" && extraTracks.length > 0 && (
          <PlaylistSection
            title="Дополнительные треки для уточнения вкуса"
            description="Оцени ещё несколько случайных треков."
            playlistUuid="extra"
            tracks={extraTracks.map((t) => t.item)}
            ratings={ratings}
            onRate={setRating}
            resolvePlaylistUuid={(item) =>
              extraTracks.find((t) => t.item.id === item.id)?.sourcePlaylistUuid ||
              "extra"
            }
            footer={
              <div className={styles.footer}>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  disabled={!allExtraRated || loading}
                  onClick={submitRatings}
                >
                  Завершить и сохранить
                </button>
              </div>
            }
          />
        )}

        {phase === "done" && (
          <p className={styles.doneText}>
            Спасибо! Оценки сохранены, они будут использованы для обучения
            модели.
          </p>
        )}
      </div>
    </main>
  );
};

export default RatesPage;

