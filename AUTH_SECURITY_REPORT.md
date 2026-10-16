# Secure login and accounts (2026-10-16)

Design, migration record, security verification and test results. No secrets, connection strings or lesson contents are included.

## Approach chosen

**Better Auth 1.7.10** (MIT licence, actively maintained, current release, 0 `npm audit` findings). Reasons: it works with Express 5, Node 24 and Prisma 7 (the existing stack), supports PostgreSQL through Prisma and SQLite directly, and provides the security features requested (scrypt password hashing, server-side sessions in HttpOnly cookies, origin checks, rate limiting, enumeration-safe sign-up and reset, optional Google). No paid service is needed. CoachLab adds the rules the library does not decide for it: password policy, per-account lockout, per-user data ownership, the request gate and the claim process.

## Features

- **Create account** (name, email, password) with clear messages: weak, common, too short, email-name-in-password, bad email, empty name.
- **Sign in / sign out**, session survives page refresh (7-day sessions, refreshed daily), logout ends the session on the server.
- **Password reset**: one-time link, valid for one hour, works once, ends every other session when used. Until an email provider is configured, the link is printed in the backend window (local only).
- **Google sign-in (optional)**: shown only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in the ignored `.env`. Implemented and unit-tested up to Google's redirect address; **not exercised live** (needs your Google credentials).
- **Private dashboards**: every lesson, upload and attachment has an owner; every query is filtered by the signed-in coach.
- **Protected API**: everything under `/api` except `/api/health`, `/api/auth/*` and `/api/auth-config` requires a valid session. The server refuses to start without login configured.
- **Mobile-friendly** login, registration, forgot and reset screens (full-width buttons, at least 44 px tall, correct keyboards and password-manager hints, no sideways scrolling at 375 px).
- **Claiming lessons from before accounts** with `npm run claim-lessons` (see below).

## Security measures and how each was verified

| Risk | Measure | Verified by |
| --- | --- | --- |
| Plain-text passwords | Salted scrypt hash (library); only the hash is stored | Test reads the stored value: not the password, `salt:hash` format |
| Session theft / hijacking | Random token in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` automatically over https); sessions stored server-side so logout, expiry and password reset revoke them; cookie not readable by page scripts | Tests: cookie attributes; replaying a stolen cookie after logout and after reset gives 401; forged cookie 401; browser: `document.cookie` shows no session |
| CSRF | Better Auth origin check on login routes; every changing request to the rest of the API needs an allowed `Origin`; `SameSite=Lax` | Tests: missing, `evil.example` and `null` origins get 403, including delete and sign-out |
| Brute force | Per-address limits (sign-in 10 per 5 min, register 10 per hour, reset 5 per hour) stored in the database, plus an 8-failures-per-15-minutes lockout **per account** that works across addresses | Tests: lockout from 8 different addresses; flood from one address gets 429 |
| Account enumeration | Identical error for wrong password, unknown email and malformed email; identical sign-up answer for new and existing emails (existing owner gets a notice instead); identical reset answer; no reset mail flooding (3 per hour per account) | Tests compare the JSON bodies; browser shows identical messages |
| Weak input | Shared client/server rules for name, email, password (length 10 to 128, common list, repeated or digit-only, email name) | Unit tests and browser |
| Data leaks between coaches | `owner_id` on lessons and attachments; all store methods require the owner; foreign ids return 404 (not 403); attaching another coach's upload is refused; deleting an unsaved upload and file downloads are owner-checked; uploaded files are sent `private, no-cache` so a shared browser cannot show another coach's cached media | API tests on SQLite, a real PostgreSQL test with two coaches, and the browser |
| Secrets | Auth secret is a random 96-character value generated into the ignored `.env` (never printed or committed); server refuses to start without one; Google secret stays server-side | Secret scan of every staged file found no configured value; `.env` is ignored |
| Caching / leakage | `Cache-Control: no-store`, `nosniff`, `Referrer-Policy: no-referrer` on API answers; no `X-Powered-By`; the reset token is removed from the address bar immediately | Tests and browser |
| Production | Only the Development database was used; the migration script checks the project, branch, endpoint and database name | Script output and tests |

## Database changes (additive only)

New tables `auth_users`, `auth_sessions`, `auth_accounts`, `auth_verifications`, `auth_rate_limits`, and a **nullable** `owner_id` (foreign key, `ON DELETE RESTRICT`) on `lessons` and `lesson_media`. Migration: `prisma/migrations/20261016150000_add_accounts_and_ownership` for PostgreSQL and `server/migrations/003_add_ownership.sql` for SQLite (login tables for SQLite are created by the library at start-up). No existing lesson or attachment row is changed; they keep an empty owner.

**Process followed**
1. Reviewed risk: the change only adds structures; the one behavioural consequence is that unowned lessons become invisible until claimed (intended, as requested).
2. Applied it first to a disposable PostgreSQL test schema (automated test and browser run).
3. **Backup before touching real data**: `C:\Users\barri\CoachLab-backups\auth-migration-2026-10-16T17-08-19-982Z\` (outside OneDrive; JSON of every lesson and attachment including file bytes, plus `MANIFEST.txt` with counts and SHA-256). It was re-read and checked before continuing.
4. Applied to the Development database in one transaction with a fingerprint check: **5 lessons and 6 attachments before and after, identical fingerprint, zero owned rows**. Recorded in `_prisma_migrations`.

**Rollback (not run):** `BEGIN; ALTER TABLE lesson_media DROP COLUMN owner_id; ALTER TABLE lessons DROP COLUMN owner_id; DROP TABLE auth_rate_limits, auth_verifications, auth_accounts, auth_sessions, auth_users; DELETE FROM _prisma_migrations WHERE migration_name = '20261016150000_add_accounts_and_ownership'; COMMIT;` Run it only if nothing has been claimed yet; otherwise restore ownership from the claim backups.

## Existing lessons

Your 5 lessons and 6 attachments are intact and still unowned, so no account can see them yet. **To get them back into your account**:

1. Open http://127.0.0.1:5174/, choose **Create an account**, then sign in.
2. In a terminal in the project folder, see what would happen (changes nothing):
   `npm run claim-lessons -- --email you@example.com --all-unclaimed`
3. If the list is right, do it for real (writes a verified backup to `C:\Users\barri\CoachLab-backups`, then changes the owner in one transaction and verifies it):
   `npm run claim-lessons -- --email you@example.com --all-unclaimed --confirm`
   You can claim just some lessons with `--lessons 8,9` instead of `--all-unclaimed`.

Safeguards: dry run by default; only lessons with no owner can be claimed; requested lessons that are already owned stop everything; backup folders inside OneDrive are refused; the proof of ownership is control of the computer and database (CoachLab has no way to prove authorship otherwise), which is why this is a command and not a button.

## Tests

| Check | Result |
| --- | --- |
| `npm test` | **68/68 pass**: the 53 earlier lesson, AI and media tests now run behind the login gate, plus 12 authentication tests and 3 claim tests |
| `npm run test:prisma`, `npm run prisma:validate`, `npm run build` | pass |
| `npm audit` | 0 vulnerabilities |
| Opt-in PostgreSQL tests on a disposable schema: existing API test and the new real Better Auth + Prisma test (register, sign in, isolation of lessons and media between two coaches, claiming, reset, logout, rate-limit rows stored) | both pass |
| Walkthrough coverage | 68 files / 4,167 lines, exact |

Browser (disposable PostgreSQL schema, real browser pane): weak, common and bad-email registrations refused with clear messages; registration then sign-in; wrong password and unknown email show the same message; signed-in dashboard; **refresh keeps the session**; lesson with uploaded picture, AI draft (mocked AI), edit and delete all work behind login; log out then `/api/lessons`, `/api/lesson-media` and a media file all answer 401; a second coach sees nothing and guessed lesson/media ids answer 404; forgot-password gives the same message for a known and an unknown email and creates exactly one link; the link opens the new-password form (token removed from the address), weak password refused, new password works, old password rejected, the link cannot be reused; a revoked session sends the page back to the login screen with an explanation; login, register and forgot screens at 375 px have no overflow and no target under 44 px.

## Remaining issues and limits

- **No email provider yet**: reset links (and "someone tried to register with your email" notices) are printed in the backend window. Real delivery needs an email provider such as SMTP or a free-tier service; that needs your choice and credentials. Email verification at sign-up is not enforced for the same reason, so anyone can register an address they do not own (they cannot read that address's lessons, but they could occupy it).
- **Google sign-in untested live** (needs your Google OAuth client). Without credentials the button is hidden.
- The per-account lockout counters live in memory and reset when the backend restarts; the per-address limits are stored in the database and survive restarts.
- Local development uses plain http, so cookies are not marked `Secure` there. They become `Secure` automatically when `COACHLAB_PUBLIC_URL` is https. **Do not deploy publicly** before moving to https, a real email provider and a secret store.
- Browser addresses must match `COACHLAB_PUBLIC_URL` (default `http://127.0.0.1:5174`, with `localhost` accepted too); other addresses are rejected by the origin check.
- Rate limiting trusts the `x-forwarded-for` header set by the CoachLab dev proxy; the backend listens only on this computer.
- Older command-line tools (`curl`) must send an `Origin` header for POST, PUT and DELETE requests.
- There is no account deletion, change-email or two-factor sign-in yet.
