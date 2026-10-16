BEGIN;
CREATE TABLE "lesson_media" (
  "id" SERIAL NOT NULL,
  "lesson_id" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "kind" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "url" TEXT,
  "title" TEXT NOT NULL DEFAULT '',
  "activity" TEXT NOT NULL DEFAULT '',
  "mime" TEXT,
  "size_bytes" INTEGER,
  "data" BYTEA,
  "credit" TEXT NOT NULL DEFAULT '',
  "source_page" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lesson_media_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "lesson_media_kind_check" CHECK ("kind" IN ('image', 'video', 'youtube')),
  CONSTRAINT "lesson_media_origin_check" CHECK ("origin" IN ('upload', 'link', 'suggested')),
  CONSTRAINT "lesson_media_source_check" CHECK (("origin" = 'upload' AND "data" IS NOT NULL AND "url" IS NULL) OR ("origin" <> 'upload' AND "data" IS NULL AND "url" IS NOT NULL))
);
CREATE INDEX "lesson_media_lesson_id_idx" ON "lesson_media"("lesson_id");
COMMIT;
