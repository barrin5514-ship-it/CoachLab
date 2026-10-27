# Production preparation verification — October 27, 2026

Implementation and local verification are complete; **public deployment is on hold for dependency security review**. Nothing was deployed or pushed, no production credentials were supplied, and no remote migration or database query was executed by this work. Existing local `.env` values were neither read nor edited. Development commands and the separate development database factory are unchanged.

## Fresh results

| Check | Actual result |
| --- | --- |
| Baseline existing tests, explicit concurrency 1 | 68 passed, 0 failed |
| Root `npm run build`, run once after implementation | Passed: install, Prisma 7.10 generation, TypeScript compilation, Vite production build (31 modules) |
| Final `npm test`, serial by script | 74 passed, 0 failed, 0 skipped |
| `npm run prisma:validate` | Schema valid; default offline config |
| Existing Prisma setup and compatibility tests, serial after build | 5 passed, 0 failed |
| `node --check` for all 13 changed/new JavaScript files | Passed |
| Walkthrough comparison for changed source/config/test files | 15 files / 1,037 lines: exact numbered listings, one explanation per line |
| Dependency lockfile comparison against 969a455 | No changes |
| Full `npm audit --audit-level=high` with Windows system CA trust | Exit 1: 11 findings, 2 high and 9 moderate |

Tests cover production listening settings; static/browser routing versus API/asset 404s; HTTPS origin/secret validation; normalized proxy addresses; unsafe production URL rejection; migration runner success/failure/early rejection; real Secure-cookie issuance with disposable SQLite; production reset endpoint rejection with no token/mail; and existing lesson, AI mock, media, authentication, ownership and SQLite persistence behaviors.

The migration runner is injected with a fake command launcher in tests. Its printed “Production migrations completed” message is NOT a real remote-migration result. No `npm start` against a real database was run. No real Gemini or YouTube provider request was needed.

## Errors, warnings and corrections

- An initial inspection assumed `prisma.config.ts`; the actual file is `prisma.config.js`. The production configuration is a separate file, preserving the existing default.
- A local walkthrough helper failed on an escaped source pattern. The shell continued to commit before documentation refreshed. The helper was corrected and the unpushed step-4 commit amended to include the explanations. Subsequent command sequences explicitly stop on failure.
- First step-5 targeted run: 17 of 18 tests passed. The old auth-config equality assertion omitted the new `passwordReset` capability. Updated that expected response; three affected tests passed on rerun, and the final full suite passed.
- Existing Better Auth fixture initialization emits missing-table diagnostics before its disposable SQLite setup completes, plus expected rejected-login warnings. These also occurred before changes; passing assertions do not indicate production schema changes.
- npm install warned about unapproved lifecycle scripts for Prisma engines, Prisma and better-sqlite3. The existing local installation/build succeeded. No script approvals or package upgrades were made. A clean Linux/Render install remains a post-deployment check; stop and review any install-script failure rather than broadly allowing unknown scripts.
- The first audit attempt could not validate the registry certificate. Repeated it with `NODE_USE_SYSTEM_CA=1` for that process only; TLS verification stayed enabled. The full audit then returned the findings below.

## Security hold

Installed direct/runtime chain: Express 5.3.0 and body-parser 2.3.0. The audit reports a high-severity compressed-request denial-of-service advisory, GHSA-27r3-jxmh-p828, with Express marked high through its dependency. `qs` 6.16.0 and `fast-uri` 3.1.8 also have moderate advisories, with further transitive findings through Prisma/Better Auth. These are dependency findings, not eleven confirmed exploitable application endpoints. No exploit was attempted and no production exposure is claimed.

The current audit offers no fix for the reported paths. Dependency versions and the lockfile were not changed by this preparation. Per the user's instruction to stop on risk and fix only regressions caused by this task, no dependency remediation was attempted. A separate compatibility/security review is the next step before publishing. Do not use `npm audit fix --force`.

Production cookies are forced Secure, APP_URL is a single HTTPS origin, and the proxy setting assumes Render is the sole ingress. No password-reset mail or reset tokens are generated in production. There is no built-in coach/admin recovery tool. Existing shared in-memory AI limits are not a durable spending cap, and email ownership remains unverified. Keep these limits visible to the owner.

## Commit sequence

1. `51143ed` — Serve built React and hosting port in production.
2. `62c72e4` — Add guarded production Neon and migration configuration.
3. `74dfa8f` — Add sequential production build and guarded startup scripts.
4. `acded0c` — Require HTTPS origin and secure Render authentication.
5. `bfb2294` — Disable self-service password reset in production only.
6. `e1af34d` — Document separate Neon and Render deployment procedure.
7. This report's containing commit: **Record production checks and dependency deployment hold**. Its resolved hash is provided in the final handoff rather than recursively embedded in itself.

## Not verified here

Actual production project identity, connectivity, direct migration execution, fresh Linux dependency installation, public Render proxy behavior, browser behavior on public HTTPS and production data persistence all require the operator's later deployment checks in DEPLOY.md. The new code is locally verified, not a claim of a successful or security-cleared deployment. Local accounts/lessons were not copied into production. No files in neighboring projects were changed.
