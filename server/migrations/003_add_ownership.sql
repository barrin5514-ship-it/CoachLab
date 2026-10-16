ALTER TABLE lessons ADD COLUMN owner_id TEXT;
ALTER TABLE lesson_media ADD COLUMN owner_id TEXT;
CREATE INDEX lessons_owner_id_idx ON lessons (owner_id);
CREATE INDEX lesson_media_owner_id_idx ON lesson_media (owner_id);
