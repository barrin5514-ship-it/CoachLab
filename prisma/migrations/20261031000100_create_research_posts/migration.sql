-- Only a new table: existing lessons and accounts are referenced, never rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE "research_posts" (
  "id" SERIAL NOT NULL,
  "owner_id" TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "source_id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "url" TEXT NOT NULL DEFAULT '',
  "summary" TEXT NOT NULL DEFAULT '',
  "transcript" TEXT NOT NULL DEFAULT '',
  "discipline" TEXT NOT NULL DEFAULT '',
  "drills" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "research_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "research_posts_owner_id_source_id_key" ON "research_posts"("owner_id", "source_id");
CREATE INDEX "research_posts_owner_id_idx" ON "research_posts"("owner_id");
COMMIT;
