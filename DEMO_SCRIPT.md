# CoachLab: three-minute demo

Use the live site: https://coachlab-q2ck.onrender.com

## Before class

- Open the site several minutes early so the Render service is awake. Confirm the latest deployment is healthy and sign in privately before sharing your screen. Do not show passwords, Render environment settings or Neon connection strings.
- Rehearse on your phone. Swipe the discipline navigation to reach every discipline; check that the page itself does not scroll sideways.
- Prepare one generic approved Adults lesson as a fallback. Use invented class details only, never children's names, contact information, medical details or other personal athlete information.
- Try one Kids draft and one Adults Beginner draft ahead of time. Check that all five section times add up and each section has numbered cues, common mistakes and easier/harder options. Coach review is essential: prompt rules and automated structure checks cannot guarantee model accuracy or safety.
- Check saving, refresh, editing, logout/login, media playback/source fallbacks and account isolation before inviting classmates. Use only a disposable lesson if demonstrating deletion.
- Keep DEMO_SCRIPT.md, PROMPT_LOG.md and CODE_WALKTHROUGH.md ready in separate editor tabs. Close private terminals and notification panels.
- Do not run npm start on your PC for this presentation: it is the production entry point and runs remote migrations when configured. Use the deployed site; local PostgreSQL development needs its own reviewed additive migration before using the new audience field. Do not improvise a reset or copy production credentials into local files.

## 0:00–0:25 — Introduce it

“CoachLab helps a coach turn a class idea into a lesson they can actually follow at the gym. I built it for planning sessions across boxing, Muay Thai, Brazilian Jiu-Jitsu, wrestling, MMA and personal training. The coach stays in charge of what gets taught.”

Point to the discipline navigation. Choose Boxing and show the audience filter. Explain that Kids and Adults are class categories, not profiles of individual children. Existing lessons are Unspecified until a coach edits that choice.

## 0:25–1:10 — Generate and review a draft

Choose AI lesson draft, Boxing, Kids, Beginner and 30 minutes. Leave optional details blank or enter “Footwork and balance games, no contact.” Confirm the request contains no personal information, then Generate draft.

“React is the part I click on. It sends my generic class request to an Express server. That server keeps the AI key private and asks Gemini for a structured draft. For Kids we use conservative rules: no hard sparring, head contact, submissions or chokes, with short drills, games, breaks and praise. Beginners of any age also have no hard sparring.”

If generation is slow or a quota error appears, show the prepared approved lesson instead. Say honestly that the provider is unavailable; manual planning and saved lessons still work. Do not repeatedly retry during the talk.

## 1:10–1:50 — Coach approval and saving

Show the five timed sections. Point to numbered teaching cues, common mistakes, and easier/harder options. Change one generic coaching cue, keeping at least two numbered steps in that section. Confirm the total still matches 30 minutes.

“AI can make mistakes. I review and edit the plan before explicitly approving it. Nothing is saved just because I generated a draft.”

Approve and save only if the draft is appropriate. Show the Kids badge, section minutes and cues on the saved card. If using the fallback, edit that generic lesson and save changes rather than presenting it as newly generated.

## 1:50–2:20 — Persistence and media

Refresh the browser. Show that the lesson remains. Briefly open a reviewed picture/video or its source fallback if one is available; do not claim every external video always plays.

“The lesson is stored in PostgreSQL on Neon, not just in this browser. Express handles saving and loading through an API. Prisma is the tool the server uses to talk to the database. Media stays with its activity, and outside sources can sometimes be unavailable.”

## 2:20–3:00 — Explain control and learning

Open the prompt log and one small commit diff.

“I gave the coding agent specific tasks in order. I required reviewed diffs, small commits, serial tests and a passing build before each push. I also required explanations of the code. For example, when we added audience, old tests expected exactly nine lesson fields. The test failures exposed those outdated expectations, and we corrected them to include the new field without dropping the original data checks.”

“React renders components and keeps temporary form state. Express validates requests and checks account access. Neon stores the saved records. The AI provides drafts; the coach makes the decision.”

## One tiny live coding-agent change (after the walkthrough)

Allow extra time beyond the three-minute app tour for tests/build and deployment. This changes one visible heading only, with no database or API work.

Paste this prompt:

```text
In CoachLab only, read AGENTS.md and check Git status. Change the dashboard heading in client/src/App.jsx from “Your lesson plans” to “Your coaching plans”. Do not change behavior, styles, databases, secrets or other files except the required PROMPT_LOG.md and CODE_WALKTHROUGH.md updates. Show and explain the diff. Run npm test, then npm run build, one at a time, and stop on failure. Record actual results. Commit only these verified changes with the message “docs-ui: clarify coaching plans heading”. Do not push until I approve the reviewed commit; a push automatically deploys to Render.
```

In PowerShell, start in the correct project:

```powershell
Set-Location 'C:\Users\barri\OneDrive\Desktop\Next Chapter Projects\CoachLab'
git status --short --branch
```

If there are unexpected changes, stop and identify them. Never discard somebody else's work. After the agent edits, review:

```powershell
git diff -- client/src/App.jsx PROMPT_LOG.md CODE_WALKTHROUGH.md
git diff --check
```

Explain: “The minus line is the old heading; the plus line is the replacement. The h2 tag is a section heading. We changed its text, not how lessons are stored or loaded.” Check that the heading's ID and surrounding JSX remain unchanged and the walkthrough matches the current lines.

Run these separately, waiting for each to finish successfully:

```powershell
npm test
npm run build
```

A failed command means stop, fix and retest—do not push. After reviewing the staged changes, the agent can commit (do not run a duplicate commit if it already did):

```powershell
git add client/src/App.jsx PROMPT_LOG.md CODE_WALKTHROUGH.md
git diff --cached --check
git diff --cached
git commit -m "docs-ui: clarify coaching plans heading"
git status --short --branch
```

For the optional live deployment, explicitly approve the push. Check for remote changes first:

```powershell
git fetch origin
git merge-base --is-ancestor origin/main HEAD
```

Continue only if the second command exits successfully (PowerShell: $LASTEXITCODE is 0). Otherwise stop and reconcile remote changes; never force-push. Then:

```powershell
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

The two hashes should match. Wait for Render's new deployment to finish, refresh the live site, and show the changed heading plus a saved lesson. Explain that a Git commit records the reviewed change, GitHub keeps the history, and Render builds and runs the pushed version. A successful push alone does not prove a deployment succeeded.

If a deployment fails, stop changes, preserve data and inspect its safe startup error. Do not reset the database or force-push. The preceding working code and additive audience migration remain in history.
