# Media attachment saving fix (2026-10-16)

Report of the user-reported bug: add a YouTube link to an activity of an existing lesson, press Save changes, and the attachment is missing when the lesson is reopened.

## What I could and could not reproduce

- **Reproduced (the cause of "saved, but no attachment"):** the media fields lived inside the lesson's `<form>`. Pressing **Enter in the Caption field** of a checked link (and, in principle, a phone keyboard's Go key in any media field) submitted the whole lesson form. CoachLab saved the lesson **without** the attachment, closed the form and returned to the list. Reopening the lesson showed nothing. In the real browser this took one keypress: lesson saved, notice "Saved ...", media count unchanged.
- **Not reproduced:** the "jump to the top" and a loss when only the buttons are clicked (Check link, then Add to this activity, then Save changes). I tried this with scripted clicks and with real mouse clicks, on lessons without media, on copies of your two real lessons (including the one with no activities and the six-activity one), on desktop and at 375 px, on the isolated PostgreSQL schema and, up to (not including) Save, on your real app. Every click-only path saved the attachment, and the page did not jump or remount. If you pressed Enter, used a phone keyboard, or saved while the preview was still open, the fixes below match what you saw. If you did exactly the button clicks you listed, please tell me; the new backend error logging and save confirmation should now show what happened.
- **Your real database:** it has had no attachment rows at all (`lesson_media` was empty), which fits "never saved", not "saved then lost".

## Other ways an attachment could be lost, found while tracing the path

I traced the attachment through the form, `mediaPayload`, `PUT /api/lessons/:id`, the media validator and link checker, the Prisma store's transaction and `lesson_media` in PostgreSQL. The server path is correct and its tests pass; the weak points were all in the browser:

1. **Edit could start from a stale or empty attachment list.** The form received attachments from a copy loaded earlier, and an edit always sends the full list. If that copy was old or the load had failed, saving would have **deleted** attachments. (Quickly reopening a lesson right after a save was enough to hit the old copy.)
2. **A half-added attachment was silently dropped on Save.** A verified preview that had not been added, an upload in progress or an open edit panel was simply not part of the saved list.
3. **Updates built from an old list.** Adding an item used the list from the render in which the panel was created, so a slow upload or another editor could overwrite attachments added meanwhile.
4. **Nothing confirmed the result.** The success notice was a plain line at the top of the page, which is off-screen when you are editing near the bottom, and the edited lesson was moved to the top of the list.

## Fixes

- **Media fields are detached from the lesson form** (`form="coachlab-media-fields"`), so Enter or Go in a media field can never submit the lesson. A regression test guards every such field.
- **A save is refused while anything is half-done**: a checked link not yet added, an upload running or an open edit panel. A clear message explains what to do and scrolls to it. This applies to normal and AI-draft lessons.
- **Edit always reads the newest attachments from the server before it opens**, and refuses to open (with a warning) if they cannot be loaded, because saving without them could remove them.
- **All media changes use the newest list**, so one change cannot overwrite another.
- **Clear save confirmation:** a sticky bar (stays visible while scrolling, with Dismiss) says "Saved ... 2 pictures or videos saved with it." after reading the stored attachments back from the server. If the stored count ever differs it turns into a warning with the numbers. The saved lesson's card is scrolled into view and stays in place in the list (it no longer moves to the top).
- **No unnecessary jumps:** adding media shows an inline "Added ..." confirmation scrolled only as far as needed; closing the form scrolls to the saved card instead of leaving the page wherever the layout shrinks to.
- **Backend error logging:** unexpected server errors now print their name and code (no lesson text) so a failed save is no longer invisible.
- The whole-lesson area's button now says "Add to the whole lesson".

## Test results

| Check | Result |
| --- | --- |
| `npm test` | **53/53 pass** (52 earlier tests plus the new detached-fields regression test) |
| `npm run test:prisma`, `npm run build`, `npm audit` | 5/5 pass, pass, 0 vulnerabilities |
| Opt-in PostgreSQL API test (disposable schema, all migrations) | pass |
| Walkthrough coverage | 54 files / 2,971 lines, exact |

Browser checks (disposable PostgreSQL schema containing copies of your lessons; real server and browser):

| Check | Result |
| --- | --- |
| Enter in the Caption field of a checked link | No longer submits; form and preview stay open; nothing saved |
| Save changes with a checked link not yet added | Blocked with the message; preview scrolled into view; nothing saved |
| YouTube link added to an activity of an existing lesson, then Save | Saved; bar "2 pictures or videos saved with it"; card in view; list order unchanged |
| Existing lesson with no activities: upload picture, upload video, add YouTube link, Save | 3 attachments stored (image 11.9 KB, video 2.7 KB, YouTube); picture loaded, video ready and playable |
| Edit: rename a caption, remove the video, Save | Renamed and removed; message "2 pictures or videos saved with it" |
| Six-activity lesson: picture on Warm-up, YouTube on Progressive drills, existing link on Techniques | Each shown under its own activity after save |
| Backend restart | All attachments listed; uploaded file served (200, same size) |
| Attachment list cannot be loaded when pressing Edit | Form not opened; warning shown; stored attachment untouched |
| 375 px layout: add link, Add button 49 px tall, Save | No horizontal overflow; bar sticky at the top; card in view |
| Real app (Development data): Edit, Add Media, Check link, Save with preview open | Save blocked as designed; Cancel; real lessons and media unchanged |

## Remaining limits

- I did not save an attachment onto your real lessons (that would change your data); the same code and database engine were tested on copies of them.
- YouTube playback inside the built-in browser pane is still not demonstrable (embeds render as a black box); the "Watch on YouTube" link is always shown.
- A Save with a link still open now asks you to press Add (or Cancel) first rather than adding it for you.
