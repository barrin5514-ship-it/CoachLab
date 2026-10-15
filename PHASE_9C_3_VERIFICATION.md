# Phase 9C.3 — Final data migration validation

Date: 2026-10-15. Baseline commit: b656bfae7e361ab4038908e89d081b7a0afa7244. Starting working tree clean. SQLite remains active.

## Authorization and isolation

The user authorized disposable copies of historical test records in an isolated PostgreSQL database or schema, not import into the application table. Authenticated Neon Console freshly verified project CoachLab (rapid-firefly-98778665), Development branch br-flat-fog-b5t1m0vy, endpoint ep-long-bird-b50l2nhb and a distinct production parent/default branch. Local direct/pooled settings matched that endpoint, neondb and the same role. Actual direct authentication checked database and role before CREATE SCHEMA. No production operation was performed.

The test creates a UUID-named coachlab_validation_ schema inside one outer transaction. It sets transaction-local search_path to that schema only and verifies current_schema plus the lessons relation OID before any record insert. The existing reviewed table migration is executed without its own BEGIN/COMMIT wrappers, retaining the outer transaction. Each scenario has a rollback savepoint. Final ROLLBACK removes the entire schema. Read-only fingerprints prove public.lessons and public.lessons_id_seq are unchanged; the application table starts and ends empty. No test record is committed to PostgreSQL. This schema is logical isolation using the development role, not a separately restricted database role; safeguards and reviewed SQL are essential.

## Actual records and copies

- Phase 5 source: C:\Users\barri\AppData\Local\Temp\coachlab-phase5-browser.sqlite — 2 records, IDs 1–2.
- Phase 6 source: C:\Users\barri\AppData\Local\Temp\coachlab-phase6-5e41139d2e67438d9f986da446b438e3\browser.sqlite — 7 records, IDs 1–7.
- Main configured source: C:\Users\barri\AppData\Local\CoachLab\coachlab.sqlite — previously and currently empty; never selected as a migration-test source.

The SQLite backup API creates disposable source-0.sqlite and source-1.sqlite copies under the system temporary directory with prefix coachlab-migration-validation-. Copies stay outside OneDrive/Git and pass integrity_check. Original files are opened read-only for backup; records are read only from the copies. Both original SHA-256 hashes match before/after each successful run. No original IDs, timestamps or content changed. Copies remain local for investigation; no historical lesson payload or database file is committed.

## Record comparison and scenarios

All nine fields were compared individually for all nine records: id, title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes and created_at. That is **81 field values** (18 plus 63), with exact scalar equality after converting only timestamps to canonical UTC ISO strings. Null and empty text stay distinct. Results are reported as counts, not lesson contents. Original timestamps pass canonical millisecond ISO validation; reading with the PostgreSQL session timezone changed to America/New_York preserves the same UTC values. Sub-millisecond and malformed historical timestamps are outside this validated source set; future import preflight must reject or explicitly handle them.

Eight scenarios passed under the parent integration test:

1. Phase 5: all 2 records / 18 fields preserved, including timestamps under a changed session timezone.
2. Phase 6: all 7 records / 63 fields preserved with the same checks.
3. Repeat the Phase 5 import and attempt Phase 6 over its overlapping IDs: both reject with SQLSTATE 23505; original rows remain exact. The policy is fail closed, not silently skip/overwrite/renumber.
4. Deliberately invalidate the second copied record in memory: the first insert is rolled back too (23514), zero partial rows remain, then a valid retry preserves all seven rows.
5. Empty title, unknown discipline, unknown skill level, zero duration and null title reject (23514/23502); each failed batch leaves zero rows.
6. Import IDs 1–7, restart only the test sequence transactionally above the maximum, and create a row without an ID: generated ID is 8; default skill/duration and serialized timestamp type match the current contract.
7. Empty and negative-ID batches safely start the test sequence at 1.
8. Bound UPDATE and DELETE operations work on disposable test rows only. These are database capabilities, not new application features.

Successful imports release their batch savepoint but are intentionally never committed outside the test transaction. This proves insertion, reconciliation, duplicate handling, partial-import rollback and retry within PostgreSQL. It does **not** prove restart durability of a newly committed populated database, a production importer, multi-connection concurrency behavior, or an end-to-end PostgreSQL Express implementation. The Lesson schema has no foreign keys/record relationships, so relationship migration is not applicable.

## Application compatibility review

| Area | Evidence and remaining work |
| --- | --- |
| Create/Read | PostgreSQL accepts the existing fields and defaults. Current server/app.js still uses synchronous SQLite prepare/run/get/all; Phase 9D must introduce awaited Prisma calls and preserve 201/200 responses. |
| Read ordering | Current API orders created_at DESC, id DESC. Prisma must specify the same ordering; the migration comparison uses ID ordering only. |
| Update/Delete | Not present in existing API/UI. SQL primitives passed in isolation. Adding routes/UI requires separate scope approval; do not treat them as completed features. |
| Gemini | Existing mocked generation/approval/persistence tests pass on SQLite. client/src/lesson-draft.js maps drafts into the existing text fields. Those fields migrate exactly, but Gemini-to-PostgreSQL end-to-end persistence awaits backend integration. |
| Errors | Existing API tests verify generic 500 and safe validation/provider errors on SQLite. Future async Prisma failures must flow into the same safe error middleware; never serialize Prisma/connection details. |
| JSON shape | PostgreSQL integer IDs remain numbers; nullable durations remain null; Date serializes to UTC ISO text. Isolated creation tests check defaults and timestamp serialization. Preserve the nine snake_case field names and validation limits. |

## Actual verification and limitations

Baseline: 30 SQLite/API/mocked Gemini tests and 5 Prisma tests passed. The first isolated live attempt failed before any scenario, with an over-sanitized generic Error; it is not counted as a pass. Added safe stage/code diagnostics and reran with NODE_USE_SYSTEM_CA=1 while keeping rejectUnauthorized=true. All 9 reported tests (8 scenarios plus parent) passed. The original failure cause was not established and is not asserted to be a certificate problem. A further final run after changing comparison to explicit per-field assertions is recorded in the prompt log.

Genuine inspection mistakes: tried nonexistent server/lessons.js and shared/ai-lesson.js paths before following the actual implementation in server/app.js and client/src/lesson-draft.js. No application changes resulted. Test errors suppress credentials and lesson content. The new test is opt-in and is not added to ordinary npm test, because remote access must follow independent target verification. Dependencies and active database configuration are unchanged.

See README.md for opt-in test commands and the plan below. No database switch, deployment or Phase 9D implementation occurred.

## Proposed Phase 9D plan — requires separate approval

1. Recheck target, backup and record inventory at cutover time. SQLite may have gained lessons since this empty snapshot. Keep historical browser fixtures excluded; do not blindly merge overlapping IDs.
2. Introduce one explicit server-only selected database configuration. Use pooled application connections and separate direct migration credentials. Keep development/test/production settings distinct, fail closed on missing configuration, and do not add automatic fallback.
3. Separate lesson persistence from Express route handlers. Implement async Prisma Create/Read with identical validation, response fields, statuses and ordering. Initialize one client per server and close it on shutdown. Keep schema unchanged unless reviewed tests demonstrate a required correction.
4. Preserve UTC millisecond serialization and numeric ID bounds. Retain versioned SQL CHECK constraints, which are not fully expressed by the Prisma model. Build a guarded import command only if actual cutover data exists; test all-field comparisons and transaction rollback before committing any transfer.
5. Run existing API contracts against a disposable PostgreSQL target, including validation, safe errors, read ordering, connection outages and recovery. Existing Update/Delete absence should remain unless separately authorized; Prisma CRUD primitives do not themselves authorize new product features.
6. Run mocked Gemini generation → editable draft → explicit approval → POST → PostgreSQL → GET tests. Generation alone must never persist. Verify manual creation remains usable during provider failures and failed saves retain drafts.
7. Test in a real browser: create, refresh, server restart, retrieval, all disciplines, mobile layout and provider/database errors. Add a committed-populated-database restart test in a disposable target; this phase deliberately rolled back its data.
8. Before switching, freeze writes, create and restore-test a fresh SQLite backup outside OneDrive, reconcile every approved row and adjust identity transactionally. Recheck source stability and destination identity. Production changes require separate approval and independently verified production credentials.
9. Rollback before new PostgreSQL writes: stop the new server and deliberately restore the prior SQLite configuration/code using a normal commit, preserving both databases. After PostgreSQL writes begin, export/reconcile those new records first; blindly restoring old SQLite would lose data.
10. Deployment planning only: server-side secret store, TLS, connection limits, generated Prisma client build, approved migration step, health checks, safe logs, backup/restore policy, Node compatibility and actual Neon quota review. Do not deploy or enable billing under this phase.

Remaining integration blockers are the synchronous SQLite route interface, untested PostgreSQL API/Gemini/browser contracts, final-cutover inventory and rollback rehearsal with post-cutover writes. The isolated data-preservation and constraint checks now have real-record evidence.

Final results: 30 existing SQLite/API/mocked Gemini tests, 5 Prisma tests and 9 live migration-test results passed. Schema validation, Client generation/compilation, frontend build and JavaScript syntax checks passed; npm audit found zero vulnerabilities. Default opt-out correctly skipped one live test. Safe malformed-URL rejection was also verified without a network connection. Walkthrough coverage is 34 files / 1,294 lines, including all 183 new test lines. No new live Gemini request or PostgreSQL-backed Express test is claimed.
