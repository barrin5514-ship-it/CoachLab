# CoachLab code walkthrough

Verified source snapshot: 2026-10-14, application commit c56967a. Documentation-only changes do not change this source snapshot.

Every line, including blank lines and closing delimiters, is listed below. Numbered code blocks are for reading; remove line-number prefixes before copying code. Paths are exact repository-relative paths, with the current absolute workspace path given for each file.

## How the pieces connect

Browser → Vite serves index.html → main.jsx renders App → App fetches /api/health → Vite forwards to Express → Express returns JSON → App updates its status text. CSS styles the HTML produced by React. Node reads optional .env configuration and validates the future SQLite path before Express listens. There is no database call in this flow yet.

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

Executed when server/index.js imports it. It exports a path for future database code, but does not create a file, directory, connection, or migration.

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

The backend entry point run by Node. Express serves health JSON and error responses. There are no lesson routes or database queries yet.

### Lines 1–15

```text
1 | import express from 'express';
2 | import './config.js';
3 |
4 | const app = express();
5 | app.use(express.json());
6 |
7 | app.get('/api/health', (request, response) => {
8 |   response.json({ status: 'ok', service: 'CoachLab API' });
9 | });
10 |
11 | app.use((request, response) => {
12 |   response.status(404).json({ error: 'Route not found.' });
13 | });
14 |
15 | app.use((error, request, response, next) => {
```

- **Line 1:** Imports the default Express function from the installed express package.
- **Line 2:** Runs config.js for its side effects, including path validation; it does not import a named value or open SQLite.
- **Line 3:** Blank line separates related sections for readability; it performs no operation.
- **Line 4:** Calls express() to create the application and stores it in the constant app.
- **Line 5:** Registers JSON-body parsing middleware with app.use. Middleware handles requests in registration order and makes valid parsed JSON available to later handlers.
- **Line 6:** Blank line separates related sections for readability; it performs no operation.
- **Line 7:** Registers a GET route for /api/health. Its arrow callback receives request and response objects; { opens the callback body. request is currently unused.
- **Line 8:** Sends a JSON object with status and service keys. response.json serializes the object and ends the successful response, normally with HTTP 200.
- **Line 9:** Closes the callback and app.get call, then ends the statement.
- **Line 10:** Blank line separates related sections for readability; it performs no operation.
- **Line 11:** Registers middleware without a path restriction to handle requests not answered by earlier routes.
- **Line 12:** Sets HTTP status 404 and sends a JSON error message; the dot chains two response methods.
- **Line 13:** Closes the fallback callback and app.use call.
- **Line 14:** Blank line separates related sections for readability; it performs no operation.
- **Line 15:** Registers error-handling middleware. Express recognizes its four parameters, including the unused next parameter. error carries the failure; request and response describe the HTTP exchange.

### Lines 16–27

```text
16 |   const status = error.status === 400 ? 400 : 500;
17 |   response.status(status).json({
18 |     error: status === 400 ? 'Request body must contain valid JSON.' : 'Unexpected server error.',
19 |   });
20 | });
21 |
22 | app.listen(3001, '127.0.0.1', () => {
23 |   console.log('CoachLab API listening at http://127.0.0.1:3001');
24 | }).on('error', () => {
25 |   console.error('Could not start CoachLab API. Check whether port 3001 is already in use.');
26 |   process.exitCode = 1;
27 | });
```

- **Line 16:** Uses strict equality === and the ternary condition ? value : alternative to keep status 400 for bad input and use 500 for everything else. This simple handler also maps other error statuses, such as a body-size error, to 500.
- **Line 17:** Sets the chosen status and opens the JSON response object.
- **Line 18:** Selects a valid-JSON instruction for 400 and a generic server message otherwise. The trailing comma ends the object property; it does not expose the internal error.
- **Line 19:** Closes the response object and json call.
- **Line 20:** Closes the error middleware callback and app.use call.
- **Line 21:** Blank line separates related sections for readability; it performs no operation.
- **Line 22:** Starts listening on local IPv4 port 3001. The zero-argument callback runs when listening begins; { opens its body.
- **Line 23:** Writes a startup message to the server terminal, not the browser or database.
- **Line 24:** Closes the startup callback and listen call, then attaches an error event listener to the returned server. This callback handles startup/listening errors.
- **Line 25:** Writes a generic startup failure message to the error stream. A busy port is a suggested cause, not a diagnosis of every error.
- **Line 26:** Sets a nonzero exit status to signal failure. This does not immediately terminate Node or its outer watch supervisor.
- **Line 27:** Closes the error-listener callback and on call; the semicolon ends the expression.

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
6 |   "engines": { "node": ">=24.19.0 <25" },
7 |   "scripts": {
8 |     "dev:client": "vite --config client/vite.config.js",
9 |     "dev:server": "node --env-file-if-exists=.env --watch server/index.js",
10 |     "build": "vite build --config client/vite.config.js"
11 |   },
12 |   "dependencies": {
13 |     "express": "5.3.0",
14 |     "react": "19.3.0",
15 |     "react-dom": "19.3.0"
```

- **Line 1:** Opens the root JSON object.
- **Line 2:** Names the package coachlab; the comma separates the next property.
- **Line 3:** Sets the project's own version, not a dependency version.
- **Line 4:** Marks the project private so npm will refuse accidental publication.
- **Line 5:** Makes .js files use JavaScript modules with import/export in Node.
- **Line 6:** Declares Node &gt;=24.19.0 and &lt;25. The range requires this supported Node major version; --engine-strict was used during installation to enforce compatibility.
- **Line 7:** Opens the scripts object, which maps command names to shell commands.
- **Line 8:** Defines npm run dev:client to start Vite with the explicit client configuration.
- **Line 9:** Defines npm run dev:server to run server/index.js, load .env if present, and restart on source changes with --watch. Missing .env is allowed.
- **Line 10:** Defines npm run build to produce a frontend production build using the same Vite configuration. This does not bundle Express or start a server.
- **Line 11:** Closes scripts; the comma separates the next object property.
- **Line 12:** Opens the runtime dependencies object.
- **Line 13:** Pins Express to version 5.3.0 for the backend.
- **Line 14:** Pins React to version 19.3.0 for components and hooks.
- **Line 15:** Pins React DOM to version 19.3.0 for browser rendering. No comma follows because this is the last property in this object.

### Lines 16–20

```text
16 |   },
17 |   "devDependencies": {
18 |     "vite": "8.3.4"
19 |   }
20 | }
```

- **Line 16:** Closes runtime dependencies and separates the next property.
- **Line 17:** Opens development-only dependencies used for building and serving frontend source.
- **Line 18:** Pins Vite to version 8.3.4. The lockfile additionally records transitive dependencies and integrity hashes.
- **Line 19:** Closes devDependencies without a trailing comma, as required for the final JSON property.
- **Line 20:** Closes the manifest's root object.

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

## SQL migrations and excluded files

No SQL migrations, schema, SQLite dependency, database connection, or lesson API implementation exists in this snapshot. There are no SQL lines to explain yet. Phase 3 is awaiting approval. When migration code is added, its full numbered source and every SQL statement must be documented here.

package-lock.json is generated dependency metadata and is excluded from individual line explanations as requested. node_modules and client/dist are generated and excluded. README.md, PROMPT_LOG.md, this walkthrough, and AGENTS.md are prose documentation rather than application source.

## Verification and maintenance

This snapshot covers 10 source/configuration files and 163 lines. Numbered code was read directly from the files, and coverage checks compare each numbered line and its explanation entry to the actual file. Explanations were reviewed against those lines. After any source change, update both the code listing and its explanations before committing. Never treat these line numbers as valid for a later version without rechecking.
