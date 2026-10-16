# Lesson manager verification (2026-10-16)

This report records what Claude actually ran while finishing the lesson manager that Codex left at commit `7a43695`. No credentials, connection strings or lesson contents from the real database are included.

## Environment

- Real browser: Claude desktop app's built-in browser pane (Chromium). Claude in Chrome was not used.
- Isolated test stack: a disposable PostgreSQL schema on the **Development** Neon branch (mocked AI), Vite on 5175, API on 3002. It was removed at the end with the project's own cleanup mode, which only drops a schema whose name matches `coachlab_test_<32 hex>`.
- Real stack: Vite on 5174, API on 3001, Development PostgreSQL, real Gemini adapter.
- Production was never contacted.

## Problems found and fixed

| Found by | Problem | Fix |
| --- | --- | --- |
| Browser | Codex's isolated frontend helper (`tmp/complete-vite.mjs`, ignored file) served the wrong folder because a space in the project path was left URL-encoded (`%20`). The page was blank and an empty stray `Next%20Chapter%20Projects` folder (Vite cache only) was created. This is the likely cause of the earlier "blocked" 5175 page. | Helper now uses `fileURLToPath`. The stray folder holds only cache files and was left untouched. |
| Browser | Activity cards: pressing Enter twice created an extra empty card, the cursor jumped and the next characters were appended to the wrong place. Cards were rebuilt from text on every keystroke and used array indexes as keys. | `ActivityEditor` now owns its cards with permanent ids. Blank lines typed inside a card are kept while typing and replaced by a single line break in the stored text, so a card can never split in two. Reordering moves ids, not text. |
| Browser | Lazy-loaded reference pictures did not start loading reliably (element stayed incomplete although the image URL was fine). | Removed `loading="lazy"`; pictures are only rendered after the coach opens the media section anyway. |
| Review | Saved activity minutes were never compared with class length (a known gap in the handoff). | Form shows the sum of minutes found in activity headings next to the class duration with a non-blocking mismatch note; each lesson card shows the total. |
| Review | Lessons with no catalogued technique had no way to find pictures or videos. | Media section always shows "search instructional videos / search pictures" links (clearly marked as not reviewed) in addition to reviewed catalog matches. |

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` (SQLite, API, mocked AI, UI helpers) | 35/35 pass (34 existing + 1 new) |
| `npm run test:prisma` | 5/5 pass |
| `npm run prisma:validate` | pass |
| `npm run build` | pass |
| Opt-in `server/postgres-api.test.js` against Development (random schema, six disciplines, mocked AI, create/update/delete, reconnect persistence, safe failures, public data unchanged) | pass |
| Walkthrough coverage (`CODE_WALKTHROUGH.md` vs source) | 41 files / 1,653 lines, exact |

## Browser checks (isolated schema unless stated)

| Workflow | Result |
| --- | --- |
| Manual create with title, discipline, level, duration, goal and two activity cards | Saved; success notice; timestamp shown |
| Refresh | Lesson still listed |
| Edit saved lesson, change title, save | Same ID and same `created_at`; no duplicate |
| Edit session: reorder, remove, add cards, Cancel | Cards behaved; nothing saved on Cancel |
| Enter-Enter typing inside a card (real key events) | Reproduced the bug before the fix; behaves correctly after |
| AI draft (mocked) with minimal inputs; privacy box required | Draft shown unsaved; save disabled until approval; editing resets approval |
| Approve and save an edited AI draft | Saved once with edited title, duration 60 |
| All six disciplines request a draft | Boxing, Wrestling, Muay Thai, Brazilian Jiu-Jitsu, MMA, Personal Training all returned drafts |
| AI rate limit (3 per minute) | Clear message, form input kept |
| Delete: "Keep lesson", then confirm | Cancel keeps it; confirm removes it and shows a notice |
| Backend stopped | Load error with Retry; failed save keeps the typed input and says so |
| Backend restarted, Retry | Saved lesson still present (persistence across restart) |
| Mobile 375 px | No horizontal overflow |
| Reference picture loads | Jab (Evolve MMA) and knee-cut (Grapplearts) pictures loaded |
| Real Gemini from the browser on the real stack: Wrestling, 45 min, no optional details | Draft returned; section total 45/45; bulleted cues; **discarded, never saved** |

## Media evidence and limits

- All four YouTube video IDs in the catalog resolve through YouTube's oEmbed endpoint with titles matching the catalog entries (knee-cut half-guard pass, double-leg basics, Kimura grip sequence, boxing jab). The NHS entry links to the publisher page.
- **Video playback was not demonstrated.** In the built-in browser pane the YouTube frame stayed blank, and a direct visit to the embed URL shows YouTube error 153 (no referrer). Publisher links remain under every video. Please click "Load instructional video" once in your own browser to confirm playback.
- The catalog is small: jab, Kimura, knee-cut half-guard pass, double-leg takedown and squat. Other techniques rely on the search links.

## Data and backups

- Real Development database: 2 lessons before and after the full backend restart; a SHA-256 of the API response was identical. No real lesson was created, edited or deleted.
- Original SQLite and the Phase 9D backups are byte-identical to the values in `CLAUDE_HANDOFF.md`. Codex's app stores them in its package-virtualized profile (`...\Packages\OpenAI.Codex_*\LocalCache\Local\CoachLab`), which other apps do not see at `%LOCALAPPDATA%\CoachLab`. Running the SQLite mode from a different app would therefore start with an empty database; the active PostgreSQL mode is unaffected.

## Not done / known limits

- No `updated_at` column exists, so only creation time is stored and shown. Adding one needs a schema migration on the Development database and was not performed.
- No authentication and last-save-wins editing; keep servers on loopback.
- Video playback and external-host availability depend on publishers.
