// Validates AI lesson requests and replies before returning an unsaved draft.
import { validateRequest, validateDraft, toLesson, normalizeDraftSteps } from '../client/src/lesson-draft.js';
import { validateLesson } from './validate-lesson.js';
import { reconcileDraftTiming } from './ai-timing.js';
import { generateDraft, AiError } from './ai-provider.js';

// Registers draft generation with validation and its own bounded request allowance.
export function createDraftGenerator({ provider = generateDraft, now = Date.now } = {}) {
  let busy = false;
  let attempts = [];
  // Manual drafts and class progressions share the same provider allowance.
  return async (body, context) => {
    const error = validateRequest(body);
    if (error) throw new AiError(400, error);
    const time = now();
    attempts = attempts.filter(start => time - start < 86400000);
    // These draft counters are in memory and reset at restart; manual lessons do not depend on this allowance.
    if (busy || attempts.length >= 20 || attempts.filter(start => time - start < 60000).length >= 3) throw new AiError(429, 'AI request limit reached. Try later; manual lessons still work.');
    attempts.push(time);
    busy = true;
    try {
      const draft = reconcileDraftTiming(normalizeDraftSteps(await provider(body, undefined, context)), body);
      // AI output is untrusted: validate the complete structure and timing before showing a draft.
      const invalid = validateDraft(draft, body);
      if (invalid) throw new AiError(502, `AI draft failed validation: ${invalid} Please try again.`);
      const lesson = toLesson(draft, body);
      if (validateLesson(lesson).error || Buffer.byteLength(JSON.stringify(lesson)) > 32000) throw new AiError(502, 'AI lesson is too large to save. Try a simpler request.');
      return { draft, lesson };
    } catch (failure) {
      throw failure instanceof AiError ? failure : new AiError(502, 'AI generation failed. Manual lessons still work.');
    } finally {
      busy = false;
    }
  };
}

// The manual route still returns an unsaved draft for explicit coach approval.
export function registerAiRoute(app, options = {}) {
  const generate = options.generate || createDraftGenerator(options);
  app.post('/api/ai/lesson-draft', async (request, response) => {
    if (!request.is('application/json')) return response.status(400).json({ error: 'Send Content-Type: application/json.' });
    try { const result = await generate(request.body); response.json({ draft: result.draft }); }
    catch (error) { response.status(error instanceof AiError ? error.status : 502).json({ error: error instanceof AiError ? error.message : 'AI generation failed. Manual lessons still work.' }); }
  });
}
