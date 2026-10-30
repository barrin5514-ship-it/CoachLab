# CoachLab — eight-minute spoken demo

Live site: https://coachlab-q2ck.onrender.com

## Short pre-demo checklist

- Open the site **one minute early** to wake it; allow longer if needed.
- Be logged in before sharing your screen. Keep account details and notifications hidden.
- Have your phone ready, already signed into the same account on the live site.
- Have one reviewed, saved demo lesson ready, with safe instructional videos attached.
- Use generic class details only. No real children's names, contact details or personal data.
- Open the coding agent in CoachLab, with a clean Git status and dependencies ready. Keep the small prompt below ready to paste. Do not open .env or private settings.
- Rehearse with a timer. These are actions to perform during the talk, not claims that this demo has already run.

**Timing:** 1 + 4 + 1 + 1 + 1 = **8 minutes**, including normal clicks and short waits. Read only the **Say** lines aloud. Use a backup line instead of the normal line if needed, not as extra speech. Keep AI waits to about 15 seconds; then show the saved example. Allow up to one extra minute for the coding check, keeping the talk within 10 minutes. A fast rehearsal can fit 5–6 minutes by shortening pauses and showing the saved example sooner.

## 1. Intro and problem — 0:00–1:00

**Click:** Open the dashboard on the live site.

**Say:**

“Hi, this is CoachLab. I coach kids' boxing and adult MMA. Planning a class takes time. I need to think about the goal, the warm-up, the drills and how to explain each movement.

“I wanted one place to plan that work, find useful videos and keep lessons I can use again. That is why I built CoachLab.

“The aim is to save planning time, while keeping me in charge. AI can suggest a starting point, but I still check what is right for the class. A plan for children needs different language and activities from a plan for adults.

“I'll show the app, explain how it works, and show how I use coding agents to build it.”

**Backup:** “The live site is waking up. I have a saved example ready, so I can still explain the class-planning flow.”

## 2. Live tour — 1:00–5:00

### Dashboard and disciplines — 1:00–1:20

**Click:** Show the saved lesson cards. Choose **Boxing**, then **MMA**, then **Dashboard**.

**Say:** “This is my dashboard. My saved lessons are here. I can choose a discipline, so I can find a boxing plan or an MMA plan without mixing everything together. I can also filter by audience.”

**Backup:** “If the page is slow, this saved card shows the same idea: each plan has a discipline and class details.”

### Fitness classes — 1:20–1:40

**Click:** Choose **All Fitness** or a Fitness card. Show **Personal training** and **Boxing fitness (non-contact)** among the choices.

**Say:** “CoachLab also covers Fitness classes. That includes personal training and non-contact boxing fitness. The class type helps describe what I am planning. It does not mean every fitness class needs the same lesson.”

**Backup:** “I can show these Fitness choices in the lesson form if there are no saved classes here yet.”

### Create a lesson — 1:40–2:05

**Click:** Choose **+ New Lesson**. Show title, discipline, audience and activity fields. Use the generic title **Boxing balance and hooks**. Cancel this unsaved form before opening the AI form.

**Say:** “I can write a lesson myself. I choose the class details, add the activities and write my coaching notes. I do not have to use AI. I'll cancel this example and show the draft option.”

**Backup:** “If a form does not open, the saved lesson shows the fields I would fill in. I will not refresh while a save is still running.”

### AI draft for Kids, review and save — 2:05–3:05

**Click:** Choose **AI lesson draft**. Select **Boxing**, **Kids**, **Beginner**, **30 minutes**. Enter **Balance and hook technique, non-contact games** as the goal. Confirm no personal information, then **Generate draft**. Review the timed sections and safety notes. Edit a cue if needed. Only if suitable, check the review approval and choose **Approve and save lesson**.

**Say:** “Here I give AI a small, generic class brief. Kids is an audience choice, not a record about an individual child.

“The draft breaks the class into timed parts. I look at the teaching steps, common mistakes and easier options. For kids, I want short, non-contact activities, breaks and clear instructions.

“I check the whole draft before approving it. AI can be wrong. Generating a draft is not the same as saving an approved lesson.”

**Backup:** “AI is slow or unavailable, so I will show this prepared lesson. It was saved earlier; I am not claiming it was generated just now. I still review every suggestion.”

### Suggest videos and multi-select — 3:05–3:40

**Click:** On the saved lesson, choose **Suggest videos**. Review the titles and sources. Select two suitable available suggestions using their checkboxes. Choose **Add selected** to open the edit flow; review where they attach, then save. If fewer than two suitable suggestions appear, show the prepared attachments instead.

**Say:** “Suggest videos helps me find a demonstration. I can select more than one, instead of attaching each in a separate search. I still check the source and whether it fits the class. A suggested video is not automatically a safe or suitable lesson.”

**Backup:** “The video search has a limit, or the source is unavailable. These saved attachments show the result. I will not keep retrying or attach an unsuitable video just for the demo.”

### Coaching chat — 3:40–4:15

**Click:** Open **Coach chat**. Ask exactly: **How do I explain a left hook to a seven-year-old?** Read a short part of the actual answer; do not promise what it will say.

**Say:** “I can also ask a coaching question in plain words. Here I am asking how to explain a left hook to a seven-year-old. That is generic class context, with no child's name.

“I check the answer for clear, age-appropriate, non-contact guidance. The chat is read-only. It can explain, but it cannot change my saved lesson.”

**Backup:** “Chat is unavailable right now. I will use my reviewed coaching notes. I would not treat an unchecked AI answer as an instruction to use with a child.”

### Refresh and persistence — 4:15–4:40

**Click:** Close chat. Wait for saving to finish. Refresh the browser and find the lesson again. Briefly point to **Edit lesson**.

**Say:** “Now I will refresh. The lesson is still here because it was saved to the database, not just held on this screen. I can open it later and edit it when my class needs change.”

**Backup:** “If loading fails, I will not say the save worked. The prepared saved lesson demonstrates the normal flow, and I can check this attempt afterward.”

### Open on my phone — 4:40–5:00

**Click:** On the phone, open the live site in the already signed-in browser. Refresh and locate the same lesson. Hold it up or show its screen.

**Say:** “Here is the same saved plan on my phone. I can prepare at my desk and open it at the gym, using the same account.”

**Backup:** “The phone connection is slow. I prepared this signed-in view earlier, but I cannot confirm a fresh load right now.”

## 3. How it is built — 5:00–6:00

**Click:** Keep the saved lesson visible; point to its form, saved content and video area. Do not open service accounts or private settings.

**Say:** “React builds the screen I click on. It handles the forms and shows the lesson cards.

“Express is the server behind the screen. It checks requests and makes sure I am signed in before letting me use my lessons.

“Neon PostgreSQL is the database. It keeps saved lessons so they can load again, including on my phone.

“Render runs the site online, so I do not need my laptop running for someone to open it.

“Gemini supplies the AI drafts and chat answers. The YouTube API helps find videos. Those services give suggestions, not a guarantee that the content is correct or right for my class.”

**Backup:** “Even if a service is unavailable, these are their separate jobs. A page loading does not prove every outside service is working.”

## 4. How I built it — 6:00–7:00

**Click:** Show the prepared coding-agent prompt, submit it, and inspect the diff. Run tests then the build serially. Review the explanation and commit only after success. This is a future demo action; the script rewrite itself changes no application code.

**Say:** “I use ChatGPT and Claude to help write clear prompts. Codex builds the changes. I review the result and test it; I do not just accept everything.

“Here is a tiny example. I ask for one heading change. In the diff, the minus line is the old text and the plus line is the new text. I check that nothing else changed in the app.

“Next I run the tests and the build, one at a time. I ask the agent to explain the change. If both checks pass, I commit it. A commit is a named checkpoint I can review later.”

**Prepared prompt to paste, not read aloud:**

~~~text
Work only in CoachLab. Read AGENTS.md and check Git status. If there are unexpected edits, stop. In client/src/App.jsx change only the visible heading “Your lesson plans” to “Your coaching plans”. Keep its ID and behavior unchanged. Update the required prompt log and walkthrough. Show and explain the diff. Run npm test, then npm run build, serially; stop on failure. Review the staged files and commit only if both pass. Do not push, deploy, access databases, read .env, or modify other projects. If the heading already changed, stop rather than inventing another edit.
~~~

**Backup:** “The check is still running, so I will not commit an unverified change. This earlier reviewed diff shows the process. I will finish the live check after the talk.”

**Time guard:** Allow at most one extra minute here. Never claim pending tests passed. Do not wait for a live deployment; this demonstration ends at the verified local commit.

## 5. Limits and what is next — 7:00–8:00

**Click:** Return to the saved lesson on the live site.

**Say:** “There are limits. Password-reset email is not available yet. AI has a shared daily allowance, so a request can be refused when that allowance is used. The free hosting plan can sleep, which makes the first visit slow.

“The chat already has a per-user question limit, as well as a shared limit. Next I want clearer per-user AI allowances across the features, so one busy user does not use the shared allowance for everyone.

“I also want weekly lesson plans, so I can plan a sequence rather than one class at a time. Another next step is chat that can help edit a lesson, with my review and approval before anything is saved. That does not work today.

“For now, CoachLab gives me one place to plan, review and keep my classes. I still make the coaching decisions.”

**Backup:** “If the live page is unavailable, these limits and next steps still apply. I will separate what I demonstrated today from what I still need to build.”
