import { useMemo, useState } from "react";
import type {
  Phase,
  PlaylistResponse,
  PlaylistTrackItem,
  RatedTrack,
} from "./types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3000/api";

const EXTRA_PLAYLIST_UUIDS: string[] = [
  "lk.695d49ad-cc25-4911-b08d-09133ff22c39",
  "lk.06eeb5b4-9608-464b-a1f0-0968b1d6710a",
  "lk.cfe1e91f-f088-49af-b395-7b14cb6eb828",
  "lk.59c4a183-e8f6-4403-9f4d-e5aa392d847d",
  "lk.964de00c-9c64-4b07-ad31-4db4de37bb31",
];

export function usePlaylistFlow() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playlistUuid, setPlaylistUuid] = useState<string>("");

  const [mainPlaylist, setMainPlaylist] = useState<PlaylistResponse | null>(
    null,
  );
  const [extraTracks, setExtraTracks] = useState<
    { sourcePlaylistUuid: string; item: PlaylistTrackItem }[]
  >([]);

  const [ratings, setRatings] = useState<RatedTrack[]>([]);

  const allMainRated = useMemo(() => {
    if (!mainPlaylist) return false;
    return mainPlaylist.tracks.every((t) =>
      ratings.some(
        (r) =>
          r.playlistUuid === mainPlaylist.playlistUuid && r.trackId === t.id,
      ),
    );
  }, [mainPlaylist, ratings]);

  const allExtraRated = useMemo(() => {
    if (!extraTracks.length) return false;
    return extraTracks.every((t) =>
      ratings.some(
        (r) =>
          r.playlistUuid === t.sourcePlaylistUuid && r.trackId === t.item.id,
      ),
    );
  }, [extraTracks, ratings]);

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
      stars,
    };

    setRatings((prev) => {
      const withoutThis = prev.filter(
        (r) =>
          !(
            r.playlistUuid === rated.playlistUuid && r.trackId === rated.trackId
          ),
      );
      return [...withoutThis, rated];
    });
  };

  const fetchPlaylist = async () => {
    try {
      setError(null);
      setLoading(true);
      setPhase("idle");
      setRatings([]);

      const res = await fetch(`${BACKEND_URL}/playlist/${playlistUuid}`);
      if (!res.ok) {
        throw new Error(`Ошибка загрузки плейлиста: ${res.status}`);
      }
      const data = (await res.json()) as PlaylistResponse;
      const shuffled = [...data.tracks];
      shuffled.sort(() => Math.random() - 0.5);
      const limitedTracks = shuffled.slice(0, 100);

      setMainPlaylist({ ...data, tracks: limitedTracks });
      setPhase("rating_main");
    } catch (e: any) {
      setError(e.message ?? "Не удалось загрузить плейлист");
    } finally {
      setLoading(false);
    }
  };

  const loadExtraTracks = async () => {
    if (!EXTRA_PLAYLIST_UUIDS.length) {
      setPhase("done");
      return;
    }
    try {
      setError(null);
      setLoading(true);

      const allTracks: {
        sourcePlaylistUuid: string;
        item: PlaylistTrackItem;
      }[] = [];
      for (const uuid of EXTRA_PLAYLIST_UUIDS) {
        const res = await fetch(`${BACKEND_URL}/playlist/${uuid}`);
        if (!res.ok) continue;
        const data = (await res.json()) as PlaylistResponse;
        allTracks.push(
          ...data.tracks.map((item) => ({
            sourcePlaylistUuid: data.playlistUuid,
            item,
          })),
        );
      }

      const uniqueByRealId = new Map<
        string,
        { sourcePlaylistUuid: string; item: PlaylistTrackItem }
      >();
      for (const t of allTracks) {
        const key = t.item.track.realId;
        if (!uniqueByRealId.has(key)) {
          uniqueByRealId.set(key, t);
        }
      }

      const uniqueTracks = Array.from(uniqueByRealId.values());
      uniqueTracks.sort(() => Math.random() - 0.5);
      const sampled = uniqueTracks.slice(0, 20);

      setExtraTracks(sampled);
      setPhase("rating_extra");
    } catch (e: any) {
      setError(e.message ?? "Не удалось загрузить дополнительные треки");
    } finally {
      setLoading(false);
    }
  };

  const submitRatings = async () => {
    try {
      setError(null);
      setLoading(true);

      const payload = {
        mainPlaylistUuid: mainPlaylist?.playlistUuid ?? playlistUuid,
        ratings,
      };

      const res = await fetch(`${BACKEND_URL}/ratings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log(res);

      if (!res.ok) {
        throw new Error("Ошибка сохранения ответов");
      }

      setPhase("done");
    } catch (e: any) {
      setError(e.message ?? "Не удалось отправить рейтинги");
    } finally {
      setLoading(false);
    }
  };

  return {
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
  };
}
