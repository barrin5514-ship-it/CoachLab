// Validates AI lesson requests and replies before returning an unsaved draft.
import { validateRequest, validateDraft, toLesson } from '../client/src/lesson-draft.js';
import { validateLesson } from './validate-lesson.js';
import { reconcileDraftTiming } from './ai-timing.js';
import { generateDraft, AiError } from './ai-provider.js';

// Registers draft generation with validation and its own bounded request allowance.
export function registerAiRoute(app, { provider = generateDraft, now = Date.now } = {}) {
  let busy = false;
  let attempts = [];
  // Returns an unsaved, validated draft; coach approval is required elsewhere to persist it.
  app.post('/api/ai/lesson-draft', async (request, response) => {
    if (!request.is('application/json')) return response.status(400).json({ error: 'Send Content-Type: application/json.' });
    const error = validateRequest(request.body);
    if (error) return response.status(400).json({ error });
    const time = now();
    attempts = attempts.filter(start => time - start < 86400000);
    // These draft counters are in memory and reset at restart; manual lessons do not depend on this allowance.
    if (busy || attempts.length >= 20 || attempts.filter(start => time - start < 60000).length >= 3) return response.status(429).json({ error: 'AI request limit reached. Try later; manual lessons still work.' });
    attempts.push(time);
    busy = true;
    try {
      const draft = reconcileDraftTiming(await provider(request.body), request.body);
      // AI output is untrusted: validate the complete structure and timing before showing a draft.
      const invalid = validateDraft(draft, request.body);
      if (invalid) throw new AiError(502, `AI draft failed validation: ${invalid} Please try again.`);
      const lesson = toLesson(draft, request.body);
      if (validateLesson(lesson).error || Buffer.byteLength(JSON.stringify(lesson)) > 32000) throw new AiError(502, 'AI lesson is too large to save. Try a simpler request.');
      response.json({ draft });
    } catch (failure) {
      response.status(failure instanceof AiError ? failure.status : 502).json({ error: failure instanceof AiError ? failure.message : 'AI generation failed. Manual lessons still work.' });
    } finally {
      busy = false;
    }
  });
}
