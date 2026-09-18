export const pickParam = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v

export const defaultAvatar = (userId: string): string =>
  `https://avatars.yandex.net/get-yapic/${userId}/islands-retina-50`
