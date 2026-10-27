# Security triage — October 27, 2026

The original 11 audit findings were dependency-tree entries, not eleven separate exploitable CoachLab endpoints. A targeted update changed only body-parser 2.3.0 to 2.4.0, qs 6.16.0 to 6.17.0, and fast-uri 3.1.8 to 3.1.9. All fit existing dependency ranges; no major upgrade or new override was needed. The full audit after that update reports **zero vulnerabilities**. Existing direct dependency versions remain unchanged.

## Original findings and actual exposure

“Production” means used by the hosted server. “Tooling” means not exposed as a CoachLab web route; these packages can still be installed in Render because Prisma CLI is needed at build/start. Severity below is the ORIGINAL audit severity; all entries are cleared by the lockfile updates.

| Package (original installed version) | Severity | Use | Could a website visitor trigger the reported problem before repair? |
| --- | --- | --- | --- |
| body-parser 2.3.0 | High | Production | Yes: compressed request parsing was reachable; a size limit alone did not fix malformed-stream handling. |
| express 5.3.0 | High | Production | Inherited body-parser exposure, not a separate exploit; fixed by updating its allowed dependency. |
| qs 6.16.0 | Moderate | Production dependency | No matching application path found: advisory concerns stringify with comma arrays and an unusual toString value; CoachLab does not call that operation. |
| fast-uri 3.1.8 | Moderate | Tooling via Prisma local streams | No application route found passing visitor URLs to this resolver; still patched. |
| ajv 8.20.0 | Moderate | Tooling via Prisma local streams | Inherits fast-uri findings; no CoachLab request route invokes this schema registry. |
| @prisma/streams-local 0.1.11 | Moderate | Local-development tooling | Local streams/schema service is not started by CoachLab or its production start command. |
| @prisma/dev 0.24.17 | Moderate | Local-development tooling | Prisma's local database service is not exposed by this app. |
| prisma 7.10.0 | Moderate | Build and production-start CLI | Inherits local-tooling chain; generation/migrate deploy do not expose prisma dev to website visitors. |
| @prisma/client 7.10.0 | Moderate | Production | Inherited CLI/tooling finding; no evidence the reported URI code is reached by normal lesson queries. |
| @better-auth/prisma-adapter 1.7.10 | Moderate | Production | Inherited Prisma finding, not an identified authentication exploit. |
| better-auth 1.7.10 | Moderate | Production | Inherited adapter/Prisma finding, not an identified authentication exploit. |

This is a code/dependency-path review, not a penetration test. No crash payload was sent to the running application or a real database. npm previously reported “no fix available”; independently checking the registry found compatible versions and the subsequent audit confirms those fixes resolved the findings.

## Existing controls

Regular Express JSON requests have a 32 KB limit. Upload parsing has a roughly 20 MB ceiling and file-specific limits of 6 MB for images and 20 MB for videos. Better Auth handles its own authentication requests before Express's JSON parser; do not describe the 32 KB JSON setting as a universal auth-body cap. Profile/password fields are validated.

Authentication has database-backed per-address limits (including 10 sign-in attempts per five minutes), plus in-memory account lockout. AI generation has concurrency and per-minute/per-day attempt limits; media search has separate limits. Before this triage there was no general API limiter. Body-size and request-count limits alone do not repair a decompression vulnerability; the patched dependency is the main fix.

## Verification so far

- After dependency updates: 74/74 existing application tests passed serially.
- Offline Prisma setup/compatibility checks: 5/5 passed serially.
- Full audit after targeted update: zero vulnerabilities.
- Final production guard checks and the single production build are recorded below when complete.

## Remaining risks and demo decision

Zero audit findings is not a guarantee of security. A small, supervised class demo using consenting adult testers and generic lesson data has a limited acceptable operational scope, conditional on the post-deployment checks in DEPLOY.md. Do not use it for sensitive athlete data, children's personal information, medical information or a broad public launch.

Email ownership is not verified; production self-service password reset and email delivery are disabled, with no admin recovery tool. Keep passwords in a password manager. AI/media providers have quotas and external content can disappear. AI counters reset with the process and are not a spending cap. Production requires a separately verified Neon project, HTTPS, correct secrets and Render as the only trusted ingress. No deployment or production migration is authorized by this task.

With more time: verified email/recovery, persistent shared request/budget limits, edge-level traffic protection, dependency monitoring, independent security review, tested recovery/backups and production-load testing. Reassess trust-proxy behavior if any CDN/proxy is added.

## Advisory sources

- [body-parser compressed-request DoS](https://github.com/advisories/GHSA-27r3-jxmh-p828)
- [qs stringify exception](https://github.com/advisories/GHSA-6pq8-jhm2-2vcw)
- [fast-uri scheme spoofing](https://github.com/advisories/GHSA-w74x-v6f9-j3xg)
- Additional fast-uri findings in the original audit: GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr, GHSA-333x-w4r6-6crp; all affected ranges end before 3.1.9.
