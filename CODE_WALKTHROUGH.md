# CoachLab code walkthrough

Verified source snapshot: 2026-10-14, Phase 5 source in the commit containing this walkthrough. Prior application baseline: c56967a; prior documentation milestone: b060b76.

Every line, including blank lines and closing delimiters, is listed below. Numbered code blocks are for reading; remove line-number prefixes before copying code. Paths are exact repository-relative paths, with the current absolute workspace path given for each file.

## How the pieces connect

Browser → Vite serves index.html → main.jsx renders App → App fetches /api/lessons → Vite forwards to Express → SQLite rows return as JSON → App renders LessonCard components. New Lesson mounts LessonForm; its controlled inputs update state, submission sends JSON to POST /api/lessons, and a confirmed 201 row returns through onSaved to App. Form errors preserve input; successful submission unmounts the form. CSS supplies desktop and mobile layouts. The backend opens the external SQLite file, applies versioned migrations and listens; the standalone npm run db:migrate command remains available. React never opens the database directly.

## Reading the syntax

JavaScript executes application logic. JSX is HTML-like syntax inside JavaScript that Vite converts into React calls. A component is a function that returns UI; state remembers values between renders; an effect synchronizes with something outside rendering, such as a network request. Props are inputs passed to components: App passes lesson data to LessonCard and callback functions to LessonForm. HTML attributes configure elements. JSON is a data format, not executable JavaScript. CSS controls appearance. Parentheses group expressions or pass function arguments; braces can delimit code blocks, objects, imports, or JSX expressions depending on context.

## client/index.html

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\index.html`

The HTML entry page Vite serves. It provides the root element used by main.jsx.

### Lines 1–12

```text
1 | <!doctype html>
2 | <html lang="en">
3 |   <head>
4 |     <meta charset="UTF-8" />
5 |     <meta name="viewport" content="width=device-width, initial-scale=1.0" />
6 |     <title>CoachLab</title>
7 |   </head>
8 |   <body>
9 |     <div id="root"></div>
10 |     <script type="module" src="/src/main.jsx"></script>
11 |   </body>
12 | </html>
```

- **Line 1:** Declares modern HTML so the browser uses standard page rendering.
- **Line 2:** Opens the page element; lang="en" identifies English for accessibility tools.
- **Line 3:** Opens head, the section containing page metadata rather than visible content.
- **Line 4:** Sets UTF-8 text encoding, allowing characters such as the ellipsis. This metadata element has no closing tag.
- **Line 5:** Makes the viewport match the device width and starts at normal zoom, supporting mobile layout.
- **Line 6:** Sets the browser tab title to CoachLab; the closing title tag ends that text.
- **Line 7:** Closes the head metadata section.
- **Line 8:** Opens the body, which contains the visible page.
- **Line 9:** Creates and immediately closes an empty div with ID root. React fills this container later.
- **Line 10:** Loads /src/main.jsx as a JavaScript module; Vite transforms its JSX for the browser. The closing script tag ends this element.
- **Line 11:** Closes the body.
- **Line 12:** Closes the entire HTML document.

## client/src/main.jsx

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\src\main.jsx`

The frontend entry module. It loads App and CSS, then attaches React to the HTML root.

### Lines 1–6

```text
1 | import React from 'react';
2 | import { createRoot } from 'react-dom/client';
3 | import App from './App.jsx';
4 | import './styles.css';
5 |
6 | createRoot(document.getElementById('root')).render(<App />);
```

- **Line 1:** Imports React as a default import from the installed react package; JSX is compiled to React calls by this setup.
- **Line 2:** Imports the named createRoot function from React DOM, which connects React to browser elements.
- **Line 3:** Imports the default App component from the neighboring App.jsx file; ./ means this directory.
- **Line 4:** Imports the stylesheet for its effect on page styling, without assigning a JavaScript variable.
- **Line 5:** Blank line separates related sections for readability; it performs no operation.
- **Line 6:** Finds the HTML element whose ID is root, creates a React root there, and renders App. The self-closing &lt;App /&gt; tag creates the component; parentheses call functions, dots access methods, and the semicolon ends the statement.

## client/src/App.jsx

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\src\App.jsx`

The dashboard owns the saved lesson list and loading state. It fetches real API records, passes callbacks to LessonForm, and passes one record to each LessonCard.

### Lines 1–15

```text
1 | import React, { useEffect, useState } from 'react';
2 | import LessonForm from './LessonForm.jsx';
3 | import LessonCard from './LessonCard.jsx';
4 |
5 | export default function App() {
6 |   const [lessons, setLessons] = useState([]);
7 |   const [loading, setLoading] = useState(true);
8 |   const [error, setError] = useState('');
9 |   const [notice, setNotice] = useState('');
10 |   const [formOpen, setFormOpen] = useState(false);
11 |   const [reload, setReload] = useState(0);
12 |
13 |   useEffect(() => {
14 |     const controller = new AbortController();
15 |     async function loadLessons() {
```

- **Line 1:** Imports React for JSX plus effect and state hooks from the installed React package.
- **Line 2:** Imports the neighboring form component as LessonForm.
- **Line 3:** Imports the neighboring card component as LessonCard.
- **Line 4:** Blank line separates related sections for readability; it performs no operation.
- **Line 5:** Exports the App component as this module's default; braces begin its function body.
- **Line 6:** Array destructuring receives the current lessons array and its setter; useState starts with an empty array.
- **Line 7:** Stores whether a list request is running; true initially displays loading feedback.
- **Line 8:** Stores the list error message; empty text means no error.
- **Line 9:** Stores the server-confirmed success notice.
- **Line 10:** Stores whether the form is mounted; false initially hides it.
- **Line 11:** Stores a numeric retry counter; changing it reruns the effect.
- **Line 12:** Blank line separates related sections for readability; it performs no operation.
- **Line 13:** Starts an effect callback; React runs it after rendering and whenever its dependency changes.
- **Line 14:** Creates a request cancellation controller scoped to this effect run.
- **Line 15:** Declares an async helper, allowing await inside its braces.

### Lines 16–30

```text
16 |       setLoading(true);
17 |       setError('');
18 |       try {
19 |         const response = await fetch('/api/lessons', { signal: controller.signal });
20 |         if (!response.ok) throw new Error('Unable to load lessons.');
21 |         const data = await response.json();
22 |         if (!Array.isArray(data)) throw new Error('Unexpected lesson response.');
23 |         setLessons(data);
24 |       } catch (failure) {
25 |         if (failure.name !== 'AbortError') setError('Could not load saved lessons. Check the backend connection and try again.');
26 |       } finally {
27 |         if (!controller.signal.aborted) setLoading(false);
28 |       }
29 |     }
30 |     loadLessons();
```

- **Line 16:** Marks the list request as running.
- **Line 17:** Clears the previous list error before retrying.
- **Line 18:** Starts a try block for request and JSON errors.
- **Line 19:** Awaits GET through Vite's relative API proxy; the signal allows cancellation on cleanup.
- **Line 20:** Throws an Error for a non-successful HTTP status; ! negates response.ok.
- **Line 21:** Awaits parsing the JSON body into a JavaScript value.
- **Line 22:** Rejects a response that is not an array instead of attempting to map invalid data.
- **Line 23:** Stores the backend records, triggering a render.
- **Line 24:** Closes try and catches failures under the name failure.
- **Line 25:** Ignores intentional cancellation; otherwise stores useful connection guidance. !== means strict inequality.
- **Line 26:** Starts finally, which runs whether the request succeeded or failed.
- **Line 27:** Ends loading only for a still-active request, so an obsolete aborted request cannot reset a newer request's indicator.
- **Line 28:** Closes finally.
- **Line 29:** Closes the async helper.
- **Line 30:** Starts the helper; its own try/catch handles its failures.

### Lines 31–45

```text
31 |     return () => controller.abort();
32 |   }, [reload]);
33 |
34 |   function handleSaved(lesson) {
35 |     setLessons(current => [lesson, ...current.filter(item => item.id !== lesson.id)]);
36 |     setNotice(`Saved “${lesson.title}”.`);
37 |     setFormOpen(false);
38 |   }
39 |
40 |   return (
41 |     <main>
42 |       <header className="hero">
43 |         <div><p className="eyebrow">PLAN WITH PURPOSE</p><h1>CoachLab</h1><p>Your next great session starts with a clear plan.</p></div>
44 |         <button disabled={loading || formOpen} onClick={() => { setNotice(''); setFormOpen(true); }}>+ New Lesson</button>
45 |       </header>
```

- **Line 31:** Returns an effect cleanup callback that cancels the request when this effect is replaced or App unmounts.
- **Line 32:** Closes useEffect; the dependency array makes it run on first mount and when reload changes.
- **Line 33:** Blank line separates related sections for readability; it performs no operation.
- **Line 34:** Declares the callback receiving the row confirmed by LessonForm's successful POST.
- **Line 35:** Uses a functional state update: puts the confirmed lesson first, spreads remaining rows, and filters out any existing row with that same ID. Arrow functions take current state and each item.
- **Line 36:** Sets the success message with a template string that inserts the returned title using dollar-sign/braces interpolation.
- **Line 37:** Closes the form; unmounting it discards its input state after success.
- **Line 38:** Closes handleSaved.
- **Line 39:** Blank line separates related sections for readability; it performs no operation.
- **Line 40:** Begins returning a parenthesized JSX tree.
- **Line 41:** Opens the semantic main content element.
- **Line 42:** Opens the page header and applies the hero CSS class using JSX's className attribute.
- **Line 43:** Groups the eyebrow paragraph, main heading, and descriptive paragraph in a div; each matching closing tag ends its element.
- **Line 44:** Creates the New Lesson button. The OR condition disables it while loading or while a form is already open. Clicking clears the old notice and opens the form; arrow-function braces contain those two setter calls.
- **Line 45:** Closes the header.

### Lines 46–57

```text
46 |       {notice && <p className="success" role="status">{notice}</p>}
47 |       {formOpen && <LessonForm onSaved={handleSaved} onCancel={() => setFormOpen(false)} />}
48 |       <section aria-labelledby="lessons-heading">
49 |         <div className="section-heading"><h2 id="lessons-heading">Your lesson plans</h2><span>{lessons.length} saved</span></div>
50 |         {loading && <p role="status">Loading lesson plans…</p>}
51 |         {error && <div className="error" role="alert"><p>{error}</p><button className="secondary" disabled={loading || formOpen} onClick={() => setReload(value => value + 1)}>Retry loading</button></div>}
52 |         {!loading && !error && lessons.length === 0 && <div className="empty"><h3>A fresh start for your next session</h3><p>Select New Lesson to create your first plan. Saved lessons will appear here.</p></div>}
53 |         <div className="lesson-grid">{lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)}</div>
54 |       </section>
55 |     </main>
56 |   );
57 | }
```

- **Line 46:** Conditionally renders a success paragraph only when notice is nonempty; && means render the right side when the left side is truthy. role=status announces feedback politely.
- **Line 47:** Conditionally mounts LessonForm, passing onSaved and onCancel function props. Cancel sets formOpen false; the self-closing tag ends this component instance.
- **Line 48:** Opens a section whose accessible name refers to the heading ID below.
- **Line 49:** Groups the heading and current list length in a flex row; braces insert the numeric array length into the span.
- **Line 50:** Conditionally shows loading text as a live status paragraph.
- **Line 51:** Conditionally shows an alert with the error text and Retry button. Retry increments the dependency counter; loading or an open form disables it to prevent overlapping list/form operations.
- **Line 52:** Shows an empty-state heading and instructions only after a successful load with zero rows. ! means not, && requires all conditions, and === checks exact equality.
- **Line 53:** Maps the array to LessonCard instances inside the grid. key gives React each row's stable identity; the lesson prop passes the entire row, and the self-closing tag ends each card instance.
- **Line 54:** Closes the lesson section.
- **Line 55:** Closes main.
- **Line 56:** Closes the parenthesized return statement with a semicolon.
- **Line 57:** Closes the App function.

## client/src/styles.css

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\src\styles.css`

Shared styling for App, LessonForm and LessonCard. Each selector targets HTML elements or className values in those components. Braces enclose declarations; colons separate property and value, semicolons separate declarations. px means CSS pixels, rem is relative to root font size, em is relative to current font size, and hex values specify colors.

### Lines 1–15

```text
1 | :root { font-family: system-ui, sans-serif; color: #172d3a; background: #f3f6f7; line-height: 1.6; }
2 | * { box-sizing: border-box; }
3 | body { margin: 0; }
4 | main { max-width: 1140px; margin: 0 auto; padding: 48px 24px; }
5 | .hero, .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
6 | .hero { padding-bottom: 32px; border-bottom: 2px solid #c9d9d7; margin-bottom: 32px; }
7 | h1 { font-size: clamp(2.5rem, 7vw, 4rem); margin: 0; line-height: 1.1; letter-spacing: -0.04em; }
8 | h2, h3 { line-height: 1.3; margin-top: 0; }
9 | h3 { margin-bottom: 12px; font-size: 1.3rem; overflow-wrap: anywhere; }
10 | .eyebrow { color: #22665e; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.14em; }
11 | button { font: inherit; font-weight: 650; border: 1px solid transparent; border-radius: 8px; padding: 11px 20px; background: #176257; color: white; cursor: pointer; }
12 | button:hover:not(:disabled) { background: #104b42; }
13 | button:disabled { opacity: 0.6; cursor: not-allowed; }
14 | button.secondary { background: white; color: #172d3a; border-color: #b8c9cc; }
15 | button.secondary:hover:not(:disabled) { background: #edf3f3; }
```

- **Line 1:** :root styles the document: font-family prefers the system font with sans-serif fallback; color sets dark text; background sets the pale canvas; line-height sets line spacing to 1.6 times the font size.
- **Line 2:** The universal selector applies border-box sizing so declared widths include padding and borders.
- **Line 3:** Removes the browser's default body margin.
- **Line 4:** Caps main at 1140px, centers it with automatic horizontal margins, and adds 48px vertical/24px horizontal padding.
- **Line 5:** Both named classes use flex layout, vertically center children, spread them to opposite ends, and separate them with a 24px gap.
- **Line 6:** Adds bottom padding, a solid two-pixel divider, and bottom margin to the hero.
- **Line 7:** Sets heading size responsively with clamp(minimum, viewport-based preference, maximum), removes margins, tightens line spacing, and reduces letter spacing slightly.
- **Line 8:** Sets line spacing and removes top margins on both heading levels.
- **Line 9:** Sets third-level heading bottom spacing and font size, and permits long unbroken titles to wrap anywhere.
- **Line 10:** Styles eyebrow text with green color, small size, bold weight and expanded letter spacing.
- **Line 11:** Buttons inherit text styling, use semibold weight, reserve a transparent border, round corners, add vertical/horizontal padding, use green background/white text and a pointer cursor.
- **Line 12:** For hovered buttons that are not disabled, darkens the background; :not excludes disabled controls.
- **Line 13:** Disabled buttons become partially transparent and use a not-allowed cursor.
- **Line 14:** Buttons carrying the secondary class get a white background, dark text and visible muted border color.
- **Line 15:** Hovered enabled secondary buttons get a pale background.

### Lines 16–30

```text
16 | :focus-visible { outline: 3px solid #b36a12; outline-offset: 3px; }
17 | .form-panel, .lesson-card, .empty { background: white; border: 1px solid #d7e0e4; border-radius: 12px; padding: 24px; }
18 | .form-panel { margin-bottom: 32px; border-top: 4px solid #176257; }
19 | fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
20 | label { display: block; font-weight: 600; margin-bottom: 20px; }
21 | input, select, textarea { display: block; width: 100%; font: inherit; color: inherit; background: white; border: 1px solid #a6b9bd; border-radius: 6px; padding: 10px 12px; margin-top: 6px; }
22 | textarea { resize: vertical; min-height: 96px; }
23 | small { display: block; color: #52666e; font-weight: 400; }
24 | .form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
25 | .actions { display: flex; gap: 12px; flex-wrap: wrap; }
26 | .section-heading { margin-bottom: 20px; }
27 | .section-heading h2 { margin: 0; }
28 | .section-heading span, .metadata, .lesson-card footer { color: #52666e; font-size: 0.9rem; }
29 | .lesson-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
30 | .discipline { display: inline-block; background: #e4f1ed; color: #17584f; border-radius: 5px; padding: 3px 9px; margin-bottom: 14px; font-size: 0.8rem; font-weight: 700; }
```

- **Line 16:** Keyboard-visible focus receives a three-pixel solid orange outline offset three pixels from the element.
- **Line 17:** Form panels, cards and empty states share white backgrounds, a pale solid border, rounded corners and 24px padding.
- **Line 18:** Adds space below the form and a four-pixel green top border.
- **Line 19:** Removes the fieldset border, margin and padding; min-width zero lets it shrink inside narrow layouts.
- **Line 20:** Labels are blocks with semibold weight and bottom spacing.
- **Line 21:** Inputs, selects and textareas are full-width blocks inheriting font and text color, with white background, muted solid border, rounded corners, internal padding and top spacing.
- **Line 22:** Textareas can resize vertically and have a minimum height of 96px.
- **Line 23:** Small helper text displays on its own block, in muted color with normal weight.
- **Line 24:** The form row is a grid of three equally flexible columns (1fr each) separated by 20px.
- **Line 25:** The action row uses flex layout, a 12px gap, and wraps buttons if necessary.
- **Line 26:** Adds bottom spacing to the lesson section heading row.
- **Line 27:** Removes margins from its h2.
- **Line 28:** The heading count, metadata and card footer use muted color and smaller text.
- **Line 29:** The lesson grid has two equal columns, each allowed to shrink to zero with minmax, separated by 20px.
- **Line 30:** The discipline badge is inline-block with pale green fill, dark green text, rounded corners, vertical/horizontal padding, bottom spacing, small text and bold weight.

### Lines 31–45

```text
31 | dt { font-weight: 650; margin-top: 16px; }
32 | dd { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
33 | .lesson-card footer { border-top: 1px solid #e1e8ea; padding-top: 16px; margin-top: 24px; }
34 | .empty { text-align: center; padding: 48px 24px; border-style: dashed; }
35 | .empty p { color: #52666e; }
36 | .success, .error { padding: 16px; border-radius: 8px; overflow-wrap: anywhere; }
37 | .success { background: #e4f1ed; color: #17584f; }
38 | .error { background: #fff0ed; color: #852b1d; border: 1px solid #e6b6ae; }
39 | .error p { margin-top: 0; }
40 | .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
41 | @media (max-width: 700px) {
42 |   main { padding: 24px 16px; }
43 |   .hero { align-items: flex-start; flex-direction: column; gap: 12px; }
44 |   .form-row, .lesson-grid { grid-template-columns: 1fr; }
45 |   .section-heading { align-items: flex-start; gap: 12px; }
```

- **Line 31:** Definition terms have semibold weight and spacing above them.
- **Line 32:** Definition descriptions have a four-pixel top margin and zero other margins; pre-wrap preserves newlines/spaces while allowing wrapping, and overflow-wrap breaks long words.
- **Line 33:** Card footers have a light top divider, padding above the text and margin above the divider.
- **Line 34:** The empty state centers text, uses generous vertical/horizontal padding, and changes its shared border style to dashed.
- **Line 35:** Empty-state paragraph text is muted.
- **Line 36:** Success and error panels share internal spacing, rounded corners and long-word wrapping.
- **Line 37:** Success feedback uses a pale green background and dark green text.
- **Line 38:** Errors use a pale red background, dark red text and a muted red solid border.
- **Line 39:** Removes top margins from paragraphs inside error panels.
- **Line 40:** The screen-reader-only class uses absolute positioning, one-pixel dimensions, zero padding, negative margin, hidden overflow and an inset clip to visually hide its content. nowrap prevents wrapping and border zero removes the border; the text remains accessible.
- **Line 41:** Starts a media query applying the enclosed overrides when the viewport is at most 700 CSS pixels wide.
- **Line 42:** Reduces main padding to 24px vertically and 16px horizontally on small screens.
- **Line 43:** Stacks hero children vertically, aligns them to the start and reduces their gap.
- **Line 44:** Changes both grids to one flexible column on small screens.
- **Line 45:** Aligns section-heading children to their starts and reduces their gap.

### Lines 46–47

```text
46 |   .form-panel, .lesson-card { padding: 20px; }
47 | }
```

- **Line 46:** Reduces form-panel and card padding to 20px.
- **Line 47:** Closes the media-query block.

## client/vite.config.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\vite.config.js`

Vite reads this file through the npm frontend/build commands. The development proxy connects browser API requests to Express without adding a CORS package.

### Lines 1–12

```text
1 | import { defineConfig } from 'vite';
2 | import { fileURLToPath } from 'node:url';
3 |
4 | export default defineConfig({
5 |   root: fileURLToPath(new URL('.', import.meta.url)),
6 |   server: {
7 |     host: '127.0.0.1',
8 |     port: 5173,
9 |     strictPort: true,
10 |     proxy: { '/api': 'http://127.0.0.1:3001' },
11 |   },
12 | });
```

- **Line 1:** Imports Vite's named defineConfig helper, which describes a Vite configuration object.
- **Line 2:** Imports Node's named fileURLToPath helper to convert a file URL into an operating-system path.
- **Line 3:** Blank line separates related sections for readability; it performs no operation.
- **Line 4:** Exports the result of calling defineConfig as the default value. The ({ starts the function argument and its configuration object.
- **Line 5:** Sets root to this config file's directory. import.meta.url is this module's URL; new URL('.', ...) resolves its directory; fileURLToPath converts it to a filesystem path. The comma separates object properties.
- **Line 6:** Opens a nested object of development-server settings under the server key.
- **Line 7:** Binds the frontend to IPv4 loopback, accessible on this computer rather than the local network.
- **Line 8:** Chooses TCP port 5173 for frontend HTTP requests.
- **Line 9:** Prevents Vite from silently choosing another port when 5173 is busy; startup fails instead.
- **Line 10:** Maps requests starting with /api to Express at port 3001. Inner braces hold this path-to-target mapping, and the trailing comma permits another property.
- **Line 11:** Closes the server settings object and separates it from any following top-level property.
- **Line 12:** Closes the top-level object and defineConfig call; the semicolon ends the export statement.

## server/config.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\config.js`

Executed when server/index.js imports it. It exports the path used by database.js, but does not create a file, directory, connection, or migration.

### Lines 1–14

```text
1 | import { homedir } from 'node:os';
2 | import path from 'node:path';
3 |
4 | // This only chooses the future database location; it does not create a database.
5 | export const databasePath = process.env.DATABASE_PATH?.trim()
6 |   || path.join(homedir(), 'AppData', 'Local', 'CoachLab', 'coachlab.sqlite');
7 |
8 | if (!path.isAbsolute(databasePath)) {
9 |   throw new Error('DATABASE_PATH must be an absolute path outside OneDrive.');
10 | }
11 |
12 | if (path.resolve(databasePath).split(path.sep).some(part => /^onedrive(?:\s|$)/i.test(part))) {
13 |   throw new Error('DATABASE_PATH must be outside OneDrive.');
14 | }
```

- **Line 1:** Imports the named homedir function from Node's built-in operating-system module; node: explicitly identifies a built-in module.
- **Line 2:** Imports Node's path utilities as a default import for platform-aware path operations.
- **Line 3:** Blank line separates related sections for readability; it performs no operation.
- **Line 4:** A // comment explains the purpose; comments do not execute.
- **Line 5:** Exports a constant databasePath. process.env reads backend environment variables; ?. calls trim only when DATABASE_PATH exists. trim removes surrounding whitespace. The expression continues on the next line.
- **Line 6:** The || operator selects the fallback when the configured value is absent or empty. path.join combines the user's home directory and these folder/file names using Windows separators here; the semicolon ends the assignment.
- **Line 7:** Blank line separates related sections for readability; it performs no operation.
- **Line 8:** Checks whether the selected path is not absolute. ! reverses the Boolean result of isAbsolute; braces open the conditional block.
- **Line 9:** Throws an Error with an actionable message. A thrown error during import prevents normal server startup.
- **Line 10:** Closes the absolute-path validation block.
- **Line 11:** Blank line separates related sections for readability; it performs no operation.
- **Line 12:** Resolves and normalizes the path, splits it into folder parts using path.sep, and uses some to check whether any part matches. part =&gt; is an arrow predicate. The regex starts at the beginning (^), matches onedrive followed by whitespace (\s) or end ($), groups alternatives with (?:...|...), and ignores case with i. It is a folder-name heuristic, not detection of arbitrary sync roots or filesystem links.
- **Line 13:** Rejects a matching OneDrive folder with an Error before the server starts.
- **Line 14:** Closes the OneDrive validation block.

## server/index.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\index.js`

Executable server entry point. It uses the existing opener and migrations, then passes one database connection to createApp. No request opens another connection.

### Lines 1–15

```text
1 | import { createApp } from './app.js';
2 | import { openDatabase } from './database.js';
3 | import { migrate } from './migrations.js';
4 |
5 | let database;
6 | try {
7 |   database = openDatabase();
8 |   migrate(database);
9 |   const server = createApp(database).listen(3001, '127.0.0.1', () => {
10 |     console.log('CoachLab API listening at http://127.0.0.1:3001');
11 |   });
12 |   server.on('error', () => {
13 |     database.close();
14 |     console.error('Could not start CoachLab API. Check whether port 3001 is already in use.');
15 |     process.exitCode = 1;
```

- **Line 1:** Imports the factory that constructs Express routes using an open database.
- **Line 2:** Imports the existing database opener; its configuration still keeps the file outside OneDrive.
- **Line 3:** Imports the existing versioned migration function; no new schema is introduced.
- **Line 4:** Blank line separates related sections for readability; it performs no operation.
- **Line 5:** Declares a connection variable with let so it can be assigned inside try and inspected in catch.
- **Line 6:** Opens a try block for startup work that can throw.
- **Line 7:** Opens one SQLite connection and assigns it to database.
- **Line 8:** Runs existing migrations before preparing API queries; missing version 1 is applied without erasing existing lessons.
- **Line 9:** Creates the app and listens on loopback port 3001. The arrow callback runs when listening begins; const stores the HTTP server.
- **Line 10:** Prints the local URL after successful listening, without printing database credentials or environment values.
- **Line 11:** Closes the listening callback and listen call.
- **Line 12:** Registers an error event listener for HTTP server failures such as a busy port.
- **Line 13:** Closes the database when listening fails.
- **Line 14:** Prints a safe explanation suggesting a port conflict; no internal error object is printed.
- **Line 15:** Sets Node's exit status to failure; this does not forcibly terminate the outer development watch process.

### Lines 16–24

```text
16 |   });
17 |   for (const signal of ['SIGINT', 'SIGTERM']) {
18 |     process.once(signal, () => server.close(() => database.close()));
19 |   }
20 | } catch {
21 |   if (database?.open) database.close();
22 |   console.error('Could not initialize CoachLab database. Check DATABASE_PATH and run npm run db:migrate.');
23 |   process.exitCode = 1;
24 | }
```

- **Line 16:** Closes the error callback and event registration.
- **Line 17:** Loops over the two normal termination signals, SIGINT (such as Ctrl+C) and SIGTERM.
- **Line 18:** Registers a one-time handler for each signal. It stops accepting HTTP connections and closes the database after the server finishes closing. Nested arrow callbacks describe those two stages.
- **Line 19:** Closes the signal-registration loop.
- **Line 20:** Closes try and opens catch without binding the internal error, because the terminal message is intentionally generic.
- **Line 21:** If a connection exists and remains open, closes it. Optional chaining avoids reading open on undefined.
- **Line 22:** Prints actionable startup guidance without leaking the internal database exception. Invalid configuration errors can also occur earlier during module imports; their existing messages contain no environment values.
- **Line 23:** Sets the failure exit status so scripts can detect startup failure.
- **Line 24:** Closes the catch block.

## package.json

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\package.json`

npm reads this JSON manifest for commands and dependency versions. JSON has quoted keys, colons, comma-separated properties, and no comments. A single root manifest serves client and server.

### Lines 1–15

```text
1 | {
2 |   "name": "coachlab",
3 |   "version": "0.1.0",
4 |   "private": true,
5 |   "type": "module",
6 |   "engines": {
7 |     "node": ">=24.19.0 <25"
8 |   },
9 |   "scripts": {
10 |     "dev:client": "vite --config client/vite.config.js",
11 |     "dev:server": "node --env-file-if-exists=.env --watch server/index.js",
12 |     "build": "vite build --config client/vite.config.js",
13 |     "db:migrate": "node --env-file-if-exists=.env server/migrate.js",
14 |     "test": "node --test server/database.test.js server/api.test.js"
15 |   },
```

- **Line 1:** Opens the JSON manifest object.
- **Line 2:** Names the package coachlab.
- **Line 3:** Sets the application's own version number.
- **Line 4:** Prevents accidental publication to the npm registry.
- **Line 5:** Enables JavaScript import/export modules for .js files in this package.
- **Line 6:** Opens the engines object containing supported runtime versions.
- **Line 7:** Requires Node at least 24.19.0 but below 25; --engine-strict enforces this during installation.
- **Line 8:** Closes the engines object and separates the next property.
- **Line 9:** Opens scripts, the map of npm command names to shell commands.
- **Line 10:** Runs Vite with client/vite.config.js to serve the frontend locally.
- **Line 11:** Runs Express with an optional .env file and Node's source watch/restart mode.
- **Line 12:** Builds the frontend using the same Vite configuration; this does not run the API or migrate SQLite.
- **Line 13:** Defines npm run db:migrate: Node reads optional .env and executes server/migrate.js without watch mode.
- **Line 14:** Defines npm test to run both the database tests and real-HTTP API tests using Node's built-in test runner.
- **Line 15:** Closes scripts and separates the next object.

### Lines 16–25

```text
16 |   "dependencies": {
17 |     "better-sqlite3": "13.0.3",
18 |     "express": "5.3.0",
19 |     "react": "19.3.0",
20 |     "react-dom": "19.3.0"
21 |   },
22 |   "devDependencies": {
23 |     "vite": "8.3.4"
24 |   }
25 | }
```

- **Line 16:** Opens runtime dependencies.
- **Line 17:** Pins better-sqlite3 to 13.0.3, providing the SQLite connection and prepared-query API.
- **Line 18:** Pins Express to 5.3.0.
- **Line 19:** Pins React to 19.3.0.
- **Line 20:** Pins React DOM to 19.3.0; no comma follows the object's last property.
- **Line 21:** Closes runtime dependencies.
- **Line 22:** Opens development dependencies.
- **Line 23:** Pins Vite to 8.3.4 for serving and building the frontend.
- **Line 24:** Closes development dependencies.
- **Line 25:** Closes the root JSON object.

## .env.example

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\.env.example`

A committed, harmless example. Node loads .env, not .env.example; users may copy it to an ignored .env and set a backend-only override.

### Lines 1–4

```text
1 | # Optional absolute path outside OneDrive. Leave blank to use:
2 | # <Windows user home>/AppData/Local/CoachLab/coachlab.sqlite
3 | # Example: DATABASE_PATH=C:/LocalData/CoachLab/coachlab.sqlite
4 | DATABASE_PATH=
```

- **Line 1:** A # starts a comment. This explains that the optional database override must be absolute and outside OneDrive.
- **Line 2:** Documents the fallback location; angle-bracket text is a human-readable placeholder, not shell syntax or literal configuration.
- **Line 3:** Shows a harmless absolute example path inside a comment; it is not an active assignment.
- **Line 4:** Assigns an empty DATABASE_PATH. If copied to .env, config.js treats this empty value as false and uses its default.

## .gitignore

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\.gitignore`

Git reads these patterns to exclude untracked local/generated files. Ignore rules do not remove files already tracked. A trailing slash targets directories; * matches text; ! re-includes a matching path.

### Lines 1–15

```text
1 | node_modules/
2 | dist/
3 | .env
4 | .env.*
5 | !.env.example
6 | *.db
7 | *.db-*
8 | *.sqlite
9 | *.sqlite-*
10 | *.sqlite3
11 | *.sqlite3-*
12 | *.log
13 | *.tmp
14 | *.temp
15 | tmp/
```

- **Line 1:** Ignores node_modules dependency directories at any depth.
- **Line 2:** Ignores generated dist directories, including client/dist.
- **Line 3:** Ignores private .env files.
- **Line 4:** Ignores suffixed environment files such as .env.local.
- **Line 5:** Re-includes .env.example so a safe example can be committed; order matters after the broader rule.
- **Line 6:** Ignores database files ending in .db.
- **Line 7:** Ignores .db sidecar files such as .db-wal or .db-journal.
- **Line 8:** Ignores database files ending in .sqlite.
- **Line 9:** Ignores .sqlite sidecar files such as .sqlite-wal.
- **Line 10:** Ignores database files ending in .sqlite3.
- **Line 11:** Ignores .sqlite3 sidecar files.
- **Line 12:** Ignores log files ending in .log.
- **Line 13:** Ignores temporary files ending in .tmp.
- **Line 14:** Ignores temporary files ending in .temp.
- **Line 15:** Ignores tmp directories used for temporary work.

### Lines 16–18

```text
16 | coverage/
17 | .DS_Store
18 | Thumbs.db
```

- **Line 16:** Ignores generated coverage report directories.
- **Line 17:** Ignores macOS Finder metadata files named .DS_Store.
- **Line 18:** Ignores Windows thumbnail cache files named Thumbs.db.

## server/database.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\database.js`

Opens the configured SQLite file when called by the migration command or future backend code. Importing the module alone does not open a database.

### Lines 1–9

```text
1 | import Database from 'better-sqlite3';
2 | import { mkdirSync } from 'node:fs';
3 | import path from 'node:path';
4 | import { databasePath } from './config.js';
5 |
6 | export function openDatabase() {
7 |   mkdirSync(path.dirname(databasePath), { recursive: true });
8 |   return new Database(databasePath);
9 | }
```

- **Line 1:** Imports the default Database constructor from the installed better-sqlite3 package, the JavaScript interface to SQLite.
- **Line 2:** Imports mkdirSync, Node's synchronous directory-creation function.
- **Line 3:** Imports the path utility object for platform-aware path operations.
- **Line 4:** Imports the validated databasePath value from config.js; configuration validation runs during that import.
- **Line 5:** Blank line separates related sections for readability; it performs no operation.
- **Line 6:** Exports a named function so other modules can open the configured database; braces begin its body.
- **Line 7:** Computes the parent directory with dirname, then creates it if necessary. recursive: true also creates missing ancestor directories and tolerates an existing directory. Filesystem errors are allowed to propagate.
- **Line 8:** Constructs and returns a SQLite connection to the file. SQLite creates the file if absent; the caller must close the connection. Errors are not disguised as success.
- **Line 9:** Closes the openDatabase function.

## server/migrations/001_create_lessons.sql

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\migrations\001_create_lessons.sql`

Version 1 of the schema. migrations.js reads this fixed local SQL file and executes it within a transaction. SQL keywords describe database operations; commas separate columns and constraints. Do not edit a migration already applied to shared databases: add a new version instead.

### Lines 1–11

```text
1 | CREATE TABLE lessons (
2 |   id INTEGER PRIMARY KEY,
3 |   title TEXT NOT NULL CHECK (length(trim(title)) > 0),
4 |   discipline TEXT NOT NULL CHECK (discipline IN ('Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training')),
5 |   skill_level TEXT NOT NULL DEFAULT 'Beginner' CHECK (skill_level IN ('Beginner', 'Intermediate', 'Advanced')),
6 |   duration_minutes INTEGER CHECK (duration_minutes > 0),
7 |   goal TEXT NOT NULL DEFAULT '',
8 |   drills TEXT NOT NULL DEFAULT '',
9 |   coaching_notes TEXT NOT NULL DEFAULT '',
10 |   created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
11 | ) STRICT;
```

- **Line 1:** CREATE TABLE defines a new lessons table; the opening parenthesis begins its column definitions. The runner checks its version before executing this statement.
- **Line 2:** Defines id as the integer primary key, a unique row identifier. In SQLite this aliases the row ID and is generated when an insert omits it. A comma separates the next column.
- **Line 3:** Requires a text title that is not NULL. CHECK evaluates length(trim(title)) &gt; 0: remove ordinary surrounding spaces, count remaining characters, and reject zero length. This does not replace future API validation for all whitespace or length rules.
- **Line 4:** Requires a text discipline chosen from the six quoted values. IN tests membership; the parentheses hold the choices and close the CHECK expression.
- **Line 5:** Requires skill_level text, defaults it to Beginner when omitted, and restricts it to the three listed values with CHECK and IN.
- **Line 6:** Defines duration_minutes as an integer. CHECK rejects zero or negative values. With no NOT NULL constraint, NULL is allowed to represent an unspecified duration; STRICT rejects fractional values that cannot become integers.
- **Line 7:** Requires goal text and supplies the empty string default when omitted; two single quotes mean an empty SQL string.
- **Line 8:** Requires drills text with an empty-string default.
- **Line 9:** Requires coaching_notes text with an empty-string default.
- **Line 10:** Requires a creation timestamp as text. DEFAULT evaluates strftime using SQLite's current UTC time; %Y/%m/%d are date pieces, %H/%M/%f are hours/minutes/seconds with fractions, T separates date/time, and Z indicates UTC. Parentheses enclose the default expression.
- **Line 11:** Closes the table definition and enables STRICT typing, so stored values must conform to the column types under SQLite's conversion rules. The semicolon ends the SQL statement.

## server/migrations.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\migrations.js`

Tracks applied versions in schema_migrations. Each schema change and its version record are committed together, so a failure cannot falsely mark a version as applied. It receives an open connection; it does not choose the database path.

### Lines 1–15

```text
1 | import { readFileSync } from 'node:fs';
2 |
3 | export function migrate(database) {
4 |   database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
5 |     version INTEGER PRIMARY KEY,
6 |     applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
7 |   ) STRICT`);
8 |   const migrations = [{ version: 1, file: '001_create_lessons.sql' }];
9 |   for (const migration of migrations) {
10 |     database.transaction(() => {
11 |       const applied = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version);
12 |       if (applied) return;
13 |       const sql = readFileSync(new URL(`./migrations/${migration.file}`, import.meta.url), 'utf8');
14 |       database.exec(sql);
15 |       database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
```

- **Line 1:** Imports the named readFileSync function to read migration SQL from disk as text.
- **Line 2:** Blank line separates related sections for readability; it performs no operation.
- **Line 3:** Exports migrate, a function taking an already-open database connection; braces open its body.
- **Line 4:** Begins a multiline template string containing SQL and passes it to exec. CREATE TABLE IF NOT EXISTS creates the tracking table only when it is missing; parentheses open its columns. Backticks delimit multiline JavaScript strings.
- **Line 5:** Defines the tracking version as a unique integer primary key. The comma separates the timestamp column.
- **Line 6:** Defines a required applied_at UTC timestamp with a default evaluated at insertion, using the same strftime format as lesson timestamps.
- **Line 7:** Closes the tracking table columns, enables STRICT typing, closes the template string and exec call, and ends the JavaScript statement. Creating this bookkeeping table occurs before each version transaction.
- **Line 8:** Creates an ordered array containing one migration descriptor. Its object pairs version 1 with a fixed SQL filename. Later versions can be appended to this array in order.
- **Line 9:** Iterates the descriptors with for...of. const migration holds the current descriptor; braces open the loop.
- **Line 10:** Creates a transaction wrapper around the arrow callback. The callback's queries will run as one atomic unit when the wrapper is called below.
- **Line 11:** Prepares a SELECT query with a ? placeholder and binds the current version through get. This keeps data separate from SQL syntax; get returns one row or undefined.
- **Line 12:** If a version row already exists, returns from this transaction callback without changing lessons. The outer loop can still continue to later migrations.
- **Line 13:** Builds a file URL relative to this module using import.meta.url and interpolates the fixed migration filename using a dollar sign followed by braces. readFileSync reads UTF-8 SQL text. No user input supplies this SQL file.
- **Line 14:** Executes the trusted migration SQL, creating the lessons table for version 1. A database failure throws rather than pretending to succeed.
- **Line 15:** Records the version using a parameterized INSERT and run. The applied_at default supplies the timestamp. This insert shares the schema-change transaction.

### Lines 16–18

```text
16 |     })();
17 |   }
18 | }
```

- **Line 16:** Closes the callback and transaction factory call, then immediately calls the returned wrapper with (). Success commits; an exception rolls back the changes and propagates.
- **Line 17:** Closes the for loop.
- **Line 18:** Closes migrate.

## server/migrate.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\migrate.js`

The executable entry point behind npm run db:migrate. It opens the external database, applies pending migrations, and closes the connection. This command runs independently of the HTTP routes.

### Lines 1–10

```text
1 | import { openDatabase } from './database.js';
2 | import { migrate } from './migrations.js';
3 |
4 | const database = openDatabase();
5 | try {
6 |   migrate(database);
7 |   console.log('Database migrations are up to date.');
8 | } finally {
9 |   database.close();
10 | }
```

- **Line 1:** Imports the function that opens the configured SQLite file.
- **Line 2:** Imports the versioned migration runner.
- **Line 3:** Blank line separates related sections for readability; it performs no operation.
- **Line 4:** Opens the database and stores the connection in a constant. Opening failures stop execution without printing success.
- **Line 5:** Starts a try block for the operations that need connection cleanup.
- **Line 6:** Applies pending schema versions; throws on failure.
- **Line 7:** Prints a success message only after migrate returns successfully; it does not print environment values.
- **Line 8:** Closes try and begins finally. A finally block runs whether the preceding work succeeded or threw.
- **Line 9:** Closes the SQLite connection to release file handles. Errors still propagate to Node and produce a failing command exit.
- **Line 10:** Closes the finally block.

## server/database.test.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\database.test.js`

Automated checks using Node's built-in test runner. Tests create an isolated temporary database and fresh Node processes, then remove only their own verified temporary directory. They never insert sample rows into the normal CoachLab database. The rollback test deliberately simulates a database failure inside an isolated test, not a production bug.

### Lines 1–15

```text
1 | import test from 'node:test';
2 | import assert from 'node:assert/strict';
3 | import { mkdtempSync, rmSync } from 'node:fs';
4 | import { tmpdir, homedir } from 'node:os';
5 | import path from 'node:path';
6 | import { spawnSync } from 'node:child_process';
7 | import Database from 'better-sqlite3';
8 | import { migrate } from './migrations.js';
9 |
10 | function run(code, filename) {
11 |   const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
12 |     cwd: new URL('../', import.meta.url),
13 |     env: { ...process.env, DATABASE_PATH: filename }, encoding: 'utf8',
14 |   });
15 |   assert.equal(result.error, undefined);
```

- **Line 1:** Imports Node's built-in test function for defining named test cases.
- **Line 2:** Imports strict assertions; these throw when actual behavior differs from the expected value.
- **Line 3:** Imports synchronous temporary-directory creation and removal helpers.
- **Line 4:** Imports functions for the system temporary folder and user home directory.
- **Line 5:** Imports path helpers to construct and verify filesystem paths.
- **Line 6:** Imports spawnSync to run a child Node process and wait for it to finish.
- **Line 7:** Imports the SQLite constructor for direct schema and data assertions.
- **Line 8:** Imports the migration function for the isolated rollback test.
- **Line 9:** Blank line separates related sections for readability; it performs no operation.
- **Line 10:** Declares a helper function accepting JavaScript source and a database filename.
- **Line 11:** Starts the current Node executable with module mode and -e to execute the supplied test code. The final object contains process options.
- **Line 12:** Sets the child working directory to the project root using a URL relative to this test module; this makes its relative imports reliable.
- **Line 13:** Copies the existing environment with spread syntax, overrides DATABASE_PATH for isolation, and requests UTF-8 output strings. These environment values are not printed.
- **Line 14:** Closes the options object and spawnSync call.
- **Line 15:** Checks that the child process could be spawned. Normal program failures are checked through status by the caller.

### Lines 16–30

```text
16 |   return result;
17 | }
18 |
19 | test('database configuration accepts external paths and rejects unsafe paths', () => {
20 |   const code = "import { databasePath } from './server/config.js'; console.log(databasePath);";
21 |   const defaultResult = run(code, '');
22 |   assert.equal(defaultResult.status, 0);
23 |   assert.equal(defaultResult.stdout.trim(), path.join(homedir(), 'AppData', 'Local', 'CoachLab', 'coachlab.sqlite'));
24 |   const custom = path.join(tmpdir(), 'coachlab-custom.sqlite');
25 |   assert.equal(run(code, custom).stdout.trim(), custom);
26 |   for (const invalid of ['relative.sqlite', path.join(homedir(), 'OneDrive', 'bad.sqlite'), path.join(homedir(), 'OneDrive - Company', 'bad.sqlite')]) {
27 |     assert.notEqual(run(code, invalid).status, 0);
28 |   }
29 | });
30 |
```

- **Line 16:** Returns the result object containing exit status and captured output.
- **Line 17:** Closes the helper function.
- **Line 18:** Blank line separates related sections for readability; it performs no operation.
- **Line 19:** Defines the configuration test and opens its arrow-function callback.
- **Line 20:** Stores a short child program that imports and prints the selected database path, allowing assertions without opening a database.
- **Line 21:** Runs it with an empty DATABASE_PATH to exercise the fallback.
- **Line 22:** Asserts the fallback process exited successfully with status zero.
- **Line 23:** Asserts the selected default is the user's AppData/Local/CoachLab/coachlab.sqlite path.
- **Line 24:** Builds a harmless custom filename under the temporary directory; this configuration test does not create it.
- **Line 25:** Asserts the custom path is returned unchanged by configuration.
- **Line 26:** Loops over a relative path and two typical OneDrive folder paths, including a business OneDrive name. These are test inputs, not files to create.
- **Line 27:** Asserts each rejected path causes a nonzero exit. notEqual means the two values must differ.
- **Line 28:** Closes the invalid-path loop.
- **Line 29:** Closes the configuration test callback and test registration.
- **Line 30:** Blank line separates related sections for readability; it performs no operation.

### Lines 31–45

```text
31 | test('versioned migration, constraints, and persistence across processes', () => {
32 |   const directory = mkdtempSync(path.join(tmpdir(), 'coachlab-test-'));
33 |   assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
34 |   assert.ok(path.basename(directory).startsWith('coachlab-test-'));
35 |   const filename = path.join(directory, 'nested', 'lessons.sqlite');
36 |   let database;
37 |   try {
38 |     const migrationCode = "import './server/migrate.js';";
39 |     assert.equal(run(migrationCode, filename).status, 0);
40 |     database = new Database(filename);
41 |     assert.deepEqual(database.prepare('PRAGMA table_info(lessons)').all().map(column => column.name), ['id', 'title', 'discipline', 'skill_level', 'duration_minutes', 'goal', 'drills', 'coaching_notes', 'created_at']);
42 |     const title = "Coach's jab; DROP TABLE lessons; --";
43 |     const insert = database.prepare('INSERT INTO lessons (title, discipline, duration_minutes) VALUES (?, ?, ?)');
44 |     insert.run(title, 'Boxing', 45);
45 |     for (const values of [[' ', 'Boxing', 45], ['Test', 'Unknown', 45], ['Test', 'Boxing', -1], ['Test', 'Boxing', 1.5]]) {
```

- **Line 31:** Defines the disk migration/persistence test and opens its callback.
- **Line 32:** Creates a unique test directory using the system temporary directory and a coachlab-test- prefix.
- **Line 33:** Verifies that the resolved directory's parent is exactly the intended temporary directory before any recursive cleanup can happen.
- **Line 34:** Verifies the generated directory name has the expected test prefix, further bounding cleanup to this test's own directory.
- **Line 35:** Builds a database filename inside a missing nested directory so the test also checks automatic parent-directory creation.
- **Line 36:** Declares a mutable connection variable; let allows it to be reassigned when the test reopens the database.
- **Line 37:** Starts a try block whose finally will clean up resources even if an assertion fails.
- **Line 38:** Stores child code importing the real migration command module, which runs the migration.
- **Line 39:** Runs the migration in a fresh Node process against the test file and asserts success.
- **Line 40:** Opens that file for direct inspection through SQLite.
- **Line 41:** Reads table metadata with PRAGMA table_info, maps each returned column to its name, and compares the complete ordered list to the ten required columns. deepEqual compares array contents, not just object identity.
- **Line 42:** Creates a title containing an apostrophe and SQL-looking text to verify it is safely stored as data.
- **Line 43:** Prepares a parameterized INSERT with three ? placeholders for title, discipline, and duration.
- **Line 44:** Binds the title, Boxing, and 45 to those placeholders and inserts one lesson.
- **Line 45:** Iterates invalid value arrays: blank title, unknown discipline, negative duration, and fractional duration.

### Lines 46–60

```text
46 |       assert.throws(() => insert.run(...values));
47 |     }
48 |     assert.throws(() => database.prepare('INSERT INTO lessons (title, discipline, skill_level) VALUES (?, ?, ?)').run('Test', 'Boxing', 'Expert'));
49 |     const saved = database.prepare('SELECT * FROM lessons').get();
50 |     assert.equal(saved.skill_level, 'Beginner');
51 |     assert.equal(saved.goal, '');
52 |     assert.ok(Number.isFinite(Date.parse(saved.created_at)));
53 |     database.close();
54 |     assert.equal(run(migrationCode, filename).status, 0);
55 |     const reader = run("import { openDatabase } from './server/database.js'; const db = openDatabase(); console.log(JSON.stringify(db.prepare('SELECT * FROM lessons').all())); db.close();", filename);
56 |     assert.equal(reader.status, 0);
57 |     assert.deepEqual(JSON.parse(reader.stdout), [saved]);
58 |     database = new Database(filename);
59 |     assert.deepEqual(database.prepare('SELECT version FROM schema_migrations').all(), [{ version: 1 }]);
60 |     assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
```

- **Line 46:** Uses spread syntax to pass each array as query arguments and asserts that the database rejects it with an exception.
- **Line 47:** Closes the invalid-data loop.
- **Line 48:** Asserts that inserting Expert as a skill level throws, using a separate parameterized query.
- **Line 49:** Reads the single valid lesson, including generated/default fields, into saved.
- **Line 50:** Checks the omitted skill level defaulted to Beginner.
- **Line 51:** Checks the omitted goal defaulted to empty text.
- **Line 52:** Parses created_at and checks the result is a finite timestamp, so it is a usable date string.
- **Line 53:** Closes the first connection before restarting the migration process.
- **Line 54:** Runs migration again in another Node process and asserts success, exercising version skipping on an existing database.
- **Line 55:** Runs a separate reader process that opens the same file, selects all rows, prints JSON, and closes it. No connection or in-memory JavaScript object is shared with that process.
- **Line 56:** Asserts the reader process exited successfully.
- **Line 57:** Parses its JSON and compares every field to the saved lesson, proving file persistence and that the repeated migration preserved data.
- **Line 58:** Reopens the test database for tracking-table and integrity checks.
- **Line 59:** Asserts exactly one version-1 row exists in the migration ledger; rerunning did not duplicate it.
- **Line 60:** Runs SQLite's integrity check and requires the result ok.

### Lines 61–75

```text
61 |   } finally {
62 |     if (database?.open) database.close();
63 |     rmSync(directory, { recursive: true, force: true });
64 |   }
65 | });
66 |
67 | test('migration failure rolls back the schema and version together', () => {
68 |   const database = new Database(':memory:');
69 |   try {
70 |     database.exec('CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)');
71 |     database.exec("CREATE TRIGGER reject_version BEFORE INSERT ON schema_migrations BEGIN SELECT RAISE(ABORT, 'test failure'); END");
72 |     assert.throws(() => migrate(database), /test failure/);
73 |     assert.equal(database.prepare("SELECT name FROM sqlite_master WHERE name = 'lessons'").get(), undefined);
74 |     assert.equal(database.prepare('SELECT count(*) AS count FROM schema_migrations').get().count, 0);
75 |   } finally {
```

- **Line 61:** Closes try and begins cleanup with finally, which runs even when assertions fail.
- **Line 62:** Uses optional chaining to check whether a connection exists and is still open, then closes it if needed.
- **Line 63:** Removes only the test directory whose parent and prefix were verified above. recursive removes its nested files; force tolerates an already-missing directory.
- **Line 64:** Closes the finally block.
- **Line 65:** Closes the persistence test callback and registration.
- **Line 66:** Blank line separates related sections for readability; it performs no operation.
- **Line 67:** Defines the atomic rollback test and opens its callback.
- **Line 68:** Creates an isolated in-memory SQLite database; :memory: does not create a disk file.
- **Line 69:** Starts a try block so the test connection always gets closed.
- **Line 70:** Creates a minimal existing migration ledger for fault injection in this test only.
- **Line 71:** Creates a test-only trigger that runs before a version INSERT and raises an ABORT error. BEGIN/END enclose the trigger's SQL action, and the semicolons delimit its statements.
- **Line 72:** Expects migrate to throw an error matching the /test failure/ regular expression when it tries to record the version.
- **Line 73:** Queries SQLite's schema catalog and asserts the lessons table does not exist: its creation was rolled back with the failed version insert.
- **Line 74:** Counts ledger rows using an SQL alias count and requires zero, confirming no version was falsely marked applied.
- **Line 75:** Closes try and opens finally for unconditional cleanup.

### Lines 76–78

```text
76 |     database.close();
77 |   }
78 | });
```

- **Line 76:** Closes the in-memory database.
- **Line 77:** Closes finally.
- **Line 78:** Closes the rollback test callback and registration.

## server/validate-lesson.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\validate-lesson.js`

Validates and normalizes the POST body before any write. It returns either an error message or a safe lesson object containing only allowed fields; it never talks to SQLite.

### Lines 1–15

```text
1 | const disciplines = ['Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training'];
2 | const levels = ['Beginner', 'Intermediate', 'Advanced'];
3 | const textLimits = { title: 200, goal: 2000, drills: 10000, coaching_notes: 10000 };
4 | const fields = [...Object.keys(textLimits), 'discipline', 'skill_level', 'duration_minutes'];
5 |
6 | export function validateLesson(body) {
7 |   if (!body || typeof body !== 'object' || Array.isArray(body)) {
8 |     return { error: 'Send a JSON object containing lesson fields.' };
9 |   }
10 |   if (Object.keys(body).some(field => !fields.includes(field))) {
11 |     return { error: 'The request contains unsupported lesson fields.' };
12 |   }
13 |   const lesson = {};
14 |   for (const [field, limit] of Object.entries(textLimits)) {
15 |     const value = body[field] === undefined && field !== 'title' ? '' : body[field];
```

- **Line 1:** Defines the array of six supported discipline strings; const prevents reassignment of the array variable.
- **Line 2:** Defines the three accepted skill-level strings.
- **Line 3:** Maps each free-text field to its maximum JavaScript string length, measured in UTF-16 code units.
- **Line 4:** Builds the allowed-field array by spreading the text field names and adding the three other supported fields. Object.keys returns the object's own keys.
- **Line 5:** Blank line separates related sections for readability; it performs no operation.
- **Line 6:** Exports the validation function taking the parsed request body; braces open its body.
- **Line 7:** Rejects absent/null bodies, non-object values, or arrays. ! means not; || combines alternatives; Array.isArray distinguishes arrays from ordinary objects.
- **Line 8:** Returns an object with an error property, ending validation before any field access or write.
- **Line 9:** Closes the body-shape conditional.
- **Line 10:** Uses some and includes to detect any submitted key not present in the allowed-field array. The arrow callback tests each key.
- **Line 11:** Returns a safe unsupported-fields error rather than accepting client-supplied IDs or timestamps.
- **Line 12:** Closes the unsupported-field conditional.
- **Line 13:** Creates an empty normalized lesson object; const prevents replacing the binding but allows assigning its properties.
- **Line 14:** Iterates field/limit pairs from Object.entries. Array destructuring assigns each pair to field and limit.
- **Line 15:** Defaults omitted optional text to empty text, but leaves missing title undefined so it is rejected. === checks strict equality; && means both conditions; the ternary selects one of two values.

### Lines 16–30

```text
16 |     if (typeof value !== 'string' || value.length > limit) {
17 |       return { error: `${field} must be text with at most ${limit} characters.` };
18 |     }
19 |     lesson[field] = value.trim();
20 |   }
21 |   if (!lesson.title) return { error: 'Title is required and cannot be blank.' };
22 |   if (!disciplines.includes(body.discipline)) return { error: 'Choose a supported discipline.' };
23 |   lesson.discipline = body.discipline;
24 |   lesson.skill_level = body.skill_level === undefined ? 'Beginner' : body.skill_level;
25 |   if (!levels.includes(lesson.skill_level)) return { error: 'Choose Beginner, Intermediate, or Advanced.' };
26 |   lesson.duration_minutes = body.duration_minutes === undefined ? null : body.duration_minutes;
27 |   if (lesson.duration_minutes !== null && (!Number.isInteger(lesson.duration_minutes) || lesson.duration_minutes < 1 || lesson.duration_minutes > 1440)) {
28 |     return { error: 'Duration must be a whole number from 1 to 1440 minutes, or null.' };
29 |   }
30 |   return { lesson };
```

- **Line 16:** Rejects non-string input or text longer than its configured limit, before trimming. This prevents whitespace padding from bypassing limits.
- **Line 17:** Returns a template-string error that inserts the field name and length limit using dollar-sign/braces interpolation; both come from trusted configuration.
- **Line 18:** Closes the invalid-text conditional.
- **Line 19:** Stores the trimmed string under the current field name using bracket property access. trim removes surrounding JavaScript whitespace.
- **Line 20:** Closes the text-field loop.
- **Line 21:** Rejects a title that is empty after trimming; returning stops the function.
- **Line 22:** Requires discipline to exactly match one supported string. Missing, null, or unsupported values fail.
- **Line 23:** Copies the validated discipline into the normalized object.
- **Line 24:** Defaults only an omitted skill_level to Beginner. Explicit null is preserved temporarily so the next check rejects it.
- **Line 25:** Rejects skill levels not present in the allowed array, returning a useful message.
- **Line 26:** Defaults an omitted duration to null, representing an unspecified duration in SQLite; explicit values are retained for validation.
- **Line 27:** Allows null; otherwise requires an integer from 1 to 1440 inclusive. !== means strict not-equal, Number.isInteger rejects numeric strings and fractions, and parentheses group the invalid alternatives.
- **Line 28:** Returns a safe duration error message when the condition fails.
- **Line 29:** Closes the duration conditional.
- **Line 30:** Returns the normalized lesson using object-property shorthand, equivalent to a lesson key containing the lesson variable.

### Lines 31–31

```text
31 | }
```

- **Line 31:** Closes the validateLesson function.

## server/app.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\app.js`

Creates an Express app around the supplied SQLite connection. Query preparation happens once per app. Express catches synchronous route exceptions and passes them to the final error middleware.

### Lines 1–15

```text
1 | import express from 'express';
2 | import { validateLesson } from './validate-lesson.js';
3 |
4 | export function createApp(database) {
5 |   const app = express();
6 |   app.use(express.json({ limit: '32kb' }));
7 |   const list = database.prepare('SELECT * FROM lessons ORDER BY created_at DESC, id DESC');
8 |   const find = database.prepare('SELECT * FROM lessons WHERE id = ?');
9 |   const insert = database.prepare(`INSERT INTO lessons
10 |     (title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes)
11 |     VALUES (@title, @discipline, @skill_level, @duration_minutes, @goal, @drills, @coaching_notes)`);
12 |   const save = database.transaction(lesson => {
13 |     const result = insert.run(lesson);
14 |     return find.get(result.lastInsertRowid);
15 |   });
```

- **Line 1:** Imports Express from the existing installed package.
- **Line 2:** Imports the named input-validation function from its neighboring module.
- **Line 3:** Blank line separates related sections for readability; it performs no operation.
- **Line 4:** Exports createApp, which receives the already-open and migrated database rather than creating a second connection.
- **Line 5:** Creates an Express application object.
- **Line 6:** Registers JSON parsing with a 32 KB request-byte limit. Parser failures go to error middleware, before route validation or database writes.
- **Line 7:** Prepares a query that selects every lesson, newest timestamp first, using descending ID to break equal-time ties. ORDER BY is fixed SQL, not request input.
- **Line 8:** Prepares a single-row query with a ? placeholder for its ID; the ID is bound later with get.
- **Line 9:** Starts preparing a multiline INSERT template string targeting lessons.
- **Line 10:** Lists the seven writable columns. IDs and timestamps are omitted so SQLite generates them.
- **Line 11:** Lists named parameter placeholders, closes the SQL template string and prepare call. The @ names receive values from the normalized lesson object; input is never concatenated into SQL.
- **Line 12:** Creates a transaction function named save. Its arrow callback receives the normalized lesson and runs insertion and rereading together.
- **Line 13:** Binds the lesson object's fields to the prepared INSERT and executes it. The result contains lastInsertRowid.
- **Line 14:** Reads and returns the newly inserted full row using the bound generated ID. If this fails, the transaction rolls back the insert instead of leaving a saved row behind a failed response.
- **Line 15:** Closes the transaction callback and factory call. The transaction runs only when save is called by the POST route.

### Lines 16–30

```text
16 |
17 |   app.get('/api/health', (request, response) => {
18 |     response.json({ status: 'ok', service: 'CoachLab API' });
19 |   });
20 |   app.get('/api/lessons', (request, response) => {
21 |     response.json(list.all());
22 |   });
23 |   app.post('/api/lessons', (request, response) => {
24 |     if (!request.is('application/json')) return response.status(400).json({ error: 'Send Content-Type: application/json.' });
25 |     const result = validateLesson(request.body);
26 |     if (result.error) return response.status(400).json({ error: result.error });
27 |     response.status(201).json(save(result.lesson));
28 |   });
29 |   app.use((request, response) => {
30 |     response.status(404).json({ error: 'Route not found.' });
```

- **Line 16:** Blank line separates related sections for readability; it performs no operation.
- **Line 17:** Registers the existing GET health route with request/response callback parameters.
- **Line 18:** Returns the same health JSON as before, normally with HTTP 200.
- **Line 19:** Closes the health callback and route registration.
- **Line 20:** Registers GET /api/lessons.
- **Line 21:** Executes the prepared list query and sends the actual rows as JSON. all returns an empty array when no rows match; the default status is 200.
- **Line 22:** Closes the list callback and registration.
- **Line 23:** Registers POST /api/lessons.
- **Line 24:** Requires the JSON Content-Type. A wrong or missing type returns HTTP 400 and a safe error object immediately; it does not continue to save.
- **Line 25:** Validates request.body, which was populated by the JSON parser.
- **Line 26:** If validation returned an error, sends it with HTTP 400 and stops the handler before any SQL write.
- **Line 27:** Calls save and responds with HTTP 201 plus the saved row. JavaScript evaluates save before json is invoked; a thrown error is handled by Express rather than sending a false success response.
- **Line 28:** Closes the POST callback and registration.
- **Line 29:** Adds the fallback middleware for requests not answered by earlier routes.
- **Line 30:** Sends HTTP 404 with a short route-not-found JSON error.

### Lines 31–38

```text
31 |   });
32 |   app.use((error, request, response, next) => {
33 |     const status = [400, 413, 415].includes(error.status) ? error.status : 500;
34 |     const messages = { 400: 'Request body must contain valid JSON.', 413: 'JSON request must not exceed 32 KB.', 415: 'Unsupported request encoding.', 500: 'Unexpected server error.' };
35 |     response.status(status).json({ error: messages[status] });
36 |   });
37 |   return app;
38 | }
```

- **Line 31:** Closes the fallback callback and registration.
- **Line 32:** Registers Express error middleware. Its four parameters are required for Express to recognize it, even though request and next are unused here.
- **Line 33:** Preserves the listed request-parser HTTP error statuses; any other error, including SQLite failures, becomes 500. includes returns a Boolean and the ternary chooses a status.
- **Line 34:** Defines a fixed map of public messages for invalid JSON, excessive body size, unsupported encoding, and unexpected server errors. Internal exception messages are never copied into the response.
- **Line 35:** Sends the selected HTTP status and its safe JSON error message.
- **Line 36:** Closes the error callback and registration.
- **Line 37:** Returns the configured app to the caller, which can listen on a real port or a temporary test port.
- **Line 38:** Closes createApp.

## server/api.test.js

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\server\api.test.js`

Real HTTP tests using Node built-ins and the existing SQLite driver. Each top-level test owns an isolated external temporary database and local ephemeral port; cleanup closes resources and deletes only its bounded test directory.

### Lines 1–15

```text
1 | import test from 'node:test';
2 | import assert from 'node:assert/strict';
3 | import { once } from 'node:events';
4 | import { mkdtempSync, rmSync } from 'node:fs';
5 | import { tmpdir } from 'node:os';
6 | import path from 'node:path';
7 | import Database from 'better-sqlite3';
8 | import { createApp } from './app.js';
9 | import { migrate } from './migrations.js';
10 |
11 | async function fixture(t) {
12 |   const directory = mkdtempSync(path.join(tmpdir(), 'coachlab-api-'));
13 |   assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
14 |   assert.ok(path.basename(directory).startsWith('coachlab-api-'));
15 |   const state = { filename: path.join(directory, 'test.sqlite') };
```

- **Line 1:** Imports Node's built-in test function.
- **Line 2:** Imports strict assertion helpers that fail tests when results do not match expectations.
- **Line 3:** Imports once, which can await an EventEmitter event as a Promise and reject on an error event.
- **Line 4:** Imports temporary-directory creation and removal functions from Node's filesystem module.
- **Line 5:** Imports the operating system temporary-directory function.
- **Line 6:** Imports platform-aware path helpers.
- **Line 7:** Imports the existing SQLite driver to open isolated test files.
- **Line 8:** Imports the real Express app factory, so tests exercise actual routes rather than mocks.
- **Line 9:** Imports the real migration runner for test database setup.
- **Line 10:** Blank line separates related sections for readability; it performs no operation.
- **Line 11:** Declares an asynchronous fixture helper receiving the current test context t.
- **Line 12:** Creates a unique directory under the system temporary directory using a coachlab-api- prefix.
- **Line 13:** Checks that the resolved parent is exactly the intended temporary directory before cleanup can recursively remove anything.
- **Line 14:** Checks the generated basename starts with the intended test prefix.
- **Line 15:** Creates a state object containing the isolated database filename. Later properties hold its connection, server, and URL.

### Lines 16–30

```text
16 |   state.stop = async () => {
17 |     if (state.server?.listening) await new Promise(resolve => state.server.close(resolve));
18 |     if (state.database?.open) state.database.close();
19 |   };
20 |   t.after(async () => {
21 |     await state.stop();
22 |     rmSync(directory, { recursive: true, force: true });
23 |   });
24 |   state.start = async () => {
25 |     state.database = new Database(state.filename);
26 |     migrate(state.database);
27 |     state.server = createApp(state.database).listen(0, '127.0.0.1');
28 |     await once(state.server, 'listening');
29 |     state.url = `http://127.0.0.1:${state.server.address().port}`;
30 |   };
```

- **Line 16:** Assigns an asynchronous stop function to state.
- **Line 17:** If the server is listening, awaits a Promise resolved by the HTTP server's close callback. Optional chaining tolerates a server that was never created.
- **Line 18:** Closes the database only if a connection exists and remains open.
- **Line 19:** Closes the stop function assignment.
- **Line 20:** Registers asynchronous cleanup with t.after, so resources are cleaned even when a test assertion fails.
- **Line 21:** Waits for the shared stop helper to close the HTTP server and database.
- **Line 22:** Removes only the previously verified temporary directory and its files. recursive handles contents; force tolerates an already-absent directory.
- **Line 23:** Closes the cleanup callback and registration.
- **Line 24:** Assigns an asynchronous start function that can also reopen the same test file later.
- **Line 25:** Opens the test database file and stores the connection in state.
- **Line 26:** Applies the same migration system used by the normal server before app creation.
- **Line 27:** Constructs the real API app and listens on loopback port 0, asking the operating system to choose an unused port.
- **Line 28:** Waits until the server has actually started listening.
- **Line 29:** Builds the request URL from the assigned port, using template-string interpolation; no fixed development port is occupied.
- **Line 30:** Closes the start function assignment.

### Lines 31–45

```text
31 |   await state.start();
32 |   return state;
33 | }
34 |
35 | function post(state, body) {
36 |   return fetch(`${state.url}/api/lessons`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
37 | }
38 |
39 | test('GET starts empty and health remains available', async t => {
40 |   const state = await fixture(t);
41 |   const response = await fetch(`${state.url}/api/lessons`);
42 |   assert.equal(response.status, 200);
43 |   assert.deepEqual(await response.json(), []);
44 |   const health = await fetch(`${state.url}/api/health`);
45 |   assert.equal(health.status, 200);
```

- **Line 31:** Starts the initial test server and database.
- **Line 32:** Returns the fixture state to the test.
- **Line 33:** Closes the fixture helper.
- **Line 34:** Blank line separates related sections for readability; it performs no operation.
- **Line 35:** Declares a helper for making JSON POST requests to a fixture's API.
- **Line 36:** Calls fetch with POST, a JSON Content-Type header, and a body serialized by JSON.stringify. Template-string interpolation uses the fixture URL; the returned Promise is awaited by callers.
- **Line 37:** Closes the POST helper.
- **Line 38:** Blank line separates related sections for readability; it performs no operation.
- **Line 39:** Defines the empty-list and health test with an asynchronous callback receiving its context.
- **Line 40:** Creates the isolated server/database fixture for this test.
- **Line 41:** Requests the lessons endpoint using GET, the default fetch method.
- **Line 42:** Asserts the response status is 200.
- **Line 43:** Parses the response JSON and compares its contents to an empty array.
- **Line 44:** Requests the existing health endpoint.
- **Line 45:** Asserts the health response is HTTP 200.

### Lines 46–60

```text
46 |   assert.deepEqual(await health.json(), { status: 'ok', service: 'CoachLab API' });
47 | });
48 |
49 | test('POST saves actual SQLite data, GET orders it, and reopening preserves it', async t => {
50 |   const state = await fixture(t);
51 |   const input = { title: "  Coach's jab; DROP TABLE lessons; --  ", discipline: 'Boxing', skill_level: 'Intermediate', duration_minutes: 45, goal: 'Accuracy', drills: 'Practice jabs', coaching_notes: 'Keep guard up' };
52 |   const response = await post(state, input);
53 |   assert.equal(response.status, 201);
54 |   const saved = await response.json();
55 |   assert.ok(Number.isInteger(saved.id) && saved.id > 0);
56 |   assert.ok(Number.isFinite(Date.parse(saved.created_at)));
57 |   assert.deepEqual(saved, { ...input, title: input.title.trim(), id: saved.id, created_at: saved.created_at });
58 |   assert.deepEqual(state.database.prepare('SELECT * FROM lessons WHERE id = ?').get(saved.id), saved);
59 |   const secondResponse = await post(state, { title: 'Second lesson', discipline: 'MMA' });
60 |   assert.equal(secondResponse.status, 201);
```

- **Line 46:** Checks its complete JSON object, preserving the prior status and service values.
- **Line 47:** Closes the test callback and registration.
- **Line 48:** Blank line separates related sections for readability; it performs no operation.
- **Line 49:** Defines the creation, ordering, and reopen-persistence test.
- **Line 50:** Creates this test's independent fixture.
- **Line 51:** Defines fake lesson data with every writable field. Its title includes spaces, an apostrophe, and SQL-looking text to check trimming and parameter binding rather than executing input as SQL.
- **Line 52:** Sends that lesson to POST and waits for its response.
- **Line 53:** Requires HTTP 201 for successful creation.
- **Line 54:** Parses the saved lesson from the response body.
- **Line 55:** Requires a positive integer database-generated ID.
- **Line 56:** Requires a creation date that parses to a finite timestamp.
- **Line 57:** Compares all returned fields to the input with a trimmed title plus generated metadata. Spread syntax copies the input, then later properties replace or add fields.
- **Line 58:** Reads the actual SQLite row using a parameterized ID query and checks it exactly equals the API response; this verifies real storage, not just echoed input.
- **Line 59:** Posts a second minimal fake lesson to test defaults and ordering.
- **Line 60:** Requires HTTP 201 for that creation too.

### Lines 61–75

```text
61 |   const second = await secondResponse.json();
62 |   assert.equal(second.skill_level, 'Beginner');
63 |   assert.equal(second.duration_minutes, null);
64 |   assert.equal(second.goal, '');
65 |   const expected = [second, saved];
66 |   assert.deepEqual(await (await fetch(`${state.url}/api/lessons`)).json(), expected);
67 |   await state.stop();
68 |   await state.start();
69 |   assert.deepEqual(await (await fetch(`${state.url}/api/lessons`)).json(), expected);
70 |   assert.equal(state.database.prepare('SELECT count(*) AS count FROM lessons').get().count, 2);
71 | });
72 |
73 | test('invalid lesson inputs return 400 without saving records', async t => {
74 |   const state = await fixture(t);
75 |   const invalid = [{}, { title: '' }, { title: ' \t\n' }, { title: 42 }, { discipline: 'Unknown' }, { discipline: null }, { skill_level: 'Expert' }, { skill_level: null }, { duration_minutes: -1 }, { duration_minutes: 0 }, { duration_minutes: 1.5 }, { duration_minutes: '45' }, { duration_minutes: 1441 }, { goal: null }, { drills: [] }, { coaching_notes: {} }, { id: 123 }];
```

- **Line 61:** Parses the second saved lesson.
- **Line 62:** Checks its omitted skill level defaulted to Beginner.
- **Line 63:** Checks its omitted duration defaulted to null.
- **Line 64:** Checks its omitted goal defaulted to empty text.
- **Line 65:** Creates the expected newest-first array of the two saved rows.
- **Line 66:** Fetches and parses GET results, then compares the full ordered array to expected.
- **Line 67:** Closes the server and its SQLite connection.
- **Line 68:** Reopens the same file and starts a new server/app using the fixture's start helper.
- **Line 69:** Checks that GET still returns exactly the saved ordered records after reopening.
- **Line 70:** Counts actual database rows and requires exactly two; no duplicates were created during migration rerun or restart.
- **Line 71:** Closes the persistence test callback and registration.
- **Line 72:** Blank line separates related sections for readability; it performs no operation.
- **Line 73:** Defines a parent test for rejected lesson inputs and zero saved rows.
- **Line 74:** Creates its isolated fixture.
- **Line 75:** Defines invalid patches covering missing/empty/whitespace/numeric title, unsupported/null discipline, invalid/null skill, negative/zero/fractional/string/too-large duration, null or wrong-type optional text, and a forbidden ID field.

### Lines 76–90

```text
76 |   for (const [index, fields] of invalid.entries()) {
77 |     await t.test(`invalid case ${index + 1}`, async () => {
78 |       const base = index === 0 ? {} : { title: 'Valid', discipline: 'Boxing' };
79 |       const response = await post(state, { ...base, ...fields });
80 |       assert.equal(response.status, 400);
81 |       assert.equal(typeof (await response.json()).error, 'string');
82 |     });
83 |   }
84 |   for (const [field, limit] of Object.entries({ title: 200, goal: 2000, drills: 10000, coaching_notes: 10000 })) {
85 |     const response = await post(state, { title: 'Valid', discipline: 'Boxing', [field]: 'x'.repeat(limit + 1) });
86 |     assert.equal(response.status, 400);
87 |     await response.json();
88 |   }
89 |   assert.equal(state.database.prepare('SELECT count(*) AS count FROM lessons').get().count, 0);
90 | });
```

- **Line 76:** Iterates each invalid patch with its array index using destructuring of entries().
- **Line 77:** Creates and awaits a named subtest for the current invalid case, with a human-readable one-based number.
- **Line 78:** Uses an empty base for the missing-fields case; other cases start from a valid title and discipline so each patch isolates an invalid field.
- **Line 79:** Merges base and invalid patch with spread syntax and sends the resulting JSON body.
- **Line 80:** Requires HTTP 400.
- **Line 81:** Requires the returned error property to be a string without requiring unstable exact wording.
- **Line 82:** Closes the subtest callback and call.
- **Line 83:** Closes the invalid-patch loop.
- **Line 84:** Iterates every configured text-field limit to exercise an over-limit value independently.
- **Line 85:** Sends a valid base lesson overridden with a string one unit longer than the field's limit. The computed [field] property chooses which field to replace; repeat generates the string.
- **Line 86:** Requires HTTP 400 for the excessive field length.
- **Line 87:** Consumes the JSON response body before the next request.
- **Line 88:** Closes the field-limit loop.
- **Line 89:** Checks the database still has zero lessons after every invalid submission.
- **Line 90:** Closes the validation test callback and registration.

### Lines 91–105

```text
91 |
92 | test('malformed JSON, non-object bodies, wrong media type, and oversized bodies fail safely', async t => {
93 |   const state = await fixture(t);
94 |   for (const [body, contentType, status] of [['{broken', 'application/json', 400], ['null', 'application/json', 400], ['[]', 'application/json', 400], ['42', 'application/json', 400], ['{}', 'text/plain', 400], [JSON.stringify({ title: 'x'.repeat(40000) }), 'application/json', 413]]) {
95 |     const response = await fetch(`${state.url}/api/lessons`, { method: 'POST', headers: { 'Content-Type': contentType }, body });
96 |     assert.equal(response.status, status);
97 |     const data = await response.json();
98 |     assert.deepEqual(Object.keys(data), ['error']);
99 |     assert.ok(!/SyntaxError|stack|node_modules|SQLITE/.test(data.error));
100 |   }
101 |   assert.equal(state.database.prepare('SELECT count(*) AS count FROM lessons').get().count, 0);
102 | });
103 |
104 | test('database failures return generic 500 errors for both routes', async t => {
105 |   const state = await fixture(t);
```

- **Line 91:** Blank line separates related sections for readability; it performs no operation.
- **Line 92:** Defines HTTP parser and body-limit checks with safe public errors.
- **Line 93:** Creates an isolated fixture.
- **Line 94:** Iterates raw body/media-type/expected-status triples: broken JSON, null, array, scalar, wrong media type, and a JSON body above 32 KB. The oversized body is valid JSON so it tests size handling.
- **Line 95:** Sends each raw body with its specified Content-Type, bypassing the JSON POST helper to allow malformed inputs.
- **Line 96:** Checks the expected 400 or 413 status.
- **Line 97:** Parses the safe JSON response.
- **Line 98:** Requires that the only returned key is error, so no stack or internal detail properties are present.
- **Line 99:** Rejects common internal error/stack/SQL markers in the public message using a regular expression.
- **Line 100:** Closes the malformed/oversized body loop.
- **Line 101:** Confirms no rejected request inserted a database record.
- **Line 102:** Closes the parser/security test callback and registration.
- **Line 103:** Blank line separates related sections for readability; it performs no operation.
- **Line 104:** Defines safe handling of unexpected database failures for both routes.
- **Line 105:** Creates a functioning fixture first, so its statements and routes are prepared normally.

### Lines 106–120

```text
106 |   state.database.close();
107 |   for (const response of [await fetch(`${state.url}/api/lessons`), await post(state, { title: 'Valid', discipline: 'Boxing' })]) {
108 |     assert.equal(response.status, 500);
109 |     assert.deepEqual(await response.json(), { error: 'Unexpected server error.' });
110 |   }
111 | });
112 |
113 | test('fresh database is migrated before app creation without changing the schema', async t => {
114 |   const state = await fixture(t);
115 |   assert.deepEqual(state.database.prepare('SELECT version FROM schema_migrations').all(), [{ version: 1 }]);
116 |   assert.equal(state.database.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
117 |   const unknown = await fetch(`${state.url}/missing`);
118 |   assert.equal(unknown.status, 404);
119 |   assert.deepEqual(await unknown.json(), { error: 'Route not found.' });
120 | });
```

- **Line 106:** Closes SQLite deliberately inside this isolated test to simulate an unavailable database without modifying production code.
- **Line 107:** Sends GET and a valid POST against the still-running app and iterates the two responses.
- **Line 108:** Requires HTTP 500 for each database failure.
- **Line 109:** Requires exactly the generic public error object; closed-connection details are not exposed.
- **Line 110:** Closes the response loop.
- **Line 111:** Closes the database-failure test callback and registration.
- **Line 112:** Blank line separates related sections for readability; it performs no operation.
- **Line 113:** Defines a fresh-file migration and unknown-route test.
- **Line 114:** Creates a fixture, which migrates its new empty file before app creation.
- **Line 115:** Requires exactly one applied migration record for version 1.
- **Line 116:** Requires SQLite's integrity check to return ok.
- **Line 117:** Requests an unknown route.
- **Line 118:** Requires HTTP 404.
- **Line 119:** Requires the existing safe route-not-found JSON message.
- **Line 120:** Closes the final test callback and registration.

## client/src/LessonForm.jsx

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\src\LessonForm.jsx`

The form owns editable values and POST status. Native browser constraints match the API field limits; the backend remains authoritative. It calls App callbacks through props and never writes SQLite directly. A ref locks submission immediately, while state updates render disabled controls.

### Lines 1–15

```text
1 | import React, { useRef, useState } from 'react';
2 |
3 | const disciplines = ['Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training'];
4 | const initial = { title: '', discipline: '', skill_level: 'Beginner', duration_minutes: '', goal: '', drills: '', coaching_notes: '' };
5 | const textFields = [['goal', 'Training goal', 2000], ['drills', 'Drills / instructions', 10000], ['coaching_notes', 'Coaching notes', 10000]];
6 |
7 | export default function LessonForm({ onSaved, onCancel }) {
8 |   const [values, setValues] = useState(initial);
9 |   const [saving, setSaving] = useState(false);
10 |   const [error, setError] = useState('');
11 |   const submitting = useRef(false);
12 |
13 |   function change(event) {
14 |     const { name, value } = event.target;
15 |     setValues(current => ({ ...current, [name]: value }));
```

- **Line 1:** Imports React plus useRef for a persistent immediate lock and useState for renderable values.
- **Line 2:** Blank line separates related sections for readability; it performs no operation.
- **Line 3:** Defines the six exact discipline strings accepted by the backend; brackets form an array.
- **Line 4:** Defines initial controlled field values; optional text starts empty, skill starts Beginner, and duration starts as an empty input string.
- **Line 5:** Defines nested arrays containing each optional textarea's API field name, visible label, and maximum UTF-16 length.
- **Line 6:** Blank line separates related sections for readability; it performs no operation.
- **Line 7:** Exports the component; parameter destructuring extracts onSaved and onCancel function props supplied by App.
- **Line 8:** Initializes editable form state and its setter from the initial object.
- **Line 9:** Initializes the saving flag to false.
- **Line 10:** Initializes the form error message to empty text.
- **Line 11:** Creates a ref with current=false; unlike state, setting current is immediate and does not cause rendering.
- **Line 12:** Blank line separates related sections for readability; it performs no operation.
- **Line 13:** Begins the shared input-change handler with the browser/React event parameter.
- **Line 14:** Destructures the changed control's name and string value from event.target.
- **Line 15:** Updates state from its latest value. Object spread copies other fields; computed property syntax [name] replaces just this control's field. Parentheses make the arrow return an object literal.

### Lines 16–30

```text
16 |   }
17 |
18 |   async function submit(event) {
19 |     event.preventDefault();
20 |     if (submitting.current) return;
21 |     setError('');
22 |     if (!values.title.trim()) { setError('Enter a lesson title that is not blank.'); return; }
23 |     submitting.current = true;
24 |     setSaving(true);
25 |     try {
26 |       const body = { ...values, duration_minutes: values.duration_minutes === '' ? null : Number(values.duration_minutes) };
27 |       const response = await fetch('/api/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
28 |       const data = await response.json();
29 |       if (response.status !== 201) throw new Error(data.error || 'The server could not save this lesson.');
30 |       if (!Number.isInteger(data.id)) throw new Error('The server did not confirm the saved lesson.');
```

- **Line 16:** Closes the change handler.
- **Line 17:** Blank line separates related sections for readability; it performs no operation.
- **Line 18:** Declares the async form-submit handler.
- **Line 19:** Prevents ordinary browser form navigation so React can perform the request.
- **Line 20:** Returns immediately when another submission is in flight; this lock also protects the gap before disabled controls render.
- **Line 21:** Clears any earlier error for this save attempt.
- **Line 22:** Trims the title to test for whitespace-only input, displays a useful error and returns before sending if blank; native required alone would accept spaces.
- **Line 23:** Locks submission synchronously.
- **Line 24:** Sets saving state so controls disable and progress feedback renders.
- **Line 25:** Starts a try block around request/parsing/confirmation.
- **Line 26:** Copies the form object but converts duration: empty string becomes null, otherwise Number produces the number required by the API. The ternary chooses between these cases.
- **Line 27:** Sends POST to the relative API URL with JSON content type; JSON.stringify converts the body object to a JSON string and await waits for HTTP response headers.
- **Line 28:** Parses the response body as JSON, awaiting completion.
- **Line 29:** Requires the API's exact success status 201; otherwise throws the returned error or a fallback. || chooses the fallback when data.error is absent/empty.
- **Line 30:** Requires an integer returned ID before treating the lesson as confirmed.

### Lines 31–45

```text
31 |       onSaved(data);
32 |     } catch (failure) {
33 |       setError(failure instanceof TypeError || failure instanceof SyntaxError ? 'Could not confirm the save. Check the connection. If it was interrupted, reload and check your lessons before retrying; your input is still here.' : failure.message);
34 |     } finally {
35 |       submitting.current = false;
36 |       setSaving(false);
37 |     }
38 |   }
39 |
40 |   return (
41 |     <section className="form-panel" aria-labelledby="new-heading">
42 |       <h2 id="new-heading">New lesson plan</h2>
43 |       <p>Title and discipline are required. Add the details that help you coach.</p>
44 |       <form onSubmit={submit}>
45 |         <fieldset disabled={saving}>
```

- **Line 31:** Calls the parent's callback with the actual returned record; App adds it and unmounts this form.
- **Line 32:** Closes try and catches request or response failures.
- **Line 33:** For network TypeError or parsing SyntaxError, explains uncertainty and advises checking saved lessons before retrying; otherwise shows the error message, including safe backend validation errors. No setter clears values, so input is retained.
- **Line 34:** Begins finally, which always executes after the attempt.
- **Line 35:** Releases the immediate lock.
- **Line 36:** Ends saving state, re-enabling the form after errors; after success the form has been unmounted.
- **Line 37:** Closes finally.
- **Line 38:** Closes submit.
- **Line 39:** Blank line separates related sections for readability; it performs no operation.
- **Line 40:** Begins returning the JSX form tree.
- **Line 41:** Opens a styled section and connects its accessible name to new-heading.
- **Line 42:** Adds the heading with the ID referenced above.
- **Line 43:** Explains required fields in a paragraph.
- **Line 44:** Opens a form and binds submit to its submit event; native constraints run before this handler.
- **Line 45:** Opens a fieldset that disables its descendant controls while saving, including Cancel.

### Lines 46–60

```text
46 |           <legend className="sr-only">Lesson details</legend>
47 |           <label>Lesson title<input autoFocus name="title" required maxLength={200} value={values.title} onChange={change} /></label>
48 |           <div className="form-row">
49 |             <label>Discipline<select name="discipline" required value={values.discipline} onChange={change}><option value="">Choose a discipline</option>{disciplines.map(name => <option key={name}>{name}</option>)}</select></label>
50 |             <label>Skill level<select name="skill_level" value={values.skill_level} onChange={change}>{['Beginner', 'Intermediate', 'Advanced'].map(level => <option key={level}>{level}</option>)}</select></label>
51 |             <label>Duration (minutes)<input name="duration_minutes" type="number" min="1" max="1440" step="1" value={values.duration_minutes} onChange={change} /><small>Optional · 1–1440 minutes</small></label>
52 |           </div>
53 |           {textFields.map(([name, label, limit]) => <label key={name}>{label}<textarea name={name} rows="3" maxLength={limit} value={values[name]} onChange={change} /><small>Optional · up to {limit.toLocaleString()} characters</small></label>)}
54 |           <div className="actions"><button type="submit">{saving ? 'Saving…' : 'Save lesson'}</button><button className="secondary" type="button" onClick={onCancel}>Cancel</button></div>
55 |         </fieldset>
56 |         {saving && <p role="status">Saving your lesson…</p>}
57 |         {error && <p className="error" role="alert">{error}</p>}
58 |       </form>
59 |     </section>
60 |   );
```

- **Line 46:** Provides an accessible field-group label; sr-only hides it visually without removing it from assistive technology.
- **Line 47:** Wraps a text input in its label. autoFocus focuses it on mount; name selects the state key; required and maxLength enforce title constraints. value and onChange make it controlled; the slash closes input and the closing label ends its wrapper.
- **Line 48:** Opens the responsive row for the three compact controls.
- **Line 49:** Creates a labeled required controlled select. The empty-valued placeholder is invalid; map renders one option per discipline, key gives stable identity, and the option text also becomes its value. Closing tags end select and label.
- **Line 50:** Creates the controlled skill select with Beginner, Intermediate and Advanced options; map and key create stable option elements, and the initial state supplies the default.
- **Line 51:** Creates an optional controlled numeric input with minimum 1, maximum 1440 and integer step 1. Empty is allowed because required is absent. A small element explains the range.
- **Line 52:** Closes the responsive row.
- **Line 53:** Maps metadata triples into labeled textareas. Array destructuring names each item; rows sets initial height, maxLength enforces its limit, values[name] reads dynamic state, and change handles edits. The small element formats the limit with locale grouping; closing tags and parentheses end each mapped label and the map expression.
- **Line 54:** Groups Save and Cancel buttons. Save submits and changes text while saving using a ternary; Cancel has type=button so it only calls onCancel. Closing tags end both buttons and their wrapper.
- **Line 55:** Closes the fieldset.
- **Line 56:** Conditionally displays an accessible saving status via &&.
- **Line 57:** Conditionally displays the error inside an alert paragraph; React renders the message as text rather than HTML.
- **Line 58:** Closes the form.
- **Line 59:** Closes the section.
- **Line 60:** Closes the JSX return expression and statement.

### Lines 61–61

```text
61 | }
```

- **Line 61:** Closes the component function.

## client/src/LessonCard.jsx

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\src\LessonCard.jsx`

A reusable read-only card receives a saved API row through its lesson prop. It renders all requested details and uses the shared stylesheet; it owns no state and performs no requests.

### Lines 1–15

```text
1 | import React from 'react';
2 |
3 | export default function LessonCard({ lesson }) {
4 |   return (
5 |     <article className="lesson-card">
6 |       <span className="discipline">{lesson.discipline}</span>
7 |       <h3>{lesson.title}</h3>
8 |       <p className="metadata">{lesson.skill_level} · {lesson.duration_minutes === null ? 'Duration not set' : `${lesson.duration_minutes} min`}</p>
9 |       <dl>
10 |         <dt>Training goal</dt><dd>{lesson.goal || 'Not added'}</dd>
11 |         <dt>Drills / instructions</dt><dd>{lesson.drills || 'Not added'}</dd>
12 |         <dt>Coaching notes</dt><dd>{lesson.coaching_notes || 'Not added'}</dd>
13 |       </dl>
14 |       <footer>Created <time dateTime={lesson.created_at}>{new Date(lesson.created_at).toLocaleString()}</time></footer>
15 |     </article>
```

- **Line 1:** Imports React for the JSX transformation.
- **Line 2:** Blank line separates related sections for readability; it performs no operation.
- **Line 3:** Exports the component; object destructuring extracts lesson from its props.
- **Line 4:** Begins returning a parenthesized JSX tree.
- **Line 5:** Opens a semantic article and assigns its CSS class.
- **Line 6:** Displays the discipline in a styled span; braces evaluate the row property and the closing tag ends the span.
- **Line 7:** Displays the lesson title in a third-level heading.
- **Line 8:** Displays skill and duration in a paragraph. Strict equality checks for null; the ternary chooses fallback text or a template string with the number and min suffix.
- **Line 9:** Opens a definition list pairing detail labels with values.
- **Line 10:** Adds a dt label and dd goal value; || displays Not added for an empty string. Both tags close on this line.
- **Line 11:** Adds the drills term and description, with the same empty-value fallback.
- **Line 12:** Adds coaching notes and their empty-value fallback.
- **Line 13:** Closes the definition list.
- **Line 14:** Adds a footer with a time element. dateTime preserves the machine-readable timestamp; new Date parses it and toLocaleString displays the reader's local date/time. Closing tags end time and footer.
- **Line 15:** Closes the article.

### Lines 16–17

```text
16 |   );
17 | }
```

- **Line 16:** Closes the return expression and statement.
- **Line 17:** Closes the LessonCard function.

## SQL migrations and excluded files

Version 1 SQL and the migration runner are now documented above. The migration command creates the external SQLite file, applies pending versions, and closes it. Express now serves health plus create/read lesson endpoints, using one connection and the unchanged version-1 schema. It applies pending migrations before listening. Phase 5 now provides the React create/read interface. Phase 6 requires separate approval.

package-lock.json is generated dependency metadata and is excluded from individual line explanations as requested. node_modules and client/dist are generated and excluded. README.md, PROMPT_LOG.md, this walkthrough, and AGENTS.md are prose documentation rather than application source.

## Verification and maintenance

This snapshot covers 20 source/configuration files and 612 lines. Numbered code was read directly from the files, and coverage checks compare each numbered line and its explanation entry to the actual file. Explanations were reviewed against those lines. After any source change, update both the code listing and its explanations before committing. Never treat these line numbers as valid for a later version without rechecking.
