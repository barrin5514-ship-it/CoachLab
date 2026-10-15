export const disciplines = ['Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training'];
export const levels = ['Beginner', 'Intermediate', 'Advanced'];
export const sections = ['Warm-up', 'Technique teaching', 'Progressive drills', 'Partner exercises', 'Cooldown'];
export const details = ['techniques', 'common_mistakes', 'coaching_corrections', 'modifications', 'safety'];
export const labels = ['Techniques to teach', 'Common mistakes', 'Coaching corrections', 'Skill-level modifications', 'Safety considerations'];
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateRequest(value) {
  if (!object(value)) return 'Send a lesson request object.';
  const allowed = ['discipline', 'skill_level', 'duration_minutes', 'students', 'objective', 'techniques', 'equipment', 'privacy_confirmed'];
  if (Object.keys(value).some(key => !allowed.includes(key))) return 'Unsupported request fields.';
  if (!disciplines.includes(value.discipline) || !levels.includes(value.skill_level)) return 'Choose a supported discipline and skill level.';
  if (!Number.isInteger(value.duration_minutes) || value.duration_minutes < 15 || value.duration_minutes > 180) return 'Choose 15–180 whole minutes.';
  if (!Number.isInteger(value.students) || value.students < 1 || value.students > 100) return 'Choose 1–100 students.';
  if (['objective', 'techniques', 'equipment'].some(key => !text(value[key], 500))) return 'Objective, techniques and equipment each require 1–500 characters. Write None if needed.';
  if (value.privacy_confirmed !== true) return 'Confirm that the request contains no personal or sensitive athlete information.';
  return null;
}

export function validateDraft(draft, request) {
  if (!object(draft) || !text(draft.title, 200) || !text(draft.objectives, 1500)) return 'The draft needs a title and training objectives.';
  if (details.some(key => !text(draft[key], 1000))) return 'Every coaching guidance field requires 1–1000 characters.';
  if (!Array.isArray(draft.sections) || draft.sections.length !== sections.length) return 'The draft needs all five timed sections.';
  for (const [index, section] of draft.sections.entries()) {
    if (!object(section) || section.name !== sections[index] || !text(section.instructions, 1500)) return 'Each timed section needs its expected name and instructions (up to 1500 characters).';
    if (!Number.isInteger(section.minutes) || section.minutes < (index === 3 ? 0 : 1) || section.minutes > 180) return 'Section times must be whole minutes; only partner exercises may use zero.';
  }
  if (draft.sections.reduce((sum, section) => sum + section.minutes, 0) !== request.duration_minutes) return 'Section times must add up to the requested class duration.';
  return null;
}

export function toLesson(draft, request) {
  return {
    title: draft.title, discipline: request.discipline, skill_level: request.skill_level, duration_minutes: request.duration_minutes,
    goal: draft.objectives,
    drills: `Techniques: ${draft.techniques}\n\n${draft.sections.map(section => `${section.name} — ${section.minutes} minutes\n${section.instructions}`).join('\n\n')}`,
    coaching_notes: `AI-assisted draft reviewed and approved by coach.\nStudents: ${request.students}\nEquipment: ${request.equipment}\n\n${details.slice(1).map((key, index) => `${labels[index + 1]}:\n${draft[key]}`).join('\n\n')}`,
  };
}
