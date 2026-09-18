export type Stars = 1 | 2 | 3 | 4 | 5

export const starsToRating = (stars: Stars): number => {
  switch (stars) {
    case 1: return -1.0
    case 2: return -0.5
    case 3: return -0.1
    case 4: return 0.5
    case 5: return 1.0
    default: return 0.0
  }
}
