# Phase 9D — hands-on testing handoff

Date: 2026-10-15 America/New_York (verification continued into 2026-10-16 UTC).
Status: Milestones 1–3 reached. Milestone 4 requires separate approval.

## Open CoachLab

http://127.0.0.1:5174/

The frontend and backend were left running. Local development explicitly selects PostgreSQL in ignored `.env`; the code still defaults to SQLite if no selector is supplied. There is no automatic fallback. Neon target: CoachLab project `rapid-firefly-98778665`, Development branch `br-flat-fog-b5t1m0vy`, endpoint `ep-long-bird-b50l2nhb`, database `neondb`. Authenticated Console independently showed that Development endpoint; direct authentication and pooled queries matched the configured database and role. Production was not accessed.

## Verified results

- Existing SQLite/API/mocked Gemini suite: 30/30 passed.
- Existing Prisma suite: 5/5 passed, including Client generation/compilation.
- New opt-in PostgreSQL API integration: one parent test passed, covering all six disciplines, mock generation without saving, approval/save, committed readback after reconnect, invalid input and safe asynchronous errors. Random test schema removed afterward.
- React production build: passed, 20 modules. Changed JavaScript syntax checks passed.
- Real browser in a disposable PostgreSQL schema: manual save, AI mocked generation, draft editing, approval required before save, refresh and full backend process restart passed. Two synthetic records matched before/after restart; schema removed before cutover.
- Cutover: API stopped, port reserved, SQLite read transaction held; source and destination both empty. No transfer was needed. Ignored configuration changed only the database selector.
- Real development application: browser-created `CoachLab development verification lesson` remains in Neon Development. All nine API fields match Prisma readback. Full backend process restart preserved the complete record; refreshed browser shows it. SQLite remains empty with unchanged SHA-256.
- Live Gemini was not called during this phase. The running application uses the existing configured provider, not the browser-test mock.

## Data protection and rollback

Original SQLite: `C:\Users\barri\AppData\Local\CoachLab\coachlab.sqlite`.
Tested backup directory: `C:\Users\barri\AppData\Local\CoachLab\backups\phase9d-2026-10-16T00-54-58-345Z`.
Backup and separate restored copy passed integrity, record and migration comparisons; their hashes match. The original file hash remained unchanged. A private pre-cutover environment backup is in that directory; never upload it. Historical browser-test lessons were not imported or modified.

One labeled verification lesson remains in the real Development table. Further lessons you save now go to PostgreSQL. Do not simply switch back to the empty SQLite database: first stop writes and reconcile/export new PostgreSQL records so none are lost. Keep both databases and backups intact.

## Try it

1. Open the URL and confirm the verification lesson appears.
2. Create a manual lesson in your chosen discipline and save it.
3. Refresh and confirm your lesson remains.
4. Try an AI draft with generic coaching information, edit it, then explicitly approve and save. Never submit personal athlete information.
5. Report any errors or confusing behavior.

Supported disciplines: Boxing, Wrestling, Muay Thai, Brazilian Jiu-Jitsu, MMA and Personal Training. Update/Delete, authentication, multiweek programs, athlete tracking and videos are not implemented. AI requires working configured Gemini access and available quota; its live availability was not retested here. Some database-backed loads took several seconds; the loading screen remained until results arrived.

## Restart commands if needed

From the CoachLab directory, in separate PowerShell terminals:

```powershell
$env:NODE_USE_SYSTEM_CA='1'
npm run dev:server
```

```powershell
npm run dev:client -- --host 127.0.0.1 --port 5174 --strictPort
```

Do not run duplicate servers while the handoff servers are already running. The API binds only to `127.0.0.1:3001`. TLS verification remains enabled; the system CA option uses trusted local certificates.

## Deferred to separately approved Milestone 4

Remaining regression/error checks, fresh security audit, complete line-by-line walkthrough updates, README/instruction updates, final review, commit and push. New source files are `server/lesson-store.js` and `server/postgres-api.test.js`; modified source files are `server/app.js`, `server/index.js`, `server/prisma-development.js`. No dependency change. No commit/push during this milestone; baseline is `f718ae8e114577d11b89090e7f6e8089af41584e`. Existing walkthrough does not yet explain these Phase 9D changes and must not be described as current/complete.
