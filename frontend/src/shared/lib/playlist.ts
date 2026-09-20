export function extractPlaylistId(input: string): string {
  const match = input.match(/playlists\/([^/?#]+)/);
  return match ? match[1] : input.trim();
}
