import type { Pool, PoolClient } from "pg";
import { Pool as PgPool } from "pg";

export type DbUserEvent = {
  user_id: string;
  playlist_uuid: string;
  track_id: number; // internal
  genre_id: number; // internal
  artist_ids: number[]; // internal
  rating: number;
  ts: string;
};

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL env var is required for Postgres");
  }

  _pool = new PgPool({
    connectionString,
  });

  return _pool;
}

export async function migrate(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id_internal BIGSERIAL PRIMARY KEY,
      id_external BIGINT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS artists (
      id_internal BIGSERIAL PRIMARY KEY,
      id_external BIGINT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS genres (
      id_internal BIGSERIAL PRIMARY KEY,
      id_external TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS user_events (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      playlist_uuid TEXT NOT NULL,
      track_id BIGINT NOT NULL REFERENCES tracks(id_internal),
      genre_id BIGINT NOT NULL REFERENCES genres(id_internal),
      artist_ids BIGINT[] NOT NULL,
      rating DOUBLE PRECISION NOT NULL,
      ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_events_track_id ON user_events(track_id);

    CREATE TABLE IF NOT EXISTS user_embeddings (
      user_id TEXT PRIMARY KEY,
      embedding DOUBLE PRECISION[] NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_genres (
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      genre TEXT NOT NULL,
      PRIMARY KEY (user_id, genre)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id_a TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      user_id_b TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id_a, user_id_b)
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

    ALTER TABLE tracks ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE tracks ADD COLUMN IF NOT EXISTS cover_url TEXT;
    ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist_ids_external BIGINT[];

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  `);
}

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function getOrCreateTrackInternalId(
  db: Queryable,
  externalId: number,
  meta?: { title?: string; coverUrl?: string; artistIdsExternal?: number[] },
): Promise<number> {
  const res = await db.query<{ id_internal: string }>(
    `INSERT INTO tracks (id_external, title, cover_url, artist_ids_external)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_external) DO UPDATE SET
       title = COALESCE($2, tracks.title),
       cover_url = COALESCE($3, tracks.cover_url),
       artist_ids_external = COALESCE($4, tracks.artist_ids_external)
     RETURNING id_internal`,
    [externalId, meta?.title ?? null, meta?.coverUrl ?? null, meta?.artistIdsExternal ?? null],
  );
  return Number(res.rows[0]!.id_internal);
}

export async function getOrCreateArtistInternalId(
  db: Queryable,
  externalId: number,
): Promise<number> {
  const existing = await db.query<{ id_internal: string }>(
    `SELECT id_internal FROM artists WHERE id_external = $1`,
    [externalId],
  );
  if (existing.rows.length > 0) return Number(existing.rows[0]!.id_internal);

  const res = await db.query<{ id_internal: string }>(
    `INSERT INTO artists (id_external) VALUES ($1) RETURNING id_internal`,
    [externalId],
  );
  return Number(res.rows[0]!.id_internal);
}

export async function getOrCreateGenreInternalId(
  db: Queryable,
  externalId: string,
): Promise<number> {
  const existing = await db.query<{ id_internal: string }>(
    `SELECT id_internal FROM genres WHERE id_external = $1`,
    [externalId],
  );
  if (existing.rows.length > 0) return Number(existing.rows[0]!.id_internal);

  const res = await db.query<{ id_internal: string }>(
    `INSERT INTO genres (id_external) VALUES ($1) RETURNING id_internal`,
    [externalId],
  );
  return Number(res.rows[0]!.id_internal);
}

export async function insertUserEvent(db: Queryable, ev: DbUserEvent): Promise<void> {
  await db.query(
    `
    INSERT INTO user_events
      (user_id, playlist_uuid, track_id, genre_id, artist_ids, rating, ts)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
  `,
    [
      ev.user_id,
      ev.playlist_uuid,
      ev.track_id,
      ev.genre_id,
      ev.artist_ids,
      ev.rating,
      ev.ts,
    ],
  );
}

export async function exportEventsForTraining(pool: Pool): Promise<string> {
  const res = await pool.query<{
    user_id: string;
    track_id: string;
    genre_id: string;
    artist_ids: (string | number)[];
    rating: number;
  }>(`
    SELECT user_id, track_id, genre_id, artist_ids, rating
    FROM user_events
    ORDER BY id ASC
  `);

  return res.rows
    .map((r) =>
      JSON.stringify({
        user_id: r.user_id,
        track_id: Number(r.track_id),
        genre_id: Number(r.genre_id),
        artist_ids: r.artist_ids.map((x: string | number) => Number(x)),
        rating: r.rating,
      }),
    )
    .join("\n");
}

export async function upsertUserEmbedding(
  pool: Pool,
  userId: string,
  embedding: number[],
): Promise<void> {
  await pool.query(
    `
    INSERT INTO user_embeddings (user_id, embedding)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET embedding = EXCLUDED.embedding
  `,
    [userId, embedding],
  );
}

export async function getUserEmbedding(
  pool: Pool,
  userId: string,
): Promise<number[] | null> {
  const res = await pool.query<{ embedding: number[] }>(
    `SELECT embedding FROM user_embeddings WHERE user_id = $1`,
    [userId],
  );
  if (!res.rows.length) return null;
  return res.rows[0]!.embedding;
}

export async function getAllUserEmbeddingsExcept(
  pool: Pool,
  userId: string,
): Promise<{ user_id: string; embedding: number[] }[]> {
  const res = await pool.query<{ user_id: string; embedding: number[] }>(
    `SELECT user_id, embedding FROM user_embeddings WHERE user_id <> $1`,
    [userId],
  );
  return res.rows;
}

export async function upsertUser(
  db: Queryable | Pool,
  userId: string,
  displayName?: string,
  avatarUrl?: string,
): Promise<void> {
  const url = avatarUrl || `https://avatars.yandex.net/get-yapic/${userId}/islands-retina-50`;
  await db.query(
    `
    INSERT INTO users (user_id, display_name, avatar_url)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id) DO UPDATE SET display_name = COALESCE($2, EXCLUDED.display_name), avatar_url = COALESCE($3, EXCLUDED.avatar_url)
  `,
    [userId, displayName || null, url],
  );
}

export async function getUser(
  pool: Pool,
  userId: string,
): Promise<{ user_id: string; display_name: string | null; avatar_url: string | null; created_at: string } | null> {
  const res = await pool.query<{ user_id: string; display_name: string | null; avatar_url: string | null; created_at: string }>(
    `SELECT user_id, display_name, avatar_url, created_at FROM users WHERE user_id = $1`,
    [userId],
  );
  return res.rows[0] || null;
}

export async function setUserGenres(
  pool: Pool,
  userId: string,
  genres: string[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM user_genres WHERE user_id = $1", [userId]);
    for (const genre of genres) {
      await client.query(
        "INSERT INTO user_genres (user_id, genre) VALUES ($1, $2)",
        [userId, genre],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function getUserGenres(pool: Pool, userId: string): Promise<string[]> {
  const res = await pool.query<{ genre: string }>(
    `SELECT genre FROM user_genres WHERE user_id = $1 ORDER BY genre ASC`,
    [userId],
  );
  return res.rows.map((r) => r.genre);
}

export async function getUserFavoriteTracks(
  pool: Pool,
  userId: string,
  limit: number = 5,
): Promise<{ track_id: number; title: string; artist: string }[]> {
  const res = await pool.query<{ track_id: string; title: string }>(
    `SELECT DISTINCT ON (ue.track_id)
       ue.track_id,
       t.title
     FROM user_events ue
     JOIN tracks t ON t.id_internal = ue.track_id
     WHERE ue.user_id = $1 AND ue.rating > 0 AND t.title IS NOT NULL
     ORDER BY ue.track_id, ue.rating DESC, ue.ts DESC
     LIMIT $2`,
    [userId, limit],
  );
  return res.rows.map((r) => ({
    track_id: Number(r.track_id),
    title: r.title,
    artist: "",
  }));
}

export async function getRandomTracks(
  pool: Pool,
  count: number,
): Promise<{ id_external: number; title: string; cover_url: string; artist_ids_external: number[] }[]> {
  const res = await pool.query<{
    id_external: string;
    title: string;
    cover_url: string;
    artist_ids_external: number[] | null;
  }>(
    `SELECT id_external, title, cover_url, artist_ids_external
     FROM tracks
     WHERE title IS NOT NULL AND cover_url IS NOT NULL
     ORDER BY RANDOM()
     LIMIT $1`,
    [count],
  );
  return res.rows.map((r) => ({
    id_external: Number(r.id_external),
    title: r.title,
    cover_url: r.cover_url,
    artist_ids_external: r.artist_ids_external ?? [],
  }));
}

export async function getUsersBatch(
  pool: Pool,
  userIds: string[],
): Promise<{
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  genres: string[];
  favorite_tracks: { track_id: number; title: string; artist: string }[];
}[]> {
  if (userIds.length === 0) return [];

  const res = await pool.query<{
    user_id: string;
    display_name: string | null;
    avatar_url: string | null;
    genres: string[] | null;
    favorite_tracks: string[] | null;
  }>(
    `SELECT
       u.user_id,
       u.display_name,
       u.avatar_url,
       array_agg(DISTINCT ug.genre) FILTER (WHERE ug.genre IS NOT NULL) AS genres,
       (
         SELECT array_agg(t.title)
         FROM (
           SELECT DISTINCT ON (ue2.track_id) ue2.track_id
           FROM user_events ue2
           WHERE ue2.user_id = u.user_id AND ue2.rating > 0
           ORDER BY ue2.track_id, ue2.rating DESC
           LIMIT 3
         ) top
         JOIN tracks t ON t.id_internal = top.track_id
         WHERE t.title IS NOT NULL
       ) AS favorite_tracks
     FROM users u
     LEFT JOIN user_genres ug ON ug.user_id = u.user_id
     WHERE u.user_id = ANY($1::text[])
     GROUP BY u.user_id, u.display_name, u.avatar_url`,
    [userIds],
  );

  return res.rows.map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    avatar_url: r.avatar_url,
    genres: r.genres ?? [],
    favorite_tracks: (r.favorite_tracks ?? []).map((title) => ({ track_id: 0, title, artist: "" })),
  }));
}

export async function addFriendRequest(pool: Pool, userId: string, targetUserId: string): Promise<void> {
  await pool.query(
    `
    INSERT INTO friendships (user_id_a, user_id_b, status)
    VALUES ($1, $2, 'pending')
    ON CONFLICT (user_id_a, user_id_b) DO NOTHING
  `,
    [userId, targetUserId],
  );
}

export async function acceptFriendRequest(pool: Pool, userId: string, friendId: string): Promise<void> {
  await pool.query(
    `
    UPDATE friendships
    SET status = 'accepted'
    WHERE (user_id_a = $1 AND user_id_b = $2) OR (user_id_a = $2 AND user_id_b = $1)
  `,
    [userId, friendId],
  );
}

export async function getUserFriends(
  pool: Pool,
  userId: string,
): Promise<{ user_id: string; display_name: string | null; avatar_url: string | null }[]> {
  const res = await pool.query<{ user_id: string; display_name: string | null; avatar_url: string | null }>(
    `
    SELECT u.user_id, u.display_name, u.avatar_url
    FROM friendships f
    JOIN users u ON (
      (f.user_id_a = $1 AND f.user_id_b = u.user_id) OR
      (f.user_id_b = $1 AND f.user_id_a = u.user_id)
    )
    WHERE f.status = 'accepted'
    ORDER BY f.created_at DESC
  `,
    [userId],
  );
  return res.rows;
}

export async function getUserByEmail(
  pool: Pool,
  email: string,
): Promise<{ user_id: string; password_hash: string | null; display_name: string | null } | null> {
  const res = await pool.query<{ user_id: string; password_hash: string | null; display_name: string | null }>(
    `SELECT user_id, password_hash, display_name FROM users WHERE email = $1`,
    [email],
  );
  return res.rows[0] || null;
}

export async function createUser(
  db: Queryable,
  data: { userId: string; email: string; passwordHash: string; displayName?: string | undefined },
): Promise<void> {
  await db.query(
    `
    INSERT INTO users (user_id, email, password_hash, display_name)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id) DO NOTHING
  `,
    [data.userId, data.email, data.passwordHash, data.displayName || null],
  );
}

export async function saveRefreshToken(
  pool: Pool,
  tokenHash: string,
  userId: string,
  expiresAt: Date,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (token_hash) DO NOTHING
  `,
    [tokenHash, userId, expiresAt.toISOString()],
  );
}

export async function getRefreshToken(
  pool: Pool,
  tokenHash: string,
): Promise<{ user_id: string; expires_at: string } | null> {
  const res = await pool.query<{ user_id: string; expires_at: string }>(
    `SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash],
  );
  if (!res.rows.length) return null;
  const row = res.rows[0]!;
  // Проверяем истёк ли токен
  if (new Date(row.expires_at) < new Date()) {
    await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
    return null;
  }
  return row;
}

export async function deleteRefreshToken(pool: Pool, tokenHash: string): Promise<void> {
  await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [tokenHash]);
}

export async function deleteExpiredRefreshTokens(pool: Pool): Promise<void> {
  await pool.query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
}

