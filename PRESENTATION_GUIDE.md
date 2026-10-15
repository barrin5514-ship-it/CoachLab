# CoachLab — Friday presentation guide

Prepared during Phase 7 for Next Chapter Week 5. This is a guide for a future live demo, not a record of a demo already performed. No demo lessons were created during preparation. Application source is unchanged from the verified Phase 6 baseline.

## 1–2 minute speaking script

Read this conversationally while following the eight demo steps below. Aim for about two minutes with short typing pauses; rehearse once with a timer. Adjust the learning statements to match what you can explain confidently.

> Hi, my project is CoachLab. I created it to help martial arts instructors and personal trainers organize lesson plans in one place. For Week 5, I focused on creating a lesson, displaying it, and making sure it stays saved.
>
> I’ll click New Lesson and choose Brazilian Jiu-Jitsu. My title is “Kimura Trap Fundamentals.” I can also add a skill level, duration, goal, drills, and coaching notes. For this quick example, I’ll keep the default skill level and leave the optional details blank.
>
> When I click Save lesson, the app sends the information to the backend. After the backend confirms the save, the lesson appears as a card. Now I’ll refresh the browser. The lesson is still here because it is stored in a SQLite database file on my computer, outside OneDrive—not just in the page’s temporary memory.
>
> React handles the form and dashboard in the browser. Express receives requests and checks the information. SQLite stores the records. When the page loads, React asks Express for the saved lessons and displays them again.
>
> I learned how components, state, API requests, and a database fit together. I also learned to control AI work with small phases, approvals, tests, and documentation. One real mistake was a README claim that the table had ten columns. We checked the migration and tests, found nine, and corrected the documentation.

## Eight-step live demonstration

These actions are for rehearsal or class, not instructions to seed records during documentation preparation. Saving during the live demo creates a real row in whichever database the backend is using.

| Step | Action | What to show or say |
| --- | --- | --- |
| 1 | Open CoachLab at http://127.0.0.1:5173/ (or the explicit 5174 fallback below). | “This is the dashboard where saved lessons appear.” Wait for loading to finish. |
| 2 | Click **+ New Lesson** and select **Brazilian Jiu-Jitsu**. | “I’m planning a Brazilian Jiu-Jitsu session.” |
| 3 | Enter **Kimura Trap Fundamentals** as the lesson title. | Leave skill level at Beginner. Duration, goal, drills and coaching notes are optional; leave them blank for a quick demo. |
| 4 | Click **Save lesson** once and wait. | “The backend must confirm the save before the app shows success.” Do not refresh while saving. |
| 5 | Point to the success message and saved card. | Show the title, discipline, Beginner level and creation date. Blank details display “Not added”; blank duration displays “Duration not set.” |
| 6 | Refresh the browser with its refresh button or Ctrl+R. | “I’m reloading the page, which clears its temporary React state.” |
| 7 | Locate the same lesson card after loading finishes. | “The lesson remains because the app loaded it from the database.” |
| 8 | Explain storage without opening private configuration. | “SQLite stores the information in a local file outside OneDrive. Express reads that file and sends the records to React.” |

The usual default file on this computer is `C:\Users\barri\AppData\Local\CoachLab\coachlab.sqlite`. `server/config.js` builds that path from the Windows home folder. An explicit DATABASE_PATH overrides it; explain the actual location you choose for the demo. A GitHub clone contains source and migrations, not your saved lessons.

## Startup and final demo checklist

The commands below are supported by the current package.json. They are instructions to run before class; they were not executed as part of this documentation-only preparation. Node.js 24.19.0 is the project's verified runtime. Existing setup instructions remain in README.md.

Open two PowerShell terminals. In **each** terminal, go to the project:

```powershell
Set-Location -LiteralPath 'C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab'
```

Terminal 1 — Express:

```powershell
npm run dev:server
```

Terminal 2 — React through Vite:

```powershell
npm run dev:client
```

Open http://127.0.0.1:5173/. If Vite reports that 5173 is already in use, use this command in Terminal 2 and open http://127.0.0.1:5174/ instead:

```powershell
npm run dev:client -- --port 5174
```

The fallback changes only Vite's port. Express must still use port 3001. Do not stop an unfamiliar process just to free a port. Ctrl+C stops each server you started. Restart Express with the same database path to keep showing the same records.

If you want a separate classroom database, choose it **before** starting Express in Terminal 1, then reuse the same setting at every backend restart:

```powershell
$env:DATABASE_PATH = Join-Path $env:LOCALAPPDATA 'CoachLab\friday-demo.sqlite'
npm run dev:server
```

This optional path is outside OneDrive on this Windows setup. It leaves the normal database alone. Startup creates the folder/file and applies missing migrations. Do not delete existing databases or change the path midway through the demonstration. No such file was created by preparing this guide.

For a fresh clone, `npm ci` installs locked dependencies. `npm run db:migrate` is the supported standalone migration command; the server also runs missing migrations automatically. Optional pre-class verification commands are `npm test` and `npm run build`. Phase 6 recorded 26 passing tests and a successful build; those are historical results, not a new test run here.

Check these boxes yourself on demo day:

- [ ] Express starts and prints `CoachLab API listening at http://127.0.0.1:3001`.
- [ ] Vite starts on 5173, or I intentionally use the documented 5174 fallback.
- [ ] The browser shows CoachLab with no loading error. In another browser tab, http://127.0.0.1:3001/api/lessons returns a JSON array (`[]` is valid). This GET actually queries SQLite; `/api/health` alone only confirms the API responds.
- [ ] I know which database path I am using, outside OneDrive, and will keep it unchanged through refresh/restarts.
- [ ] I create **Kimura Trap Fundamentals** with **Brazilian Jiu-Jitsu**, wait for confirmation and show its card.
- [ ] I refresh and show that the same lesson remains.
- [ ] I explain the SAVE and LOAD diagrams below.
- [ ] I open [CoachLab on GitHub](https://github.com/barrin5514-ship-it/CoachLab), select `main`, and show the source and documentation. GitHub hosts source; this app runs locally.
- [ ] I explain the README nine-versus-ten-column mistake and its verified correction.
- [ ] I show PROMPT_LOG.md for instructions/outcomes and CODE_WALKTHROUGH.md for line-by-line explanations.

If a save fails, keep the form open and read the message. Check that Express is running. If the response might have been lost after saving, copy your draft somewhere safe and check the dashboard before retrying to avoid a duplicate. Refreshing an unsaved draft discards its React state. Do not describe an unsuccessful save as successful; the Phase 6 report is available as prior evidence if a live environment problem prevents the demo.

## Beginner-friendly technical reference

Paths below are relative to the CoachLab repository, so they can also be found in GitHub. CODE_WALKTHROUGH.md contains their exact local paths and numbered source listings.

| Concept | Plain-English explanation | Actual CoachLab example |
| --- | --- | --- |
| React | A library that builds the interactive screen and updates it when data changes. | `client/src/App.jsx` renders the dashboard; `main.jsx` mounts App into index.html. |
| Component | A reusable function that returns a piece of the screen using JSX, the HTML-like markup in JavaScript. | `LessonForm` handles the form; `LessonCard` renders one saved row. Both are separate files under `client/src/`. |
| Props | Inputs a parent component gives to a child. They can be values or functions. | App passes `lesson` into `LessonCard({ lesson })` and passes `onSaved={handleSaved}` into LessonForm. |
| State | Values React remembers while a component is mounted. Updating them makes React render again. | LessonForm's `values` contains the draft; `saving` tracks a pending save. App's `lessons` contains the currently displayed rows. State is not durable database storage. |
| Express | The server library that receives HTTP requests and sends responses. | `createApp(database)` in `server/app.js` defines routes; `server/index.js` starts it on port 3001. |
| SQLite | A database engine that stores structured records in a local file. | `openDatabase()` in `server/database.js` opens the configured file through better-sqlite3; the lessons table stores the fields. |
| API | An agreed way for programs to communicate using requests and responses. | The browser sends JSON to `/api/lessons`; Express returns JSON, a data format both sides understand. |
| POST | The HTTP method CoachLab uses to create a record. | LessonForm's `submit()` sends POST `/api/lessons`. Express validates, inserts and returns HTTP 201 plus the saved row. |
| GET | The HTTP method CoachLab uses to read records. | App's `loadLessons()` inside useEffect sends GET `/api/lessons`; Express returns an array, newest first. |
| Migration | A versioned instruction that sets up or changes database structure predictably. | `server/migrations/001_create_lessons.sql` creates lessons; `migrate()` in `server/migrations.js` tracks version 1 in schema_migrations and skips it if already applied. |
| Persistence | Keeping information after the page or server closes. | Saved rows live in the SQLite file. Refresh makes App request them again. An unsaved draft exists only in state. |
| Browser versus server | The browser runs the interface; the server runs validation and database operations. Both run on this computer during local development. | React components and fetch run in the browser. Express, `validateLesson()`, migrations and SQLite access run in Node. Vite serves browser assets and proxies `/api` requests, as configured in `client/vite.config.js`. |
| Git safety | Git history is shared and retained. Real database records can be private, and secrets can grant access. Commit the structure and safe examples, not live data or credentials. | `.gitignore` excludes SQLite files, private `.env` files, dependencies and build output. `.env.example` contains a safe configurable path example; migrations recreate the database structure without copying someone's lessons. |

## Data flow visual

### SAVE

```text
React form
  -> POST request
  -> Express API
  -> SQLite database
```

1. **React form:** `LessonForm` keeps typed values in state. `change()` updates a field. The submit handler converts a filled duration to a number and a blank one to null.
2. **POST request:** `submit()` sends the fields as JSON to `/api/lessons`. Vite forwards the request to Express during local development.
3. **Express API:** `createApp()` parses JSON and calls `validateLesson()`. Invalid input gets an error. For accepted input, `save()` uses a prepared INSERT with bound parameters so input is handled as data rather than executable SQL.
4. **SQLite database:** The transaction writes the row and reads it back with its generated ID and date. Express sends the saved row back with 201. LessonForm calls `onSaved`; App's `handleSaved()` adds that confirmed record to state and closes the form.

### LOAD

```text
SQLite database
  -> Express API
  -> GET response
  -> React dashboard
```

This diagram shows the returning data. The browser starts the process by sending a GET request when App's effect runs.

1. **SQLite database:** The file already contains the saved rows; it is not cleared by browser refresh.
2. **Express API:** The GET handler runs its prepared SELECT, ordering records by creation date and ID descending.
3. **GET response:** Express sends the array as JSON. The browser receives it through the development proxy.
4. **React dashboard:** App's `loadLessons()` parses the array and calls `setLessons()`. App maps each row to a `LessonCard` using the row's ID as its stable key and the row itself as a prop.

## How I controlled the AI collaboration

Use these as factual talking points, not a claim that you personally reviewed something you have not read. The record shows that you required the following controls and Codex recorded performing the checks; read the relevant diffs yourself before saying “I reviewed them.”

- **Specific instructions:** I defined Create, Read and SQLite persistence, and named what was outside scope.
- **Phases and approval:** I split the work into phases and required approval before continuing. Phase 7 is presentation preparation only.
- **Diff review:** I required changes to be inspected before commits so I could see what changed. GitHub commit diffs and the local log provide that review trail.
- **Small commits:** I required meaningful commits that preserve history instead of one unexplained rewrite.
- **Prompt history:** I required PROMPT_LOG.md to preserve actual requests, outcomes, tests and missing-history labels.
- **Learning:** I required CODE_WALKTHROUGH.md to explain every source line, including syntax and how files connect.
- **Testing:** I required real browser checks and automated tests rather than accepting “it should work.” Phase 6 records the actual checks, including all six disciplines, refresh/restart persistence and outage recovery.
- **A real correction:** The AI-generated README said the lessons table had ten columns. The SQL migration and schema assertions actually list nine: id, title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes and created_at. Phase 6 corrected the README and checked that list against the migration and passing database tests. No database change was needed. The correction is in commit `cbdfc39`, and its evidence is in PHASE_6_VERIFICATION.md and PROMPT_LOG.md.

## Ten instructor practice questions

1. **What does React do in your project?** It displays the form and dashboard, handles input, and updates the screen when state changes.
2. **What is a component, and where did you use one?** It is a reusable piece of UI. LessonForm collects a plan; LessonCard displays one saved plan.
3. **What are props?** Inputs passed from a parent to a child. App gives LessonCard the saved `lesson` object.
4. **What is state, and is it the database?** State is temporary component memory, such as form values or App's lesson list. SQLite provides durable storage; state is rebuilt after refresh.
5. **What does your backend do?** Express receives requests, validates them using validateLesson, reads or saves SQLite rows, and returns JSON. It runs in Node rather than the browser.
6. **Where are your lessons stored?** In the configured SQLite file outside OneDrive. By default it is under my Windows user folder at AppData/Local/CoachLab/coachlab.sqlite.
7. **Which API routes create and read lessons?** POST /api/lessons creates a lesson and returns 201. GET /api/lessons returns the saved lessons as an array.
8. **How do you know persistence works?** Phase 6 created lessons in a real browser, refreshed and restarted both servers, then compared every saved field and ID to the earlier records. They matched.
9. **What does your migration do, and can it run again?** Version 1 creates the lessons table. The runner records applied versions and skips version 1 afterward, so rerunning it preserves existing rows.
10. **How did you control AI work and keep it safe?** I required phases, approvals, reviewed diffs, small commits, prompt records, line explanations and tests. We corrected the documented nine-versus-ten-column error using the actual schema. Database files and secrets stayed out of Git.

## Preparation status and boundaries

The speaking script, eight demo steps, technical reference, SAVE/LOAD diagrams, ten practice questions and demo-day checklist are prepared. Technical claims and command names were checked against the actual source and package.json. No servers were started, no demo rows were saved, and no application tests were rerun for this documentation-only phase; Phase 6 results are clearly attributed to Phase 6. The live checklist remains unchecked until you perform it. No new source means CODE_WALKTHROUGH.md remains unchanged.

Presentation preparation ends here. Any feature work, Update/Delete, or future development requires separate approval.
