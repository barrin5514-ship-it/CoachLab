# CoachLab

A beginner-friendly React and Express project for coaching lesson plans.
Phase 2 provides the development foundation only. Lesson features and SQLite migrations are not implemented yet.

## Setup (Windows PowerShell)

Use Node.js 24.19.0 (the verified version) and npm.
From the CoachLab folder, run `npm ci` after cloning.
If npm reports UNABLE_TO_VERIFY_LEAF_SIGNATURE, run `$env:NODE_USE_SYSTEM_CA = '1'` in that terminal and retry. This uses Windows trusted certificates without disabling TLS checks.

Open two terminals in the CoachLab folder:

```powershell
# Terminal 1: backend
npm run dev:server
```

```powershell
# Terminal 2: frontend
npm run dev:client
```

Open http://127.0.0.1:5173. The screen should show "Backend connected."
Stop each server with Ctrl+C. Both servers bind only to this computer.
Ports 3001 and 5173 must be available.

Run `npm run build` to check that the frontend compiles for production.

## Database path (for Phase 3)

The default future SQLite location is `<Windows user home>/AppData/Local/CoachLab/coachlab.sqlite`, outside OneDrive.
No database or directory is created in Phase 2.
To override it, copy `.env.example` to `.env` in the project root and set DATABASE_PATH to an absolute file path outside OneDrive. Restart the backend after editing it.
Relative paths and paths with a OneDrive folder are rejected.
The `.env` file, database files, dependencies, and build output are ignored by Git.
The database path is backend-only; never use a VITE_ variable for private configuration.

## How this setup works

- `client/src/App.jsx` is the React screen. State stores the connection message; an effect checks the backend when the screen loads.
- Vite serves the frontend and forwards `/api` requests to Express on port 3001.
- `server/index.js` returns JSON from `/api/health`. This checks connectivity, not database readiness.
- `server/config.js` chooses the future database path. React never accesses SQLite directly.
- A single root package.json keeps installation simple. package-lock.json records exact dependency versions.

Git history and PROMPT_LOG.md record the work. No GitHub push has been made.
