-- Only new tables: existing lessons and accounts are referenced, never rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE "class_ladders" (
  "id" TEXT PRIMARY KEY,
  "owner_id" TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "discipline" TEXT NOT NULL,
  "audience" TEXT NOT NULL CHECK ("audience" IN ('Kids', 'Adults')),
  "levels" JSONB NOT NULL CHECK (jsonb_typeof("levels") = 'array'),
  "revision" INTEGER NOT NULL DEFAULT 1,
  UNIQUE ("owner_id", "discipline", "audience")
);
CREATE TABLE "coaching_classes" (
  "id" TEXT PRIMARY KEY,
  "owner_id" TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ladder_id" TEXT NOT NULL REFERENCES "class_ladders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "discipline" TEXT NOT NULL,
  "audience" TEXT NOT NULL CHECK ("audience" IN ('Kids', 'Adults')),
  "days" JSONB NOT NULL CHECK (jsonb_typeof("days") = 'array' AND jsonb_array_length("days") BETWEEN 1 AND 7),
  "goal" VARCHAR(500) NOT NULL DEFAULT '',
  "current_level" TEXT NOT NULL,
  "class_type" TEXT,
  "class_type_other" VARCHAR(40),
  "class_format" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "coaching_classes_owner_id_idx" ON "coaching_classes"("owner_id");
CREATE TABLE "class_lessons" (
  "class_id" TEXT NOT NULL REFERENCES "coaching_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "lesson_id" INTEGER NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "scheduled_date" DATE,
  PRIMARY KEY ("class_id", "lesson_id")
);
CREATE INDEX "class_lessons_lesson_id_idx" ON "class_lessons"("lesson_id");
COMMIT;
