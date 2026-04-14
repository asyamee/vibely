import styles from "../page.module.css";
import type { PlaylistTrackItem, RatedTrack } from "./types";
import { TrackRow } from "./TrackRow";

type Props = {
  title: string;
  description: string;
  playlistUuid: string;
  tracks: PlaylistTrackItem[];
  ratings: RatedTrack[];
  onRate: (playlistUuid: string, item: PlaylistTrackItem, stars: 1 | 2 | 3 | 4 | 5) => void;
  footer?: React.ReactNode;
  resolvePlaylistUuid?: (item: PlaylistTrackItem) => string;
};

export const PlaylistSection = ({
  title,
  description,
  playlistUuid,
  tracks,
  ratings,
  onRate,
  footer,
  resolvePlaylistUuid,
}: Props) => {
  if (!tracks.length) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.playlistTitle}>{title}</h2>
      <p className={styles.playlistDescription}>{description}</p>

      <div className={styles.trackList}>
        {tracks.map((item) => {
          const effectiveUuid = resolvePlaylistUuid
            ? resolvePlaylistUuid(item)
            : playlistUuid;

          return (
            <TrackRow
              key={item.id}
              playlistUuid={effectiveUuid}
              item={item}
              ratings={ratings}
              onRate={onRate}
            />
          );
        })}
      </div>

      {footer}
    </section>
  );
};

