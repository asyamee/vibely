-- Vibely Postgres schema for ratings -> training events

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

