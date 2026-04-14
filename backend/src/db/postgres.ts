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
  `);
}

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export async function getOrCreateTrackInternalId(
  db: Queryable,
  externalId: number,
): Promise<number> {
  const res = await db.query<{ id_internal: string }>(
    `
    INSERT INTO tracks (id_external)
    VALUES ($1)
    ON CONFLICT (id_external) DO UPDATE SET id_external = EXCLUDED.id_external
    RETURNING id_internal
  `,
    [externalId],
  );
  return Number(res.rows[0]!.id_internal);
}

export async function getOrCreateArtistInternalId(
  db: Queryable,
  externalId: number,
): Promise<number> {
  const res = await db.query<{ id_internal: string }>(
    `
    INSERT INTO artists (id_external)
    VALUES ($1)
    ON CONFLICT (id_external) DO UPDATE SET id_external = EXCLUDED.id_external
    RETURNING id_internal
  `,
    [externalId],
  );
  return Number(res.rows[0]!.id_internal);
}

export async function getOrCreateGenreInternalId(
  db: Queryable,
  externalId: string,
): Promise<number> {
  const res = await db.query<{ id_internal: string }>(
    `
    INSERT INTO genres (id_external)
    VALUES ($1)
    ON CONFLICT (id_external) DO UPDATE SET id_external = EXCLUDED.id_external
    RETURNING id_internal
  `,
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


