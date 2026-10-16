CREATE TABLE lesson_media (
  id INTEGER PRIMARY KEY,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'youtube')),
  origin TEXT NOT NULL CHECK (origin IN ('upload', 'link', 'suggested')),
  url TEXT,
  title TEXT NOT NULL DEFAULT '',
  activity TEXT NOT NULL DEFAULT '',
  mime TEXT,
  size_bytes INTEGER,
  data BLOB,
  credit TEXT NOT NULL DEFAULT '',
  source_page TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((origin = 'upload' AND data IS NOT NULL AND url IS NULL) OR (origin <> 'upload' AND data IS NULL AND url IS NOT NULL))
) STRICT;
CREATE INDEX lesson_media_lesson_id_idx ON lesson_media (lesson_id);
