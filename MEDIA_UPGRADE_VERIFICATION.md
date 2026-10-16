# Instructional media upgrade verification (2026-10-16)

What was built, what was actually run, what was found and fixed, and what remains. No credentials or real lesson contents are included.

## What coaches can now do

- **Add Media** button under every activity card, under every AI draft section, and in a whole-lesson area.
- **Upload** PNG, JPEG, GIF or WebP pictures (up to 6 MB) and MP4 or WebM videos (up to 20 MB). The server checks the real file bytes, not the file name or the type the browser claims, and refuses SVG, HTML and mismatched files.
- **Paste a link** (YouTube or a direct picture/video address). CoachLab checks it before it is added and previews it. A link to a web page, a missing file, an http:// link or a private-network address is refused with a plain-language reason.
- **Preview, edit and remove**: caption, which activity it belongs to ("Show with"), change a pasted link (re-checked), remove. Changes apply when the lesson is saved.
- **AI lessons**: after a draft appears, CoachLab searches for media for the sections that teach a technique, checks every link, and attaches each result to the section that asked for it. Results come only from the reviewed catalog, Wikimedia Commons, and (optional, off by default) YouTube search with a server-side `YOUTUBE_API_KEY`. The AI only supplies search phrases, never web addresses, so nothing is invented. The coach can remove, edit or add media before approving.
- **Persistence**: attachments are saved with the lesson in the database (uploaded files as binary data in the `lesson_media` table), reload with the lesson for editing, survive refresh and a full backend restart, and are deleted with the lesson.
- **Mobile**: single-column media, full-width tap-friendly buttons (44 px minimum), no sideways scrolling at 375 px.

## Database change (additive only)

New table `lesson_media` (migration `20261016000100_create_lesson_media` for PostgreSQL, `002_create_lesson_media.sql` for SQLite). The `lessons` table, its nine columns and its rows are untouched.

**Disclosure:** my disposable-test helper (an ignored file under `tmp/`) had a regex bug while building the isolated test schema, so for one run the media migration was executed against the Development database's `public` schema instead of the test schema. This is the same Development database and the same migration I intended to apply at the end, and it only added the new empty table; no lesson rows changed and Production was never contacted. I then recorded the migration in `_prisma_migrations` so the migration history matches the real schema, fixed the helper, and verified the lesson table afterwards. The migration was therefore applied to Development earlier than planned and without a pause for your OK.

## Problems found and fixed during testing

| Found by | Problem | Fix |
| --- | --- | --- |
| Browser | Pictures or videos larger than about 1 MB never finished loading through the Vite dev server (reproduced with a plain Node upstream, so it is Vite 8's built-in proxy, not CoachLab). | New `client/api-proxy.js` plugin pipes `/api` to the backend; 2 MB downloads now take about a second and 30 MB in tests. |
| Live AI test | A Muay Thai lesson about stance and roundhouse kicks was given the Evolve jab video because the section text mentioned "jab" in passing. | The catalog is matched only on the technique phrases the AI named, with a regression test. |
| Browser | Editing a caption or moving an attachment to another activity applied live, which closed the edit panel as the attachment jumped to another card. | Edits are held in a draft and applied when Done is pressed. |
| Review | Pressing Enter in a link or caption field would have submitted the whole lesson form. | Enter is intercepted in those fields. |
| Test review | One assertion in the finder test was mis-parenthesised and could never fail. | Rewritten. |

## Automated checks

| Check | Result |
| --- | --- |
| `npm test` (existing suites plus new media and media-API suites) | **52/52 pass** (35 earlier tests still pass; the two migration-history assertions now expect versions 1 and 2) |
| `npm run test:prisma` | 5/5 pass |
| `npm run prisma:validate`, `npm run build`, `npm audit` | pass, pass, 0 vulnerabilities |
| Opt-in `server/postgres-api.test.js` against Development (random test schema, all migrations): upload, attach, restart persistence, byte ranges, update, missing-attachment refusal, delete with cascade, public lessons unchanged | pass |
| Walkthrough coverage | 54 files / 2,870 lines, exact |

## Browser checks (disposable PostgreSQL test schema, real server, real browser pane)

| Workflow | Result |
| --- | --- |
| Upload a picture to an activity, upload a video to another, paste a YouTube link, paste a picture link into whole-lesson media | All four previewed; the 20-second WebM reported readyState 4 and its duration |
| Bad inputs: web page link, 7 MB picture, .txt file, text renamed to .png | Each refused with a clear message in the panel |
| Edit caption and move to another activity, remove a video, rename an activity heading | Attachments followed the heading; removal worked |
| Save, refresh, reopen with Edit lesson | Attachments shown under the right activities and loaded into the form |
| Edit a saved lesson, remove an attachment, save | Removal persisted |
| Backend restart | Uploaded files and links still served, ranges work (206) |
| Cancel / remove before saving | Unsaved uploads deleted from the server (verified with no-cache requests) |
| AI draft with mocked AI (queries "double leg takedown") on the Wrestling discipline | Two verified catalog items found and attached to "Technique teaching"; saved with the activity heading; shown under that activity |
| 2.9 MB picture upload and display through the dev server | Loaded at 1100 x 800 |
| 19.5 MB video upload to Neon | Accepted in about 30 seconds |
| 375 px wide layout of cards, the form and the link panel | No horizontal overflow; all buttons at least 44 px tall |
| Main app (Development database, real data): lessons shown, Edit opens with Add Media, Cancel | Works; no write performed |

Live finder results (real network, real verification): Wrestling "single leg takedown" (Wikimedia picture), BJJ "armbar from guard" (Wikimedia picture and video), Boxing "boxing jab" and BJJ "knee cut half guard pass" (catalog picture and video), Personal Training "goblet squat" (NHS squat reference). Muay Thai "teep push kick" and MMA "sprawl takedown defense" found nothing verified. A real Gemini draft returned sensible technique phrases for four sections of a Muay Thai lesson.

## Data and backups

- The two real Development lessons from my previous snapshot were **not** modified by me. When I compared against my earlier snapshot, lesson 7 ("CoachLab development verification lesson") was gone and a new lesson 9 ("Dutch Combos", created 2026-10-16 05:10 UTC) existed. I made no saves to the real database in this task, so I believe you created and deleted those through the app; if not, the earlier snapshot is `tmp/main-before.json` (ignored, private) and the Phase 9D lesson backup is described in `CLAUDE_HANDOFF.md`.
- Original SQLite and its backups were not touched; the disposable test schema was dropped at the end.
- Uploaded files live in the database, so a full database backup now includes them. Neon's free tier is small; 20 MB videos are allowed but a YouTube link is usually better for long videos.

## Not done / known limits

- **YouTube playback was not demonstrated.** The built-in browser pane renders YouTube embeds as a black box (the same as last time); the embed uses the privacy-enhanced player URL, and "Watch on YouTube" is always shown. Please press play once in your own browser.
- The automatic search depends on Wikimedia Commons, which has few martial-arts instructional files; some techniques (Muay Thai teeps, MMA sprawls) found nothing. Add a free YouTube Data API key as `YOUTUBE_API_KEY` in `.env` to widen the video search; that code path is covered by mocked tests only and has not run against the real YouTube API.
- Picture matching is by words in titles and descriptions, so a suggested picture can be loosely related. The coach reviews and can remove anything; suggestions are labelled "Suggested by CoachLab".
- A pasted picture link keeps pointing at the other website; if that site later removes or blocks it, the card shows "could not be loaded" with a link. Uploaded files and YouTube videos do not have this problem.
- Duplicate activity headings: attachments show under the first activity with that heading, and the second is asked for its own heading.
- Large uploads are slow on the free database connection (about 30 s for 20 MB).
- No authentication; keep both servers on this computer.
