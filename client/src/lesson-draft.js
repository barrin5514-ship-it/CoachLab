// Shares AI input, draft-shape and safety rules between the browser and server.
import { validateFitness, fitnessFields, fitnessGuidance } from './fitness.js';
export const disciplines = ['Boxing', 'Wrestling', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'MMA', 'Personal Training', 'Fitness'];
export const newDisciplines = disciplines.filter(value => value !== 'Personal Training');
export const audiences = ['Unspecified', 'Kids', 'Adults'];
export const sectionGuidance = [['common_mistakes', 'Common mistakes'], ['easier', 'Easier option'], ['harder', 'Harder option']];
// Uses conservative guidance for Kids and unspecified audiences without collecting children's details.
export function safetyGuidance(request) {
  const rules = ['Coach review required. Use consent, stop signals and appropriate supervision.'];
  if (request.audience !== 'Adults') rules.push('Kids or unspecified audience: no hard sparring, no head contact, no submissions or chokes. Use short drills, games, frequent breaks and praise. Age is not collected, so use these conservative rules for all Kids classes.');
  if (request.skill_level === 'Beginner') rules.push('Beginner rule at every age: no hard sparring.');
  if (request.discipline === 'Fitness') rules.push(fitnessGuidance(request));
  return rules.join('\n');
}
export const levels = ['Beginner', 'Intermediate', 'Advanced'];
export const sections = ['Warm-up', 'Technique teaching', 'Progressive drills', 'Partner exercises', 'Cooldown'];
export const details = ['techniques', 'common_mistakes', 'coaching_corrections', 'modifications', 'safety'];
export const labels = ['Techniques to teach', 'Common mistakes', 'Coaching corrections', 'Skill-level modifications', 'Safety considerations'];
// Checks text type and size before it can reach later code.
const text = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
// Rejects null and arrays where a plain request object is expected.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Bounds AI inputs and requires the coach's privacy confirmation.
export function validateRequest(value) {
  if (!object(value)) return 'Send a lesson request object.';
  const allowed = ['discipline', 'skill_level', 'duration_minutes', 'students', 'objective', 'techniques', 'equipment', 'privacy_confirmed', 'audience', 'class_type', 'class_type_other', 'class_format'];
  if (Object.keys(value).some(key => !allowed.includes(key))) return 'Unsupported request fields.';
  if (value.audience !== undefined && !audiences.includes(value.audience)) return 'Choose Kids, Adults, or Unspecified.';
  if (!disciplines.includes(value.discipline) || !levels.includes(value.skill_level)) return 'Choose a supported discipline and skill level.';
  if (!Number.isInteger(value.duration_minutes) || value.duration_minutes < 15 || value.duration_minutes > 180) return 'Choose 15–180 whole minutes.';
  if (!Number.isInteger(value.students) || value.students < 1 || value.students > 100) return 'Choose 1–100 students.';
  if (['objective', 'techniques', 'equipment'].some(key => value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 500))) return 'Optional instructions must be text up to 500 characters.';
  const fitnessError = validateFitness(value);
  if (fitnessError) return fitnessError;
  if (value.privacy_confirmed !== true) return 'Confirm that the request contains no personal or sensitive athlete information.';
  return null;
}

// Checks structure, coaching cues and exact timing before an AI draft is accepted.
export function validateDraft(draft, request) {
  if (!object(draft) || !text(draft.title, 200) || !text(draft.objectives, 1500)) return 'The draft needs a title and training objectives.';
  if (details.some(key => !text(draft[key], 1000))) return 'Every coaching guidance field requires 1–1000 characters.';
  if (!Array.isArray(draft.sections) || draft.sections.length !== sections.length) return 'The draft needs all five timed sections.';
  for (const [index, section] of draft.sections.entries()) {
    if (!object(section) || section.name !== sections[index] || !text(section.instructions, 1000)) return 'Each timed section needs its expected name and instructions (up to 1000 characters).';
    if (sectionGuidance.some(([key]) => !text(section[key], 200))) return 'Each section needs common mistakes and easier/harder options (up to 200 characters each).';
    if ((section.instructions.match(/(?:^|\n)\s*\d+[.)]\s+/g) || []).length < 2) return 'Each section needs at least two numbered coaching steps.';
    if (!Number.isInteger(section.minutes) || section.minutes < (index === 3 ? 0 : 1) || section.minutes > 180) return 'Section times must be whole minutes; only partner exercises may use zero.';
  }
  if (draft.sections.reduce((sum, section) => sum + section.minutes, 0) !== request.duration_minutes) return 'Section times must add up to the requested class duration.';
  return null;
}

// Converts the approved structured draft into existing lesson fields, avoiding a second storage format.
export function toLesson(draft, request) {
  return {
    ...(request.discipline === 'Fitness' ? fitnessFields(request) : {}),
    audience: request.audience ?? 'Unspecified', title: draft.title, discipline: request.discipline, skill_level: request.skill_level, duration_minutes: request.duration_minutes,
    goal: draft.objectives,
    drills: `Techniques: ${draft.techniques}\n\n${draft.sections.map(section => `${section.name} — ${section.minutes} minutes\n${section.instructions}\n${sectionGuidance.map(([key, label]) => `${label}: ${section[key]}`).join('\n')}`).join('\n\n')}`,
    coaching_notes: `AI-assisted draft reviewed and approved by coach.\n${safetyGuidance(request)}\nStudents: ${request.students}\nEquipment: ${request.equipment?.trim() || 'AI recommendations are in Techniques; confirm availability.'}\n\n${details.slice(1).map((key, index) => `${labels[index + 1]}:\n${draft[key]}`).join('\n\n')}`,
  };
}
