BEGIN;
CREATE TABLE "lessons" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "discipline" TEXT NOT NULL,
  "skill_level" TEXT NOT NULL DEFAULT 'Beginner',
  "duration_minutes" INTEGER,
  "goal" TEXT NOT NULL DEFAULT '',
  "drills" TEXT NOT NULL DEFAULT '',
  "coaching_notes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lessons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "lessons_title_check" CHECK (length(trim("title")) > 0),
  CONSTRAINT "lessons_discipline_check" CHECK ("discipline" IN ('Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training')),
  CONSTRAINT "lessons_skill_level_check" CHECK ("skill_level" IN ('Beginner', 'Intermediate', 'Advanced')),
  CONSTRAINT "lessons_duration_check" CHECK ("duration_minutes" > 0)
);
COMMIT;
