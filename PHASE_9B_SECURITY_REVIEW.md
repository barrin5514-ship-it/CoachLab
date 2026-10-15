# Phase 9B dependency security review

Date: October 15, 2026. Outcome: dependency changes stopped under the user's explicit stop condition. No compatible complete fix was established. Four high-severity affected package entries remain.

## Findings and exact versions

| Audit entry | Installed | Audit affected range | Available remediation |
| --- | --- | --- | --- |
| deepmerge-ts | 7.1.5 | <8.0.0 | First patched 8.0.0; latest stable 8.0.2. Latest 7.x is 7.1.6 and remains affected. |
| mysql2 | 3.15.3 | <3.22.0 for authentication downgrade; <=3.23.0 for decompression exhaustion | 3.22.0 fixes only the first issue; published 3.24.0 and 3.24.6 fall outside both ranges. Latest stable is 3.24.6. |
| @prisma/config | 7.10.0 | 6.13.0-dev.1 through 8.1.0-dev.4, inherited from deepmerge-ts | Latest stable remains 7.10.0 and pins deepmerge-ts 7.1.5. No patched stable replacement verified. |
| prisma | 7.10.0 | 6.13.0-dev.1 through 8.1.0-dev.6, inherited from config/mysql2 | Latest stable remains 7.10.0; npm suggests a major downgrade to 6.19.3, not a compatible patch. |

These are four affected package entries arising from three underlying advisories: two high and one moderate. npm assigns mysql2 the highest severity of its two advisories and propagates severity to dependent packages. Registry versions, dependency pins and engines were fetched directly from official npm metadata; the audit was refreshed during this task. No candidate package was installed.

## How CoachLab uses them and actual exposure

The installed path is prisma → @prisma/config → deepmerge-ts, plus prisma → mysql2. Inspection of @prisma/config/dist/index.js confirms its JavaScript/TypeScript configuration loader imports deepmerge and passes it to c12 as the merger; remote extension and package.json/RC loading are disabled there. CoachLab's prisma.config.js is a fixed local configuration. The recursive-object vulnerability needs cyclic objects, not ordinary JSON. No route from a CoachLab HTTP request to that merger was identified. Untrusted local configuration still must not be loaded.

MySQL2 is installed by Prisma's CLI. Its authentication issue can expose credentials through a malicious MySQL authentication exchange; its compressed-protocol issue can exhaust resources. CoachLab does not configure or connect to MySQL: active startup imports SQLite, and the optional Prisma development client uses @prisma/adapter-pg/pg. Searches of authored server/frontend source found no mysql2/deepmerge import. Current application reachability was not demonstrated, but these observations do not prove the entire toolchain unexploitable or remove the vulnerabilities. Prisma may be present in dependency resolution through Client's peer relationship, so merely omitting development packages is not claimed as a fix.

## Remediation decision and compatibility risks

Recommended complete solution: use an upstream compatible Prisma release or maintained 7.x Deepmerge security backport when available, then rerun this review and all checks. Neither was available in the inspected stable releases.

A narrowly scoped mysql2 3.24.6 override is a possible partial remediation: it stays within MySQL2 major 3 and declares Node >=8, compatible with Node 24.19.0. However, Prisma pins 3.15.3 exactly. Overriding that pin is not equivalent to an upstream-supported Prisma patch and needs a separately scoped compatibility evaluation. It would still leave the Deepmerge/config/Prisma findings, so it was proposed but not applied after the stop condition was reached.

Overriding deepmerge-ts with 8.x would cross a major version outside Prisma's exact pin. The official 8.0.0 notes document changes to Map merging, mutation behavior and type names. Existing CoachLab tests do not cover all Prisma configuration merge semantics. Passing generation alone would not prove compatibility. No automatic major override, Prisma 8 upgrade, Prisma 6 downgrade, audit fix --force, hand-edited node_modules patch or audit suppression was used.

## Checks actually performed

- npm test: 30 passed, 0 failed. Includes SQLite Create/Read, isolated migration/persistence tests and mocked Gemini generation/error handling. No real lesson data touched or live Gemini success claimed.
- npm run test:prisma: 3 passed, 0 failed, including Prisma Client 7.10.0 generation and isolated generated-client TypeScript compilation.
- npm run prisma:validate: passed.
- npm run build: passed, 20 modules.
- JavaScript syntax, ignored-private-path and frontend secret separation checks: passed via existing checker.
- Walkthrough verifier: passed, 32 files and 1,077 exact source lines/explanations.
- npm audit --json: completed and reports 4 high, 0 critical; this is a failing security result, not a clean audit. Raw response retained only under ignored tmp.

No source, package configuration or lockfile changes were made. No PostgreSQL connection, migration, db push, reset or Phase 9C work occurred. Existing SQLite fixture migrations ran only as part of the requested automated tests. No new agent implementation mistake was observed; no fictitious correction is recorded.

## Sources

- [Deepmerge advisory and patched version](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- [Deepmerge 8.0.0 breaking changes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0)
- [MySQL2 authentication advisory](https://github.com/sidorares/node-mysql2/security/advisories/GHSA-3f6p-5ww8-9rcr)
- [MySQL2 decompression advisory](https://github.com/sidorares/node-mysql2/security/advisories/GHSA-rgwj-5xj2-c3m3)
- Official npm metadata: [Prisma](https://registry.npmjs.org/prisma), [Prisma config](https://registry.npmjs.org/@prisma%2fconfig), [Deepmerge](https://registry.npmjs.org/deepmerge-ts), [MySQL2](https://registry.npmjs.org/mysql2).

PostgreSQL migration is not ready under the user's requirement to resolve these findings first. A separate decision is needed for a limited override investigation or a compatible upstream fix. No risky dependency change was made merely to obtain a clean audit.
