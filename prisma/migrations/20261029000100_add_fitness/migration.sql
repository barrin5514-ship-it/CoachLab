-- Expand the allowed discipline values without rewriting any lesson records.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_discipline_check";
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_discipline_check" CHECK ("discipline" IN ('Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training', 'Fitness'));
-- Nullable fields leave old clients and existing lessons valid.
ALTER TABLE "lessons" ADD COLUMN "class_type" TEXT DEFAULT NULL CHECK ("class_type" IN ('Personal training', 'Cardio kickboxing', 'Boxing fitness (non-contact)', 'Zumba / dance fitness', 'Rebounding (mini trampoline)', 'Bootcamp', 'HIIT', 'Circuit / strength', 'Spin / cycling', 'Yoga', 'Pilates', 'Other'));
ALTER TABLE "lessons" ADD COLUMN "class_type_other" VARCHAR(40) DEFAULT NULL;
ALTER TABLE "lessons" ADD COLUMN "class_format" TEXT DEFAULT NULL CHECK ("class_format" IN ('One-on-one', 'Small group', 'Group class'));
COMMIT;
