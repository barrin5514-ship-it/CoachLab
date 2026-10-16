import express from 'express';
import { sqliteLessons } from './lesson-store.js';
import { validateLesson } from './validate-lesson.js';
import { registerAiRoute } from './ai-route.js';

export function createApp(database, aiOptions) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  const lessons = typeof database.prepare === 'function' ? sqliteLessons(database) : database;

  app.get('/api/health', (request, response) => {
    response.json({ status: 'ok', service: 'CoachLab API' });
  });
  app.get('/api/lessons', async (request, response) => {
    response.json(await lessons.list());
  });
  app.post('/api/lessons', async (request, response) => {
    if (!request.is('application/json')) return response.status(400).json({ error: 'Send Content-Type: application/json.' });
    const result = validateLesson(request.body);
    if (result.error) return response.status(400).json({ error: result.error });
    response.status(201).json(await lessons.create(result.lesson));
  });
  app.param('id', (request, response, next, value) => {
    if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) return response.status(400).json({ error: 'Invalid lesson ID.' });
    request.lessonId = Number(value);
    next();
  });
  app.put('/api/lessons/:id', async (request, response) => {
    if (!request.is('application/json')) return response.status(400).json({ error: 'Send Content-Type: application/json.' });
    const result = validateLesson(request.body);
    if (result.error) return response.status(400).json({ error: result.error });
    const lesson = await lessons.update(request.lessonId, result.lesson);
    if (!lesson) return response.status(404).json({ error: 'Lesson no longer exists. Your edits have not been saved.' });
    response.json(lesson);
  });
  app.delete('/api/lessons/:id', async (request, response) => {
    if (!await lessons.remove(request.lessonId)) return response.status(404).json({ error: 'Lesson no longer exists.' });
    response.status(204).end();
  });
  registerAiRoute(app, aiOptions);
  app.use((request, response) => {
    response.status(404).json({ error: 'Route not found.' });
  });
  app.use((error, request, response, next) => {
    const status = [400, 413, 415].includes(error.status) ? error.status : 500;
    const messages = { 400: 'Request body must contain valid JSON.', 413: 'JSON request must not exceed 32 KB.', 415: 'Unsupported request encoding.', 500: 'Unexpected server error.' };
    response.status(status).json({ error: messages[status] });
  });
  return app;
}
