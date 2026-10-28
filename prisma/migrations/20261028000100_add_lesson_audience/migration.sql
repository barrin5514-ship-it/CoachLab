BEGIN;
ALTER TABLE "lessons" ADD COLUMN "audience" TEXT DEFAULT 'Unspecified' CHECK ("audience" IN ('Kids', 'Adults', 'Unspecified'));
COMMIT;
