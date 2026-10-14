# CoachLab code walkthrough

Verified source snapshot: 2026-10-14, Phase 4 source in the commit containing this walkthrough. Prior application baseline: c56967a; prior documentation milestone: b060b76.

Every line, including blank lines and closing delimiters, is listed below. Numbered code blocks are for reading; remove line-number prefixes before copying code. Paths are exact repository-relative paths, with the current absolute workspace path given for each file.

## How the pieces connect

Browser → Vite serves index.html → main.jsx renders App → App fetches /api/health → Vite forwards to Express → Express returns JSON → App updates its status text. CSS styles the HTML produced by React. Node reads optional .env configuration and validates the future SQLite path before Express listens. The React welcome screen still only checks health. Separately, POST /api/lessons parses and validates JSON, binds it to SQL, saves and rereads a row, then returns 201. GET /api/lessons reads ordered SQLite rows and returns JSON. The API is ready for a future lesson interface. Separately, npm run db:migrate runs migrate.js → database.js opens the external SQLite file → migrations.js applies the SQL and records its version → migrate.js closes the connection.

## Reading the syntax

JavaScript executes application logic. JSX is HTML-like syntax inside JavaScript that Vite converts into React calls. A component is a function that returns UI; state remembers values between renders; an effect synchronizes with something outside rendering, such as a network request. Props are inputs passed to components, although App currently receives none. HTML attributes configure elements. JSON is a data format, not executable JavaScript. CSS controls appearance. Parentheses group expressions or pass function arguments; braces can delimit code blocks, objects, imports, or JSX expressions depending on context.

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

The React screen. It requests /api/health through Vite and stores the result in state; no lesson or database operation happens here.

### Lines 1–15

```text
1 | import React, { useEffect, useState } from 'react';
2 |
3 | export default function App() {
4 |   const [status, setStatus] = useState('Checking backend connection…');
5 |
6 |   useEffect(() => {
7 |     const controller = new AbortController();
8 |     async function checkBackend() {
9 |       try {
10 |         const response = await fetch('/api/health', { signal: controller.signal });
11 |         if (!response.ok) throw new Error('Backend health check failed');
12 |         const data = await response.json();
13 |         if (data.status !== 'ok') throw new Error('Unexpected backend response');
14 |         setStatus('Backend connected.');
15 |       } catch (error) {
```

- **Line 1:** Imports React plus the named useEffect and useState functions. Braces select named exports; quotes name the package.
- **Line 2:** Blank line separates related sections for readability; it performs no operation.
- **Line 3:** Declares and exports the default App function. React calls this component to obtain its screen; { opens the function body.
- **Line 4:** Creates state with an initial loading message. Array destructuring puts the value in status and its update function in setStatus; const prevents reassignment of these bindings.
- **Line 5:** Blank line separates related sections for readability; it performs no operation.
- **Line 6:** Registers an effect callback with useEffect. The arrow () =&gt; defines a function without arguments; { opens its body. Effects run after rendering.
- **Line 7:** Creates an AbortController with new; its signal lets us cancel an outstanding network request when the component is removed.
- **Line 8:** Declares the asynchronous checkBackend function. async permits await inside; { opens the function body.
- **Line 9:** Opens a try block so failures from the following operations can be handled by catch.
- **Line 10:** Calls fetch with the relative API URL and an options object containing the cancellation signal. await waits for the response; const stores it. This sends a GET request by default.
- **Line 11:** Checks response.ok. The ! means not; a non-success HTTP status throws a new Error and transfers control to catch. Parentheses enclose the condition and Error argument.
- **Line 12:** Waits for response.json() to parse the response body as a JavaScript value and stores it in data.
- **Line 13:** Uses !== (strict not equal) to reject any status other than the string ok. This also throws an Error if the check fails.
- **Line 14:** Updates state to the success message; React rerenders the displayed status.
- **Line 15:** Closes try and opens catch. Its error parameter receives the thrown exception or rejected asynchronous operation.

### Lines 16–30

```text
16 |         if (error.name !== 'AbortError') {
17 |           setStatus('Cannot reach the backend. Start the Express server, then refresh.');
18 |         }
19 |       }
20 |     }
21 |     checkBackend();
22 |     return () => controller.abort();
23 |   }, []);
24 |
25 |   return (
26 |     <main>
27 |       <p className="eyebrow">YOUR COACHING WORKSPACE</p>
28 |       <h1>CoachLab</h1>
29 |       <p>A place to build and organize your lesson plans.</p>
30 |       <section aria-labelledby="setup-heading">
```

- **Line 16:** Checks that the failure was not cancellation. AbortError is expected when the effect cleans up, so we avoid displaying that as a connection problem.
- **Line 17:** Updates state with actionable connection-failure text for the user.
- **Line 18:** Closes the if block inside catch.
- **Line 19:** Closes the catch block.
- **Line 20:** Closes the checkBackend function definition.
- **Line 21:** Calls checkBackend to start the asynchronous health request. Declaring a function alone would not run it.
- **Line 22:** Returns a cleanup arrow function from the effect. React calls it on cleanup, and abort() cancels the request.
- **Line 23:** Closes the effect callback and calls useEffect with an empty dependency array []. With this setup the effect runs when App mounts, rather than on every state change. The semicolon ends the call.
- **Line 24:** Blank line separates related sections for readability; it performs no operation.
- **Line 25:** Starts returning the component's JSX; parentheses let the expression span several lines.
- **Line 26:** Opens the main semantic page-content element.
- **Line 27:** Creates a paragraph with CSS class eyebrow and visible heading text. JSX uses className instead of HTML's class attribute; &lt;/p&gt; closes it.
- **Line 28:** Creates the main h1 heading and closes it after CoachLab.
- **Line 29:** Creates and closes a paragraph describing the workspace.
- **Line 30:** Opens a section whose accessible label is the element with ID setup-heading; aria-labelledby connects the two elements.

### Lines 31–37

```text
31 |         <h2 id="setup-heading">Getting started</h2>
32 |         <p role="status">{status}</p>
33 |         <p>Lesson planning will be added in a later project phase.</p>
34 |       </section>
35 |     </main>
36 |   );
37 | }
```

- **Line 31:** Creates an h2 with the matching ID so it labels the section, then closes it.
- **Line 32:** Creates a live status paragraph. Curly braces insert the JavaScript status value into JSX; role="status" helps assistive technology announce changes. &lt;/p&gt; closes it.
- **Line 33:** Creates and closes a paragraph stating that lesson planning is a later feature.
- **Line 34:** Closes the section opened above.
- **Line 35:** Closes main.
- **Line 36:** Closes the parenthesized JSX return expression and ends the return statement.
- **Line 37:** Closes the App function.

## client/src/styles.css

Exact path: `C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab\client\src\styles.css`

Global presentation rules imported by main.jsx. Selectors choose HTML elements or classes; braces hold declarations, colons separate property/value, and semicolons separate declarations.

### Lines 1–13

```text
1 | :root {
2 |   font-family: system-ui, sans-serif;
3 |   color: #172d3a;
4 |   background: #f3f6f7;
5 |   line-height: 1.6;
6 | }
7 | * { box-sizing: border-box; }
8 | body { margin: 0; }
9 | main { max-width: 900px; margin: 0 auto; padding: 64px 24px; }
10 | h1 { font-size: clamp(2.5rem, 7vw, 4rem); margin: 0; line-height: 1.2; }
11 | h2 { margin-top: 0; }
12 | .eyebrow { color: #22665e; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.12em; }
13 | section { margin-top: 32px; padding: 24px; background: white; border: 1px solid #d7e0e4; border-radius: 12px; }
```

- **Line 1:** Targets :root, the document's root element, and opens its declaration block. These text settings are inherited by descendants unless overridden.
- **Line 2:** Uses the operating system UI font, falling back to any sans-serif font.
- **Line 3:** Sets inherited text color to the dark hexadecimal RGB color #172d3a.
- **Line 4:** Sets the page background to the pale hexadecimal color #f3f6f7.
- **Line 5:** Sets line height to 1.6 times each element's font size for readable text.
- **Line 6:** Closes the :root rule.
- **Line 7:** The universal selector * matches every element. box-sizing: border-box makes declared dimensions include padding and borders. Braces open and close this one-line rule.
- **Line 8:** Targets body and removes its default outer spacing with margin: 0; braces enclose the rule.
- **Line 9:** Limits main to 900 pixels, centers it with zero vertical and automatic horizontal margins, and adds inner padding of 64 pixels vertically and 24 horizontally. Braces enclose all three declarations.
- **Line 10:** Sets h1 size with clamp: at least 2.5rem, preferably 7vw (7% of viewport width), at most 4rem. rem uses the root font size. Removes margins and sets line height to 1.2 times the heading size; braces close the rule.
- **Line 11:** Removes the top outer margin on h2; the braces enclose its declaration.
- **Line 12:** The dot selects class eyebrow. Sets teal color, size 0.8 times root font size, bold weight 700, and character spacing 0.12 times this element's font size (em). Braces enclose these declarations.
- **Line 13:** Styles section with 32-pixel top margin, 24-pixel inner padding, white background, a 1-pixel solid pale border, and 12-pixel rounded corners. Braces close the rule.

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

## SQL migrations and excluded files

Version 1 SQL and the migration runner are now documented above. The migration command creates the external SQLite file, applies pending versions, and closes it. Express now serves health plus create/read lesson endpoints, using one connection and the unchanged version-1 schema. It applies pending migrations before listening. Phase 5 requires separate approval.

package-lock.json is generated dependency metadata and is excluded from individual line explanations as requested. node_modules and client/dist are generated and excluded. README.md, PROMPT_LOG.md, this walkthrough, and AGENTS.md are prose documentation rather than application source.

## Verification and maintenance

This snapshot covers 18 source/configuration files and 480 lines. Numbered code was read directly from the files, and coverage checks compare each numbered line and its explanation entry to the actual file. Explanations were reviewed against those lines. After any source change, update both the code listing and its explanations before committing. Never treat these line numbers as valid for a later version without rechecking.
