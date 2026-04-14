/**
 * Типы для объекта трека из плейлиста Яндекс.Музыки
 *
 * Структура объекта, который вы предоставили:
 * {
 *   id: 108721702,
 *   originalIndex: 0,
 *   timestamp: '2023-12-13T08:58:37+00:00',
 *   track: {
 *     id: '108721702',
 *     realId: '108721702',
 *     title: 'Я УБИЛ МАРКА',
 *     contentWarning: 'explicit',
 *     major: { id: 0, name: '-' },
 *     available: true,
 *     availableForPremiumUsers: true,
 *     availableFullWithoutPermission: false,
 *     availableForOptions: [ 'bookmate' ],
 *     disclaimers: [
 *       'foreignAgent:6475b9c41ee7dd46847bed88',
 *       'foreignAgent',
 *       'exclamationIcon:671a23afcec5646906723a52',
 *       'explicit',
 *       'descriptionText:67370e3fa2594774ebf92682',
 *       'descriptionText:67370c8e13b92b0a60256675'
 *     ],
 *     storageDir: '',
 *     durationMs: 222490,
 *     fileSize: 0,
 *     r128: { i: -9.51, tp: 0.04 },
 *     fade: { inStart: 0, inStop: 1.5, outStart: 220.9, outStop: 222.3 },
 *     previewDurationMs: 30000,
 *     artists: [ [Object] ],
 *     albums: [ [Object] ],
 *     coverUri: 'avatars.yandex.net/get-music-content/16450533/26fd427e.a.24018249-2/%%',
 *     derivedColors: {
 *       average: '#999999',
 *       waveText: '#e0e0e0',
 *       miniPlayer: '#b7b7b7',
 *       accent: '#999999'
 *     },
 *     ogImage: 'avatars.yandex.net/get-music-content/16450533/26fd427e.a.24018249-2/%%',
 *     lyricsAvailable: true,
 *     type: 'music',
 *     rememberPosition: false,
 *     backgroundVideoUri: 'https://strm.yandex.ru/vh-music-videoshots-converted/vod-content/6469416677179537424/mp4/mp4/360x640p.mp4',
 *     trackSharingFlag: 'COVER_ONLY',
 *     playerId: 'vd-5H-c-4cVg',
 *     lyricsInfo: { hasAvailableSyncLyrics: false, hasAvailableTextLyrics: false },
 *     trackSource: 'OWN',
 *     specialAudioResources: [ 'smart_preview' ]
 *   },
 *   recent: false,
 *   originalShuffleIndex: 0
 * }
 */

// Основной тип для объекта трека из плейлиста
export type PlaylistTrackItem = {
  id: number;
  originalIndex: number;
  timestamp: string;
  track: TrackExtended;
  recent: boolean;
  originalShuffleIndex: number;
};

// Расширенная версия типа Track с дополнительными полями
export type TrackExtended = {
  id: string;
  realId: string;
  title: string;
  contentWarning: string;
  major: Major;
  available: boolean;
  availableForPremiumUsers: boolean;
  availableFullWithoutPermission: boolean;
  availableForOptions: string[];
  disclaimers: string[];
  storageDir: string;
  durationMs: number;
  fileSize: number;
  r128: R128;
  fade: Fade;
  previewDurationMs: number;
  artists: Artist[];
  albums: Album[];
  coverUri: string;
  derivedColors: DerivedColors;
  ogImage: string;
  lyricsAvailable: boolean;
  type: string;
  rememberPosition: boolean;
  backgroundVideoUri: string;
  trackSharingFlag: string;
  playerId: string;
  lyricsInfo: LyricsInfo;
  trackSource: string;
  specialAudioResources: string[];
};

// Тип для основного жанра трека
export type Major = {
  id: number;
  name: string;
};

// Тип для R128 нормализации
export type R128 = {
  i: number;
  tp: number;
};

// Тип для фейдов
export type Fade = {
  inStart: number;
  inStop: number;
  outStart: number;
  outStop: number;
};

// Тип для цветов обложки
export type DerivedColors = {
  average: string;
  waveText: string;
  miniPlayer: string;
  accent: string;
};

// Тип для информации о текстах песни
export type LyricsInfo = {
  hasAvailableSyncLyrics: boolean;
  hasAvailableTextLyrics: boolean;
};

// Базовый тип для артиста (может потребоваться расширение в зависимости от полной структуры)
export type Artist = {
  id: number;
  name: string;
  cover?: any;
  composer?: boolean;
  various?: boolean;
  ticketsAvailable?: boolean;
  counts?: any;
  genres?: any[];
  popularTracks?: any[];
  regions?: string[];
  // Другие возможные поля можно добавить по мере необходимости
};

// Базовый тип для альбома (может потребоваться расширение в зависимости от полной структуры)
export type Album = {
  id: number;
  title: string;
  coverUri: string;
  trackCount: number;
  available: boolean;
  availableForPremiumUsers: boolean;
  artists: Artist[];
  genre: string;
  // Другие возможные поля можно добавить по мере необходимости
};
