import express from 'express';
import { validateLesson } from './validate-lesson.js';
import { registerAiRoute } from './ai-route.js';

export function createApp(database, aiOptions) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  const list = database.prepare('SELECT * FROM lessons ORDER BY created_at DESC, id DESC');
  const find = database.prepare('SELECT * FROM lessons WHERE id = ?');
  const insert = database.prepare(`INSERT INTO lessons
    (title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes)
    VALUES (@title, @discipline, @skill_level, @duration_minutes, @goal, @drills, @coaching_notes)`);
  const save = database.transaction(lesson => {
    const result = insert.run(lesson);
    return find.get(result.lastInsertRowid);
  });

  app.get('/api/health', (request, response) => {
    response.json({ status: 'ok', service: 'CoachLab API' });
  });
  app.get('/api/lessons', (request, response) => {
    response.json(list.all());
  });
  app.post('/api/lessons', (request, response) => {
    if (!request.is('application/json')) return response.status(400).json({ error: 'Send Content-Type: application/json.' });
    const result = validateLesson(request.body);
    if (result.error) return response.status(400).json({ error: result.error });
    response.status(201).json(save(result.lesson));
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
