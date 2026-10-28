const disciplines = ['Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training'];
const levels = ['Beginner', 'Intermediate', 'Advanced'];
const textLimits = { title: 200, goal: 2000, drills: 10000, coaching_notes: 10000 };
const fields = [...Object.keys(textLimits), 'discipline', 'skill_level', 'duration_minutes', 'audience'];

export function validateLesson(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Send a JSON object containing lesson fields.' };
  }
  if (Object.keys(body).some(field => !fields.includes(field))) {
    return { error: 'The request contains unsupported lesson fields.' };
  }
  const lesson = {};
  for (const [field, limit] of Object.entries(textLimits)) {
    const value = body[field] === undefined && field !== 'title' ? '' : body[field];
    if (typeof value !== 'string' || value.length > limit) {
      return { error: `${field} must be text with at most ${limit} characters.` };
    }
    lesson[field] = value.trim();
  }
  if (!lesson.title) return { error: 'Title is required and cannot be blank.' };
  if (!disciplines.includes(body.discipline)) return { error: 'Choose a supported discipline.' };
  lesson.discipline = body.discipline;
  lesson.audience = body.audience === undefined ? 'Unspecified' : body.audience;
  if (!['Kids', 'Adults', 'Unspecified'].includes(lesson.audience)) return { error: 'Choose Kids, Adults, or Unspecified.' };
  lesson.skill_level = body.skill_level === undefined ? 'Beginner' : body.skill_level;
  if (!levels.includes(lesson.skill_level)) return { error: 'Choose Beginner, Intermediate, or Advanced.' };
  lesson.duration_minutes = body.duration_minutes === undefined ? null : body.duration_minutes;
  if (lesson.duration_minutes !== null && (!Number.isInteger(lesson.duration_minutes) || lesson.duration_minutes < 1 || lesson.duration_minutes > 1440)) {
    return { error: 'Duration must be a whole number from 1 to 1440 minutes, or null.' };
  }
  return { lesson };
}
