# Deploy CoachLab as one Render service

Prepared October 27, 2026. **Nothing has been deployed by this preparation.** Follow these steps only when you decide to publish. Keep the existing local `.env`, Neon Development project, SQLite files and backups unchanged. Local accounts and lessons are not copied into the new production database.

**Security triage update, October 27:** compatible body-parser, qs and fast-uri updates cleared the original 11 findings; the fresh full audit is zero. Production also rejects compressed API bodies and has bounded per-address request limiting. See SECURITY_NOTES.md for the original findings, tests and residual limits. The security hold is cleared for a supervised class demo, conditional on successful configuration and the checks below. PRODUCTION_PREPARATION_VERIFICATION.md preserves the earlier audit results as history, not the current audit status. No deployment has occurred.

## What will run

Render runs Express, which serves both the API and the built React files from `client/dist`. Neon stores accounts, lessons and uploaded media. PostgreSQL is required in production; there is no SQLite fallback. The browser and API share one HTTPS origin, so a separate frontend service and cross-origin setup are unnecessary.

## Render environment variable names

Set these in Render's Environment panel, never in Git, screenshots, chat, a frontend variable, or the local development `.env`.

| Name | Meaning |
| --- | --- |
| NODE_VERSION | Pins the hosting Node release to the locally verified version. |
| NODE_ENV | Selects production behavior. |
| COACHLAB_DB_ENV | Explicitly confirms this is the separate production database environment. |
| APP_URL | The exact public HTTPS origin of this Render service, with no subpath. |
| DATABASE_URL | Secret pooled Neon connection used by application queries. |
| DIRECT_URL | Secret non-pooled connection to the same Neon database and role, used by migrations. |
| PRODUCTION_DB_HOST | Expected direct Neon hostname, copied independently from the production endpoint details. |
| PRODUCTION_DB_NAME | Expected database name, independently confirmed in Neon. |
| BETTER_AUTH_SECRET | A new random production-only session-signing secret of at least 32 characters. |
| GEMINI_API_KEY | Server-only provider key needed for AI; manual lessons work without it. |
| AI_PROVIDER | Optional provider selector; the implemented default is Gemini. |
| AI_MODEL | Optional supported model override; omit to retain the application's documented default. |
| YOUTUBE_API_KEY | Optional YouTube search key; pasted links and the catalog do not require it. |
| PORT | Supplied by Render automatically; normally do not set it yourself. |

Do not copy any `COACHLAB_DEV_*`, local database paths, Google OAuth credentials or local-origin settings into this service. Google login is optional and is outside this deployment checklist. No `VITE_` secrets are needed. Choose credentials with billing/quota settings you understand; this work does not enable billing.

## 1. Prepare GitHub

Review the local preparation commits and test results. When you authorize publishing the code, push the existing `main` branch normally to `https://github.com/barrin5514-ship-it/CoachLab.git`; never force-push. Confirm GitHub shows these files, including this guide and the production scripts. This preparation did not push anything, because a connected hosting service might auto-deploy a push.

## 2. Create a separate, empty Neon project

1. Sign in to Neon Console. From the project selector/dashboard, choose **New project** (or **Create project**).
2. Name it clearly, such as **CoachLab Production**. Choose a region near the planned Render region and a supported PostgreSQL version. Remain on Free unless you personally approve a paid plan.
3. Create a NEW project, not a data-containing child branch of CoachLab Development. Its default branch can be the production branch; label it clearly in Neon. Record the project and branch IDs privately for your deployment records.
4. Open that new project's branch and **Tables** or **SQL Editor**. Confirm the selected database is empty of application tables. If it already contains lessons, accounts or other application tables, stop and investigate instead of resetting it.
5. Click **Connect**. Select this new branch, database and owner role. With **Connection pooling** on, copy the connection string privately into Render's `DATABASE_URL`.
6. Turn pooling off, keeping the SAME branch, database and role. Copy that string privately into `DIRECT_URL`. Both URLs must use the `postgresql` scheme and TLS. Keep Neon-provided `sslmode` and optional `channel_binding` parameters; do not add arbitrary parameters.
7. Independently compare the endpoint's direct hostname and database name with `PRODUCTION_DB_HOST` and `PRODUCTION_DB_NAME`. The pooled hostname differs only by `-pooler`. Confirm neither endpoint belongs to the existing Development project.

The code checks matching URLs, expected hostname/database, explicit production flags and TLS. It cannot prove which project you intended solely from a URL: your Console comparison is essential. Do not import historical lessons, run `db push`, `migrate dev`, or any reset command.

## 3. Configure Render

1. In Render Dashboard, click **New > Web Service**. Connect GitHub and select **CoachLab**.
2. Select branch **main**, runtime/language **Node**, and leave **Root Directory** empty (the repository already contains CoachLab at its root).
3. Choose a service name and a region near Neon. Choose Free for a trial or personally approve paid always-on compute. Free services sleep after inactivity, so allow a cold start before a demo.
4. Paste **Build Command**: `npm run build`
5. Paste **Start Command**: `npm start`
6. Set **Health Check Path** to `/api/health`. Set **Auto-Deploy** to off/manual so future code pushes do not publish unexpectedly. These labels may be under Advanced or Settings.
7. Add the environment settings above. Set `NODE_VERSION` to `24.19.0`, and both `NODE_ENV` and `COACHLAB_DB_ENV` to `production`. Use a password manager to create a separate random `BETTER_AUTH_SECRET`; do not reuse the development secret. Set the database settings only after completing the Neon comparison.
8. Set `APP_URL` to the service's exact `https://...onrender.com` origin when Render provides it. If the address is not shown until service creation, leave APP_URL unset for that first attempt: startup deliberately fails BEFORE migrations. Then copy the assigned public origin into APP_URL, save, and manually deploy again. Do not guess or use localhost.
9. Only when you are ready to publish, click **Create Web Service / Deploy Web Service**. This is the actual deployment action. Confirm the public origin matches APP_URL before letting users sign in.

Build installs the locked dependencies including build tools, generates and compiles Prisma Client, then builds React. There is no database operation during build. The start command validates production settings, runs the locally installed `prisma migrate deploy --config prisma.production.config.js`, and starts Express only on success. The separate default `prisma.config.js` stays offline for local work. The production entry point does not load `.env`.

Migrations run at each start, but Prisma applies only pending migrations. The first start creates tables in the NEW empty database. A failed/timed-out migration stops startup. Do not reset, delete migration history, or repeatedly retry blindly: have a developer inspect `migrate status` with the production config securely. CLI output is intentionally not echoed by the startup wrapper because diagnostics may contain private connection information.

## 4. Verify the public application

- Open the HTTPS public URL. Confirm `/api/health` reports CoachLab API status. This proves the process is responding, not every later database operation.
- Create a coach account with a password saved in your password manager; sign in. No confirmation email is sent or required.
- Create a harmless manual lesson, refresh, then log out and sign in again. Confirm it is still there.
- Edit that lesson and confirm it updates without a duplicate. Delete only a disposable test lesson, using confirmation.
- In a private/incognito window create a second account. It must not list the first account's lessons or media. If it does, stop inviting users and investigate.
- Restart the Render service once; sign in again and confirm the saved lesson persists.
- Confirm no Forgot password link is offered and the contact-the-coach message appears. Password-reset API routes are disabled in production.
- If Gemini is configured, generate ONE generic draft, review/edit/approve it, save, and refresh. Do not enter athlete identities, children's information, medical details or other sensitive data.
- Try a small permitted image and a known instructional video. Uploads live in PostgreSQL, not Render's temporary filesystem. Large videos consume database storage quickly.
- Check mobile layout, browser refresh on a nested page, and logs for safe startup messages. Do not share credentials, cookies or private logs.

## Limits to understand before inviting users

There is no email delivery or built-in coach/admin password reset tool. The contact message is guidance, not a new recovery feature. A coach cannot recover a user's plaintext password. Keep passwords in a password manager and arrange a separately reviewed recovery procedure before relying on this publicly long-term.

Render must be the only public ingress: Express trusts one proxy hop and normalizes client addresses before authentication. A custom proxy/CDN or direct server access requires a fresh trust-proxy review. HTTPS cookies work on the public origin, not a local HTTP production preview. Do not disable TLS verification to solve connection errors.

Existing AI request limits are shared, in memory and reset on process restart; they are not a billing cap. Keep provider billing disabled or separately control its budget. Free hosting/provider quotas and remote media availability can affect the demo. Account email ownership is not verified while email is disabled. Use only consenting adult testers and generic class data.

Production credentials, actual remote migrations, Render proxy behavior and the public sign-up/persistence workflow have NOT been live-tested by this preparation. This checklist is the required post-deploy verification, not a claim that deployment succeeded.

## Official references checked for this guide

- [Render Express setup](https://render.com/docs/deploy-node-express-app)
- [Render port and web service requirements](https://render.com/docs/web-services)
- [Render Node version selection](https://render.com/docs/node-version)
- [Render Free limitations](https://render.com/docs/free)
- [Neon projects](https://neon.com/docs/manage/projects)
- [Neon connections](https://neon.com/docs/connect/connect-from-any-app)
- [Prisma migration commands](https://docs.prisma.io/docs/cli/v7/migrate)
