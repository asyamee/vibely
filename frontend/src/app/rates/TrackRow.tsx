import styles from "../page.module.css";
import type { PlaylistTrackItem, RatedTrack } from "./types";
import { StarRating } from "./StarRating";
import Image from "next/image";

type Props = {
  playlistUuid: string;
  item: PlaylistTrackItem;
  ratings: RatedTrack[];
  onRate: (
    playlistUuid: string,
    item: PlaylistTrackItem,
    stars: 1 | 2 | 3 | 4 | 5,
  ) => void;
};

export const TrackRow = ({ playlistUuid, item, ratings, onRate }: Props) => {
  const current = ratings.find(
    (r) => r.playlistUuid === playlistUuid && r.trackId === item.id,
  );

  return (
    <div className={styles.trackItem}>
      <div className={styles.trackInfo}>
        <Image
          src={"https://" + item.track.ogImage?.replace("%%", "300x300")}
          alt=""
          width="100"
          height="100"
          style={{
            width: "auto",
            height: "100%",
          }}
        />
        <div className={styles.trackTitle}>{item.track.title}</div>
        <div className={styles.trackArtists}>
          {item.track.artists.map((a) => a.name).join(", ")}
        </div>
      </div>
      <StarRating
        value={current?.stars}
        onChange={(s) => onRate(playlistUuid, item, s)}
      />
    </div>
  );
};
