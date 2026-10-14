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
- Commit: This entry is included in the foundation commit; its hash will be recorded in the next commit.

## Agent Mistakes and Corrections
No confirmed AI-generated implementation mistake has been observed so far. Environment access errors are recorded above; no bug has been intentionally introduced.
