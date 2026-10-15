# Phase 9C.1 PostgreSQL migration verification

Date: 2026-10-15. Scope: initial development schema only. SQLite remains active.

## Target and safety gates

Authenticated Neon Console independently identified project CoachLab (`rapid-firefly-98778665`), branch Development (`br-flat-fog-b5t1m0vy`), endpoint `ep-long-bird-b50l2nhb`. Production is the separate parent/default branch `br-sweet-bread-b5wwc4g1`; it was not targeted. Local project/branch declarations matched the Console. Pooled and direct hosts normalized to that endpoint and matched database/role. The direct connection authenticated using certificate-verified TLS, PostgreSQL 18.6, database `neondb`. Its READ ONLY transaction found zero user tables before deployment. Credentials stayed in the ignored .env and process memory; no full URLs or passwords were printed.

Starting main was clean at baa7be1c58723ce6bdc7e3ad9e62db3c64da4880. Baseline audit: zero vulnerabilities. Baseline tests: 30 SQLite/API/mocked Gemini plus 5 Prisma tests passed.

## SQL review and execution

The previously missing SQL artifact was obtained with Prisma 7.10.0 migrate diff using a separate explicit development datasource configuration, --from-empty, --to-schema prisma/schema.prisma, --script and --output. The file was opened and inspected: it contains CREATE SCHEMA IF NOT EXISTS public and CREATE TABLE lessons, all nine columns and the primary key. This resolves the execution prerequisite; it does not establish why the earlier offline configuration produced no file.

The existing versioned migration additionally preserves the four SQLite CHECK constraints and wraps table creation in BEGIN/COMMIT. The existing public schema was available. No migration source changes were necessary. Prisma migrate deploy with the explicit development config applied 20261015000100_create_lessons successfully (exit 0). Prisma migrate status subsequently returned exit 0 and up to date. The migration ledger contains exactly one completed, non-rolled-back entry.

Temporary configuration and probes were kept under ignored tmp; they are not application code or a new supported migration command. The default prisma.config.js remains offline-only. Future migrations require a fresh target review and separate approval.

## Verified structure

| Field | PostgreSQL type | Nullable | Default / rule |
| --- | --- | --- | --- |
| id | integer | No | Sequence-generated SERIAL; primary key |
| title | text | No | Trimmed length greater than zero |
| discipline | text | No | Existing six discipline values |
| skill_level | text | No | Beginner; Beginner/Intermediate/Advanced only |
| duration_minutes | integer | Yes | Positive if supplied |
| goal | text | No | Empty string |
| drills | text | No | Empty string |
| coaching_notes | text | No | Empty string |
| created_at | timestamp with time zone | No | CURRENT_TIMESTAMP, declared millisecond precision |

Catalog inspection confirmed every column, type, nullability and default, plus the primary key and all four CHECK definitions. SQLite has the same nine fields and validation intent. SQLite IDs have a wider range than PostgreSQL integer, so any future import requires an ID-range preflight. PostgreSQL returns Date objects through Prisma; SQLite currently stores UTC text. Any future API switch must preserve the existing serialized UTC format. No import or API switch happened.

## Live pooled Prisma verification

Using the existing createDevelopmentClient, a transaction created an automatically numbered BJJ lesson, read it back by ID, and checked Beginner/null/empty-text defaults and a current Date timestamp. Six savepoint-isolated inserts proved rejection of blank title, unknown discipline, unknown skill level, zero duration, null title and duplicate primary key. Expected PostgreSQL SQLSTATEs were 23514, 23502 and 23505. Seven grouped probes passed. The enclosing transaction deliberately rolled back: lesson count was zero before and zero afterward. No real SQLite record was read, copied or changed. PostgreSQL sequences are not transactional: these probes consumed IDs even though rows rolled back; harmless gaps remain and no sequence reset was performed.

Pooled application queries and the direct migration connection both worked. This is functional connectivity evidence, not a concurrency/load benchmark. No production query or write was performed.

## Genuine verification mistake

The first catalog assertion expected exactly five pg_constraint rows. PostgreSQL 18 also exposes NOT NULL constraints there, producing 13 rows. This assertion failed before record probes. Corrected the temporary query to count primary-key and CHECK types explicitly; nullability was checked separately through information_schema.columns. The corrected verification passed. No application or migration repair was needed.

## Regression verification

After migration: npm test passed 30/30, npm run test:prisma passed 5/5 and generated/compiled Client 7.10.0, prisma:validate passed. Build, syntax, documentation and final audit results are recorded in the prompt log after execution. Gemini tests use mocks; no fresh live Gemini request is claimed. Active server/index.js still opens SQLite and runs only its existing migrations; application source/configuration is unchanged.

## Boundary

Development schema is initialized and Prisma create/read verified. Existing SQLite lessons remain authoritative. No Phase 9C.2, data transfer, application switch, paid service, reset, db push or production modification is authorized by this report.

Final local results: React build passed (20 modules), npm audit found zero vulnerabilities, JavaScript syntax checks passed. Documentation checker matched 33 source/configuration files and 1,111 explained lines. Security screening covered 46 project files, ignored paths and frontend bundle separation. Only the five named Markdown documents are included in this phase's commit.
