// Registers signed-in class routes after the application's authentication and origin guards.
import { classContextValid, validateClass, validateLevels, validClassDate } from '../client/src/classes.js';
import { ClassError } from './class-store.js';
import { progressionRequest, todayInNewYork } from './class-progression.js';
import { AiError } from './ai-provider.js';
import { validateLesson } from './validate-lesson.js';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const lessonId = value => Number.isInteger(value) && value > 0 && value <= 2147483647;
export function registerClassRoutes(app, store, generate) {
  // SQLite stays available for lessons; this PostgreSQL-only feature never triggers a fallback.
  const run = action => async (req, res, next) => {
    if (!store) return res.status(503).json({ error: 'Classes require the PostgreSQL configuration. Existing lessons still work.' });
    try { await action(req, res); } catch (error) { if (error instanceof ClassError) res.status(error.status).json({ error: error.message }); else next(error); }
  };
  const reject = (res, error) => res.status(400).json({ error });
  app.get('/api/classes', run(async (req, res) => res.json(await store.list(req.user.id))));
  app.get('/api/class-ladder', run(async (req, res) => {
    if (!classContextValid(req.query)) return reject(res, 'Choose a discipline and audience.');
    res.json(await store.getLadder(req.user.id, req.query.discipline, req.query.audience));
  }));
  app.put('/api/class-ladder', run(async (req, res) => {
    const body = req.body;
    if (!classContextValid(body) || !Number.isInteger(body.revision) || body.revision < 0) return reject(res, 'Choose a valid ladder and revision.');
    const error = validateLevels(body.levels); if (error) return reject(res, error);
    res.json(await store.saveLadder(req.user.id, body.discipline, body.audience, body.levels, body.revision));
  }));
  // Shared create/update validation ignores no unknown fields and never accepts an owner ID.
  const save = update => run(async (req, res) => {
    const error = validateClass(req.body); if (error) return reject(res, error);
    if (update && !uuid(req.params.classId)) return reject(res, 'Invalid class ID.');
    res.status(update ? 200 : 201).json(await store.save(req.user.id, update ? req.params.classId : null, req.body));
  });
  app.post('/api/classes', save(false));
  app.put('/api/classes/:classId', save(true));
  app.patch('/api/classes/:classId', run(async (req, res) => {
    if (!uuid(req.params.classId) || typeof req.body?.archived !== 'boolean' || Object.keys(req.body).length !== 1) return reject(res, 'Send an archive choice.');
    res.json(await store.archive(req.user.id, req.params.classId, req.body.archived));
  }));
  app.post('/api/class-assignments', run(async (req, res) => {
    const body = req.body;
    if (body?.progression !== undefined && typeof body.progression !== 'boolean') return reject(res, 'Invalid progression choice.');
    if (!process.env.NODE_TEST_CONTEXT) console.info('Class assignment: request_received');
    if (!Array.isArray(body?.class_ids) || body.class_ids.length < 1 || body.class_ids.length > 50 || new Set(body.class_ids).size !== body.class_ids.length || !body.class_ids.every(uuid) || !lessonId(body.lesson_id) || !validClassDate(body.scheduled_date ?? null)) { if (!process.env.NODE_TEST_CONTEXT) console.info('Class assignment: validation_rejected'); return reject(res, 'Choose 1–50 classes, a saved lesson and an optional valid date.'); }
    try {
      const result = await store.assign(req.user.id, body.class_ids, body.lesson_id, body.scheduled_date ?? null);
      if (!process.env.NODE_TEST_CONTEXT) console.info('Class assignment: saved');
      // Adding a lesson opts into one next-day progression; editing a date does not.
      const messages = [];
      if (body.progression && body.class_ids.length > 3) messages.push('All selected classes received the original lesson. Automatic progression checks up to three classes per addition; add to the remaining classes individually to request theirs.');
      if (body.progression) for (const id of body.class_ids.slice(0, 3)) {
        try {
          const plan = await store.prepareProgression(req.user.id, id, body.lesson_id, todayInNewYork());
          if (!plan) continue;
          const { request, context } = progressionRequest(plan);
          const { lesson } = await generate(request, context);
          lesson.coaching_notes = lesson.coaching_notes.replace('AI-assisted draft reviewed and approved by coach.', 'Automatically generated progression — coach review required before teaching.').replace('Students: 2', 'Class size unknown; adapt group sizes before teaching.');
          if (validateLesson(lesson).error || Buffer.byteLength(JSON.stringify(lesson)) > 32000) throw new AiError(502, 'Progression was too large to save.');
          const saved = await store.saveProgression(req.user.id, plan, lesson);
          if (saved.generated) messages.push('Next class lesson created. Coach review required.');
        } catch (error) {
          messages.push('Original lesson is assigned. Progression was not created: ' + (error instanceof AiError || error instanceof ClassError ? error.message : 'Please try adding it again later.'));
        }
      }
      res.json({ ...result, progression_messages: messages });
    } catch (error) {
      if (!process.env.NODE_TEST_CONTEXT) console.info(error instanceof ClassError ? 'Class assignment: ownership_or_state_rejected' : 'Class assignment: database_failed');
      throw error;
    }
  }));
  app.delete('/api/classes/:classId/lessons/:lessonId', run(async (req, res) => {
    if (!uuid(req.params.classId) || !/^\d+$/.test(req.params.lessonId) || !lessonId(Number(req.params.lessonId))) return reject(res, 'Invalid class or lesson ID.');
    await store.unassign(req.user.id, req.params.classId, Number(req.params.lessonId)); res.status(204).end();
  }));
}
