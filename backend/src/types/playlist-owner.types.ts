/**
 * Типы для владельца плейлиста Яндекс.Музыки
 */

export type PlaylistOwner = {
  uid: number;
  login: string;
  name: string;
  verified: boolean;
  sex: "male" | "female" | string;
};
