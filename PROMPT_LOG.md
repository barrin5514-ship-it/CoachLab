# CoachLab prompt log

## 2026-10-14 - Phase 1 inspection
- Instruction: Inspect and plan the CoachLab Week 5 React, Express, and SQLite project; do not modify files and wait for Phase 2 approval.
- Work: Inspected the workspace, existing projects, Git status, and installed tools. Recommended a separate CoachLab project.
- Files changed: None during Phase 1. This entry was recorded in Phase 2.
- Checks: Node 24.19.0, npm 11.17.0, Git 2.55.0; workspace is not a Git repository; no CoachLab folder existed.
- Commit: None.

## 2026-10-14 - Phase 2 approval and repository foundation
- Instruction: Begin Phase 2 only; create a separate project, initialize Git, ignore secrets and databases, configure an external database location, verify dependency compatibility, set up React/Vite and Express, test both servers, review diffs, and make small commits. Do not push or begin Phase 3.
- Work: Created CoachLab and initialized its own main branch. Added ignore rules and a safe database path example. No database has been created.
- Files changed: .gitignore, .env.example, PROMPT_LOG.md.
- Verification: Reviewed all three new files. git check-ignore confirmed that environment files, database files and journals, dependencies, build output, and temporary files are ignored; .env.example remains trackable. No credentials or actual database files were added.
- Environment errors: npm registry requests initially failed with ENOTFOUND in the sandbox and UNABLE_TO_VERIFY_LEAF_SIGNATURE outside it. Retried with NODE_USE_SYSTEM_CA=1 to use Windows trusted certificates, keeping TLS verification enabled.
- Commit: 75c0dc3 (Initialize CoachLab repository and safety rules).

## 2026-10-14 - Phase 2 development setup
- Instruction: Continued the approved Phase 2 scope; no additional user prompt was needed.
- Work: Added a React welcome screen, an Express health endpoint, a Vite API proxy, backend-only database path configuration, and setup instructions. No lesson routes, database dependency, migration, or database file was added. No push was performed.
- Files changed: package.json, package-lock.json, client/index.html, client/vite.config.js, client/src/main.jsx, client/src/App.jsx, client/src/styles.css, server/index.js, server/config.js, README.md, PROMPT_LOG.md.
- Compatibility checked BEFORE installation using npm registry metadata: Vite 8.3.4 requires Node ^20.19.0 or >=22.12.0; Express 5.3.0 requires >=18; React 19.3.0 requires >=0.10.0; React DOM 19.3.0 requires React ^19.3.0. Installed Node 24.19.0 satisfies these. Installation with --engine-strict succeeded (83 packages added; npm audit reported 0 vulnerabilities).
- Tests actually run: backend syntax checks passed; four database configuration assertions passed (default external path, custom absolute path, rejection of relative path, rejection of OneDrive path); npm run build passed; npm ls --depth=0 confirmed all four direct versions.
- Server checks: Both npm run dev:server and npm run dev:client started. HTTP assertions passed for Express health JSON, frontend HTML, transformed React module, and health JSON through Vite's proxy. /api/lessons returned 404 as expected because Phase 4 has not started.
- Environment errors: Initial HTTP checks failed with EACCES inside the sandbox and ETIMEDOUT when reaching sandbox-hosted servers from outside. Stopped those processes and restarted both servers outside network isolation; reran the same HTTP checks successfully. The optional .env absence message is expected because the default configuration is used.
- Limits: No interactive browser rendering test or persistence test was performed in Phase 2. SQLite is not installed yet.
- Review and commit: Source diffs and lockfile metadata are reviewed before this setup commit. Use git log --oneline to find this entry's containing commit.

## Agent Mistakes and Corrections
No confirmed AI-generated implementation mistake has been observed so far. Environment access errors are recorded above; no bug has been intentionally introduced.
