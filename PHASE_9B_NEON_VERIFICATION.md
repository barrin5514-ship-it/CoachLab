# Phase 9B Neon connection verification

Date: 2026-10-15. Read-only verification completed; no migration or Phase 9C approval implied.

## Identity and connection evidence

- Git ignored `.env`; `git ls-files .env` returned no tracked file. Environment values were parsed privately and were not printed.
- Both URLs use Neon hosts and TLS settings. Removing the pooled hostname marker yields the exact direct hostname; database path and role match. The pooled hostname/database match the expected settings and the environment is explicitly development.
- After the user signed in, the authenticated Neon Console showed the owned CoachLab project on the Free plan in AWS US East 2. Its project ID and Development branch ID were compared privately with `.env` and matched. The Development compute endpoint ID matched both URL hostnames. It is distinct from the default production branch. Development is a child of production, so its name alone was not treated as evidence of emptiness.
- The existing `createDevelopmentClient` in `server/prisma-development.js` successfully connected with certificate verification enabled. An interactive Prisma transaction executed `SET TRANSACTION READ ONLY` before metadata SELECTs. PostgreSQL confirmed `transaction_read_only=on`.
- Server version: **18.6 (c021049)**. Database: **neondb**, matching the expected setting. `current_user` matched the configured URL role; the role value was withheld from output.
- Catalog inspection across non-system schemas found **0 user tables and 0 application tables**. It included ordinary, partitioned, and foreign tables while excluding PostgreSQL system/temporary schemas. No lesson records were read.
- The pooled URL was used for the live Prisma connection. The direct URL was compared structurally and to the Console endpoint; it was not independently authenticated. No direct migration connection or migration execution is claimed.

The live read-only check ran while Console sign-in was pending under the user's explicit read-only verification request. Independent Console identity verification completed afterward, before any database change; no database changes were performed at any point. No table/record creation, modification, deletion, migration, db push, reset, import, billing change or SQLite switch occurred. Client disconnected after the transaction.

## Actual checks

| Check | Result |
| --- | --- |
| npm test | 30 passed, 0 failed; isolated SQLite/API and mocked Gemini tests |
| npm run test:prisma | 3 passed, 0 failed; offline setup tests and generated-client compilation |
| npm run prisma:validate | Passed |
| npm run build | Passed; 20 modules |
| Existing walkthrough verifier | Passed: 32 files, 1,077 exact numbered lines/explanations |
| Existing credential/path/syntax/bundle scan | Passed before documentation edits; final review recorded in prompt log |
| Live Prisma metadata queries | Passed, read-only transaction, matching database/role, zero tables |
| Remote migrations | Not run; explicitly prohibited |

The existing SQLite tests create their own temporary fixtures and exercise SQLite migrations there. They do not run PostgreSQL migrations or modify the real lesson database. No new live Gemini request was made.

## Dependency investigation

Refreshed npm audit still reports four **high-severity affected package entries**, not four independent vulnerabilities: prisma, @prisma/config, deepmerge-ts and mysql2. Installed dependency paths are prisma 7.10.0 → @prisma/config 7.10.0 → deepmerge-ts 7.1.5, and prisma 7.10.0 → mysql2 3.15.3.

- [Deepmerge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx): crafted recursive object graphs can exhaust the stack; versions below 8.0.0 are affected. Plain JSON alone does not form such graphs. CoachLab's Prisma CLI configuration is a fixed local object; no demonstrated attacker-controlled recursive merge path was found in this review.
- [MySQL authentication advisory](https://github.com/sidorares/node-mysql2/security/advisories/GHSA-3f6p-5ww8-9rcr): authentication downgrade can disclose credentials; audit marks versions below 3.22.0 affected.
- [MySQL decompression advisory](https://github.com/sidorares/node-mysql2/security/advisories/GHSA-rgwj-5xj2-c3m3): unbounded decompression can exhaust resources; this advisory is moderate, with audit marking versions through 3.23.0 affected. mysql2's aggregate entry is high because of the authentication issue.

CoachLab's active application uses SQLite; the optional PostgreSQL client uses pg, not mysql2. The installed MySQL dependency comes from the Prisma CLI. This limits the observed application exposure but is not proof of non-exploitability or a remediation. All four audit entries remain unresolved. npm proposes a major change to Prisma 6.19.3; it was not applied. No upgrade, override, audit fix, or package/lockfile change occurred. A separately reviewed, compatible dependency remediation is still needed before deployment.

## Errors and corrections

An initial inline configuration-check command had an extra closing parenthesis and failed before executing. Corrected the syntax and reran successfully without printing secrets. The first audit request failed certificate-chain validation; reran using Node's trusted system CA option, keeping TLS verification enabled. The authenticated Console initially required user sign-in; the user replied `done`, and identity verification then succeeded. Browser tooling emitted unrelated telemetry-network errors, but the Console pages rendered and provided the identity evidence.

## Remaining boundary

Connection verification is complete. Migration execution, Lesson-table operations and switching the application to PostgreSQL are not complete or authorized by this verification. Recheck identity and emptiness immediately before any separately approved migration. SQLite remains the active application database. No source/configuration/test code changed, so CODE_WALKTHROUGH.md remains unchanged.
