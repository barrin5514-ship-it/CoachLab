# Controlled dependency repair — October 15, 2026

Outcome: scoped overrides verified for CoachLab's exercised paths and applied. npm audit changed from four high-severity package entries to zero vulnerabilities. This is a project-tested override, not a claim that Prisma upstream certifies these substitutions for every workflow.

## Changes

- Prisma stays at 7.10.0, matching Client and adapter. Only prisma@7.10.0's mysql2 is overridden to 3.24.6 and @prisma/config@7.10.0's deepmerge-ts to 8.0.2.
- package-lock.json records the resolved versions and integrity hashes. MySQL2 replaces obsolete transitive queue/string helpers with sql-escaper; no unrelated application dependency pins changed.
- Two regression tests exercise actual Prisma config loading, nested config merging without input mutation, and the recursive graph that previously exhausted the stack. npm run test:prisma runs these with the existing setup tests.
- CODE_WALKTHROUGH.md explains every changed package.json line and every new test line. Four preexisting incorrect closing-brace descriptions in the package walkthrough were corrected during review.

## New compatibility evidence

The isolated trial was a git archive of the clean starting commit under ignored tmp/security-trial, with its own package files and node_modules. No .env or real database was copied. Installation used registry packages with scripts initially skipped; the SQLite dependency was rebuilt explicitly for existing tests. No global script approval settings or TLS checks were disabled.

| Check | Isolated trial | Main after application |
| --- | --- | --- |
| Dependency installation | Passed, exact overrides resolved | Passed, same scoped overrides |
| SQLite/API/mocked Gemini suite | 30 passed | 30 passed |
| Prisma suite | 3 passed plus separate compatibility experiment | 5 passed, including 2 retained regression tests |
| Client generation/TS compilation | Passed, client 7.10.0 | Passed, client 7.10.0 |
| Schema validation | Passed | Passed |
| React production build | Passed, 20 modules | Passed, 20 modules |
| npm audit | 0 vulnerabilities | 0 vulnerabilities |
| Read-only Prisma database connection | Passed with bounded transaction wait | Passed with bounded transaction wait |
| Prisma migrate status | Correctly detected unapplied initial migration | Correctly detected unapplied initial migration |

Additional isolated comparison loaded the actual CoachLab configuration through original and overridden Prisma configuration packages and found matching schema/migration settings. Plain nested merging matched Deepmerge 7.1.5. The cyclic merge completed correctly with 8.0.2. The 8.x Map/advanced custom-merge changes are not used by this configuration; do not generalize these results to arbitrary Prisma configurations.

Read-only probes loaded the existing ignored environment in memory without copying or printing secrets. They used the already verified development target, explicitly set the Prisma transaction READ ONLY, and checked both expected database and transaction_read_only. migrate status inspected the development database through a temporary direct-URL config; it exited 1 with the initial migration pending/unmanaged, which is expected for this empty target. Output was reduced to status flags rather than exposing connection details. No migrate dev/deploy/reset, db push, lesson import or PostgreSQL write occurred.

Offline migrate diff still exited without producing its requested SQL artifact, matching the issue already recorded before the overrides. This is unresolved and not counted as a successful SQL-generation test. Migration-status tooling and existing static migration checks passed; executing the migration remains untested and requires separate approval. SQLite migrations ran only in isolated regression-test fixtures.

## Runtime exposure and maintenance

The affected packages belong to Prisma's development/configuration/MySQL tooling. Active Express startup still opens SQLite; Gemini and React do not import these packages. Optional PostgreSQL runtime uses pg, not mysql2. Prisma can appear through Client peer dependency resolution, so installation classification alone is not a guarantee that tooling is absent from deployment. No production MySQL workflow was tested or enabled.

All original audit findings are resolved in the installed/locked tree according to the current npm advisory response. This does not guarantee absence of unknown vulnerabilities. Keep the scoped version pins and regression tests; reevaluate when Prisma changes and prefer an upstream-supported patched dependency tree when available. No Prisma 8 upgrade or audit fix --force was used.

## Genuine errors and corrections

1. Initial baseline test command ran in the restricted shell: 6 passed and 24 failed with localhost EACCES. Rerunning with required localhost permission passed all 30; no code fix was needed.
2. The first temporary directory was in the sandbox-specific TEMP location, invisible to the elevated shell. Set-Location failed but PowerShell continued, accidentally changing main package files and installed dependencies before isolation testing. Restored package.json/package-lock.json from clean HEAD and reinstalled the original dependencies (audit returned four high). Verified package diffs empty. Moved the accidental audit artifact into ignored tmp. Recreated the trial under the shared ignored tmp directory and used Stop-on-error commands. Only after isolated verification were overrides deliberately applied again. No database operation occurred during the mistake.
3. The initial comparison helper imported a Windows path directly as an ESM URL; converted it with pathToFileURL and the comparison passed.
4. The first read-only helper used Prisma's short default transaction-acquisition wait and returned P2028. Retried with the prior verification's bounded maxWait 15 seconds/timeout 20 seconds and succeeded. This is a test-harness correction, not a change to application production settings or proof of a specific network cause.

## Next boundary

The four-finding security blocker is cleared for the tested setup. A separately approved migration phase must recheck target identity/emptiness and validate actual migration execution. Offline SQL-diff output remains a known limitation. SQLite remains active; Phase 9C has not begun.
