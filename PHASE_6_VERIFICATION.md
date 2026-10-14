# Phase 6 verification — 2026-10-14

CoachLab's existing Create/Read workflow passed the checks below. No features, application source, schema, dependencies or visual design were changed. The only correctness fix was a README column-count error. Phase 7 has not begun.

## Scope and evidence source

The assignment reference is the original user-supplied development prompt preserved verbatim in PROMPT_LOG.md, section "2. WEEK 5 ASSIGNMENT REQUIREMENTS", plus its Phase 6 clean-clone requirement and the current Phase 6 approval. No separate instructor-issued rubric was supplied or independently verified; this report verifies the requirements recorded in the project.

Starting revision: `81892bfde96050a3e57bb29116e725f3c628d838`, initially clean and equal to GitHub main. All application tests below ran against that source; documentation changes do not change application behavior.

## Automated checks actually run

| Check | Result and evidence |
| --- | --- |
| `npm test` | 26 passed, 0 failed. Runs server/api.test.js and server/database.test.js. Includes real HTTP creation/read, invalid fields and lengths, malformed/oversized payloads, generic database errors, migration/configuration/rollback and process persistence. |
| `npm run build` | Passed; Vite transformed 18 modules, including all four JSX modules. |
| JavaScript syntax | `node --check` passed for all 10 tracked .js files. Node does not parse JSX directly; Vite checked JSX through the build. |
| Migration command | `npm run db:migrate` passed twice on the fresh isolated browser database and once after six browser-created rows existed. Version ledger remained version 1. |
| Existing local startup verifier | `node tmp/startup-smoke.cjs` passed: actual server/index.js initialized a fresh file, POST/GET survived process restart, invalid database target exited 1 with safe guidance. This pre-existing helper is ignored, not part of the published test suite. |
| Walkthrough/history verifier | `node tmp/verify-phase4.cjs` passed for 20 files and 612 lines, exact paths and source text, one explanation per line, preserved log prefix and original attachment. The filename is historical; it checks current files dynamically. |
| Historical security verifier | `node tmp/audit-history.cjs` scanned all 11 baseline commits / 51 unique file versions; no forbidden private/generated paths or common credential patterns. Original commits remain ancestors. Final commit/push checks are recorded in PROMPT_LOG.md. |
| Fresh GitHub clone | Cloned main to a new Windows TEMP directory. `npm ci`: 85 packages installed, 86 audited, zero reported vulnerabilities. Migration, all 26 tests and production build passed. Git status remained clean. |

Clean-clone npm emitted an allowScripts warning for better-sqlite3. SQLite loaded and all migration/tests passed; no install-script policy was changed. On another machine the native dependency may require its supported build/install setup, as already noted in README. The optional `.env not found` notice is expected when using an environment variable.

## Real browser checks

Used a separate Codex in-app browser tab at `http://127.0.0.1:5174`, Vite started with `npm run dev:client -- --port 5174`, and Express started with `node server/index.js`. DATABASE_PATH pointed to `C:\Users\barri\AppData\Local\Temp\coachlab-phase6-5e41139d2e67438d9f986da446b438e3\browser.sqlite`. The normal user database was not used. This is real browser interaction evidence, not an automated browser regression suite.

1. Fresh database displayed the empty dashboard and New Lesson form with Beginner default.
2. Empty title and missing discipline triggered native required messages; whitespace-only title triggered the application error. Durations 0, 1.5 and 1441 triggered minimum, integer-step and maximum messages. These attempts created no rows.
3. Double-clicked Save for "Phase 6 Boxing" with Intermediate, 45 minutes, goal, multiline drills and notes. Observed Saving and disabled controls, followed by confirmed success and a complete card. Exactly one Boxing row existed.
4. Created and displayed one lesson for each remaining discipline: Wrestling, Muay Thai, Brazilian Jiu-Jitsu, MMA and Personal Training. Blank optional fields displayed their fallback text and Beginner/null defaults.
5. Refreshed: six cards remained. Read SQLite in read-only mode: six rows, six disciplines, exact match with GET JSON, version 1 and integrity_check=ok. Health returned ok.
6. Stopped both test servers; reran migration on the populated file. Restarted Vite while Express was down: load error displayed. Tried saving a seventh draft: save error displayed and title, discipline and notes remained.
7. Restarted Express with the same file: every field and ID of the original six rows matched the saved pre-restart snapshot. Saved the retained draft successfully, clicked Retry loading, and saw all seven cards including the original six.
8. At 390x844, the form and cards used one column, controls remained readable, and document width was no greater than viewport width. Confirmed input maxLength values 200/2000/10000/10000. Cancel closed the form without a record. At 1280x900, cards used two columns and there was no horizontal overflow. Inspected screenshots and restored viewport settings.

The test database and clean clone are disposable TEMP artifacts outside OneDrive; no real lessons were deleted or overwritten. The browser screenshot is an ignored local artifact at tmp/phase6-dashboard.png. Browser checking covers these scenarios and sizes, not every browser/device or exhaustive accessibility testing.

## Data flow verified against actual code

**Create:** In the browser, `client/src/LessonForm.jsx` stores edits in React state. Its submit handler (line 18) prevents normal form navigation, locks repeated submissions, converts blank duration to null or text to a number, and sends JSON with POST /api/lessons (line 27). Vite's development proxy forwards /api to Express on port 3001. On the server, `server/app.js` parses JSON, calls `validateLesson` (line 25), then binds the accepted fields to a prepared INSERT (lines 9–14) inside a transaction. SQLite writes the external file and supplies the ID/date. Express returns HTTP 201 with the saved row (line 27). LessonForm calls onSaved; App adds the returned row to state and closes the form. Only confirmed server data produces the success card.

**Read:** App's effect sends GET /api/lessons (`client/src/App.jsx`, line 19). Express's GET handler (`server/app.js`, lines 20–22) executes the prepared ordered SELECT against SQLite and serializes rows as JSON. App checks that response is an array and puts it in state (line 23). Its map (line 53) passes each row through the lesson prop to `LessonCard.jsx`, which renders all fields. Refresh starts a new GET, so records come from SQLite rather than browser memory or localStorage.

React components, hooks, event handlers, fetch and CSS run in the browser. Vite runs as a development process on the computer serving browser assets and proxying requests; its configuration is not browser application logic. Express, validation, migration and better-sqlite3 run in Node on the server side. SQLite is a file accessed only by the backend, even though browser and server run on the same computer during local development. The real-browser-to-SQLite comparison and restart snapshot checks support this code trace.

## Security and database findings

- Queries receiving values use named parameters or question-mark placeholders. The fixed list query has no user input. Tests store SQL-looking text literally and confirm the lessons table remains intact.
- Validation rejects unsupported fields/types, bad enums, blanks, oversized strings and invalid duration. Server validation remains necessary even with browser constraints.
- Tests for malformed JSON, oversized bodies and unavailable SQLite verify safe JSON errors without stack traces, SQL or local paths. Health and lesson JSON contain no database-path configuration.
- DATABASE_PATH is server-only. The default and every test database are outside OneDrive. Configuration tests reject relative paths and normal personal/business OneDrive folder names. Existing limitation: a custom synced folder or filesystem link is not detected; choose an actually local, unsynced directory.
- Ignore probes passed for .env, .env.private, SQLite/db variants and journals, node_modules, dist, tmp and coverage. Only the intentionally safe .env.example is tracked. Reviewed complete Git history with path and common credential-pattern checks; no database/private environment files or detected credentials were committed. This is not a guarantee against every possible secret format.
- Servers bind to loopback. No authentication was added, consistent with this local-only assignment scope. No production deployment/security certification is claimed.

## Genuine problem corrected

README.md incorrectly said the lessons table had ten columns. Migration 001 and PRAGMA/table assertions show nine: id, title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes and created_at. Replaced the inaccurate count with the explicit list, checked against the unchanged SQL and passing database tests. This is a genuine earlier AI documentation error; no runtime bug was invented. Earlier generator errors and corrections remain in PROMPT_LOG.md's historical Agent Mistakes and Corrections section.

## Week 5 evidence checklist

| Requirement | Status | Actual evidence |
| --- | --- | --- |
| Create works | Verified | Seven lessons saved through real form submissions; returned success/cards; six-record SQLite comparison before recovery save. |
| Read works | Verified | GET JSON exactly matched SQLite rows; dashboard rendered all six, then seven. |
| SQLite persistence works | Verified | File-based SQLite, integrity ok, migration version 1 and tests using reopened connections/processes. |
| Browser refresh preserves records | Verified | Six saved cards reappeared after reload. |
| Server restart preserves records | Verified | Both servers stopped/restarted; all six full records and IDs matched pre-restart snapshot. |
| Application runs locally | Verified | Express 3001 and Vite 5174 started; browser loaded and used the actual API. |
| Source code is on GitHub | Verified | Initial local/remote hashes matched; clean GitHub clone installed, migrated, tested and built. Phase 6 push confirmation is in PROMPT_LOG.md. |
| No secrets committed | Verified within checks | Full-history path/credential scan and staged review; only safe .env.example; no SQLite files. |
| Agent prompts logged | Verified for available records | Current exact prompt appended; original attachment and prior entries preserved. Historical missing prompts remain explicitly labeled, not invented. |
| Diffs reviewed | Verified | Source unchanged; reviewed the Phase 6 documentation correction, phase-status updates, evidence report and appended prompt/outcomes before committing. |
| Small commits made | Verified | Existing phased history retained (including separate Phase 5 implementation/upload commits); Phase 6 documentation commit and follow-up record are identified in the log. |
| Genuine agent mistake/correction documented | Verified | README nine-versus-ten correction plus preserved generator syntax/checker mistakes with observed corrections. |
| Data flow can be explained | Verified as documentation | Browser/server trace above matches actual handlers and observed SQLite/API equality. This does not claim to test the learner's personal understanding. |

No unresolved application failure was found in these checks. Official-requirement provenance is limited to the supplied project documentation as stated above. No new frontend framework was added: existing automated API/database checks and real browser interaction covered the requested critical workflow.

## Documentation and phase boundary

Every one of 612 current source/configuration/test lines across 20 files remains documented. No source line was added or changed. CODE_WALKTHROUGH.md was rechecked and its phase status updated; prior historical entries in PROMPT_LOG.md were preserved. Detailed evidence and commit/upload results are logged rather than substituting anticipated results for tests.

Ready for Phase 7 only after the user's approval. Stop after Phase 6.
