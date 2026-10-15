# Phase 8A verification — 2026-10-15

Phase 8A implements single-lesson AI drafts. Phase 8B is not started.

## Implemented behavior

- All six disciplines; skill level, 15–180 minutes, 1–100 students, objective, techniques and equipment.
- Title, objectives, five timed sections, technique content, step-by-step teaching instructions, progressive drills, partner work/solo alternative, common mistakes, corrections, skill modifications and safety guidance.
- Validated structure and exact duration total. Every draft field is editable; every edit clears approval. Explicit approval is required in the UI before saving a new lesson through the existing API. Generation never writes to SQLite.
- Save failures preserve the in-memory draft. Manual Create/Read is independent of AI availability. No existing lesson is overwritten.
- Configurable server-side Gemini model/key, 45-second timeout, 8192 output-token cap, 64KiB provider-response cap, existing 32KiB request parser, 32000-byte save budget, one concurrent generation, three accepted attempts/minute and twenty/rolling day. No automatic retries or fallback.

## Automated checks actually run

Baseline: 26 existing tests passed. First expanded run: 29 passed, one failed because the test counted nineteen attempts instead of twenty. Corrected the test loop; rerun passed 30/30. Final rerun after selecting the live-verified default also passed **30/30**, with no skips.

The four new test groups cover six disciplines, invalid input, privacy confirmation, malformed/mistimed drafts, edits retained in mapping, correct server-side transport shape, missing config, unsupported provider, HTTP failure/quota, malformed/truncated/oversized output, timeout, safe errors, zero writes during generation, explicit save/read/reopen persistence, concurrency/minute/day limits and manual creation during AI failure. Existing migration, path, schema, rollback, parameterized CRUD and cross-process persistence checks remain passing.

`npm run build` passed after the final source changes. JSX compiled successfully. Additional JS syntax/documentation/security checks and Git results are recorded in the prompt log after execution.

## Real browser checks (mock provider)

Separate test servers: Express 3002 and Vite 5174. Database: uniquely generated Windows temporary directory outside OneDrive. No production records used.

1. Generation form displayed all six discipline options and requested inputs/privacy notice.
2. Generic BJJ generation produced an editable draft and **zero saved lessons**.
3. Save button disabled until coach approval.
4. Editing teaching instructions cleared approval and retained the edited text.
5. Changing warm-up from 12 to 13 made the displayed total 61/60; even after approval, submission was blocked with a duration error and no save.
6. Restored total to 60 and approved. Simulated HTTP 503 save outage preserved the complete edited draft.
7. Removed the test outage; explicit save succeeded, one card appeared, and refresh preserved the saved record and edited teaching text.
8. Browser console check after refresh returned no warning/error entries. No separate automated browser framework was installed. Screenshot is an ignored local test artifact, not a real lesson or committed database.

## Actual live Gemini checks

Official model/pricing documentation and the authenticated model-list endpoint were checked. Model list returned HTTP 200 and included both `gemini-3.8-flash` and `gemini-3.5-flash-lite` with generateContent. Numeric free-tier quotas are project-specific in AI Studio and were not independently read. User confirmed billing disabled; no billing/purchase changes were made.

The initial absent-key check stopped locally with 503. After secure configuration, an initial transport attempt failed. Using `NODE_USE_SYSTEM_CA=1` reached Google without disabling TLS verification. `gemini-3.8-flash` generation returned provider HTTP 503 / UNAVAILABLE. Availability in a catalog does not guarantee successful generation at that moment.

Selected **`gemini-3.5-flash-lite`** after a real successful request. Its official pricing lists free input/output; paid pricing is $0.30/$2.50 per million input/output tokens, which was not enabled. The first real generated draft passed structure checks and totaled 60 minutes (10+15+15+15+5).

A second real test called the actual Express draft route: HTTP **200**, complete structure, total **60**, **zero rows before explicit test save**. An explicit test-only save through existing POST returned **201**; GET returned **one row**; closing/reopening that disposable SQLite file retained **one row**. The test directory was then removed. The browser approval interaction was verified separately with mocks; these live API tests did not claim a human coach had reviewed the plan for real use.

Sources checked October 15, 2026: [models](https://ai.google.dev/gemini-api/docs/models), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [quotas](https://ai.google.dev/gemini-api/docs/rate-limits), [generateContent](https://ai.google.dev/api/generate-content), [data terms](https://ai.google.dev/gemini-api/terms).

## Security incident and correction

During concurrent user configuration, a key was placed in tracked `.env.example`. An agent documentation assertion printed that unexpected line into tool output. This was a genuine agent mistake; keys should never appear in diagnostic output. The key was removed from the example before staging/committing, configuration was moved to ignored `.env`, and the checker was changed to omit source-line contents on failure. The user was notified and confirmed revocation/replacement; provider-console revocation was not independently verified. No key value is repeated in documentation. No credential was committed or pushed.

Production code sends keys only in a server-side Google request header and does not log them. Only generic class data is sent; no saved lessons or athlete records are read for prompting. JSON content type, field allowlists, text limits, safe error mapping and response limits are enforced. Privacy affirmation cannot detect every sensitive phrase; coaches must keep requests generic. SQLite remains outside OneDrive; the existing schema and database path rules are unchanged.

## Documentation and limits

README explains setup, privacy, model choice, cost, limits, draft lifetime and how to start the application. PROMPT_LOG preserves prior entries, the exact Phase 8A request, clarification replies, actual results and mistakes. CODE_WALKTHROUGH covers every source/configuration/test line, including new files and changed lines. AGENTS records the approved Phase 8A boundary.

Structural validation cannot certify technique accuracy, injury prevention or athlete readiness. Qualified coach review remains essential. Drafts survive a failed save while the page stays open, but are not persisted across refresh/close. Lost save responses can require checking for duplicates. Approval is a local UI workflow, not authentication. Rate limits reset with the process and do not replace provider quotas or a billing cap. No provider switch happens automatically. Multiweek programs and other future features are excluded.
