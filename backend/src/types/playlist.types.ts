/**
 * Общие типы для плейлиста Яндекс.Музыки
 */

import type { PlaylistOwner } from "./playlist-owner.types.js";
import type { PlaylistTrackItem } from "./playlist-track.types.js";

export type PlaylistResponse = {
  playlistUuid: string;
  owner: PlaylistOwner;
  tracks: PlaylistTrackItem[];
  trackCount: number;
  title: string;
  cover: string; // ogImage с заменённым %% на размер
};

export type RawPlaylistResponse = {
  playlistUuid: string;
  owner: PlaylistOwner;
  tracks: PlaylistTrackItem[];
  trackCount: number;
  title: string;
  ogImage: string;
};
