// Shares class setup rules and editable coaching suggestions between browser and server.
import { disciplines } from './lesson-draft.js';
import { validateFitness } from './fitness.js';
export const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// These are planning suggestions, not belt-awarding or athlete-readiness standards.
export function defaultLevels(discipline, audience) {
  const names = discipline === 'Brazilian Jiu-Jitsu' ? (audience === 'Kids' ? ['White', 'Grey', 'Yellow', 'Orange', 'Green'] : ['White', 'Blue', 'Purple', 'Brown', 'Black']) : ['Beginner', 'Intermediate', 'Advanced', 'Competition-ready'];
  const basics = { Boxing: 'Practice stance, guard and footwork', 'Muay Thai': 'Practice balanced stance and controlled pad movement', Wrestling: 'Practice stance and safe level changes', MMA: 'Practice controlled transitions without hard sparring', Fitness: 'Practice low-impact movement and equipment setup', 'Personal Training': 'Practice controlled basic movement', 'Brazilian Jiu-Jitsu': audience === 'Kids' ? 'Practice safe mat movement and positional games without submissions' : 'Practice safe mat movement and positional control' };
  return names.map((name, index) => ({ id: 'level-' + index, name, skills: index === 0 ? ['Follow stop signals', basics[discipline] || 'Practice basic movement with control'] : ['Review earlier skills', 'Demonstrate controlled combinations', 'Explain safe practice choices'] }));
}
export const classContextValid = value => disciplines.includes(value?.discipline) && ['Kids', 'Adults'].includes(value?.audience);
// Reject invalid schedules and personal details are discouraged by the form; no athlete records exist.
export function validateClass(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Send class details.';
  if (Object.keys(value).some(key => !['name', 'discipline', 'audience', 'days', 'days_per_week', 'goal', 'current_level', 'class_type', 'class_type_other', 'class_format'].includes(key))) return 'Unsupported class field.';
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100) return 'Use a class name of 1–100 characters.';
  if (!classContextValid(value)) return 'Choose a discipline and Kids or Adults.';
  if (!Array.isArray(value.days) || !Number.isInteger(value.days_per_week) || value.days_per_week < 1 || value.days_per_week > 7 || value.days.length !== value.days_per_week || new Set(value.days).size !== value.days.length || value.days.some(day => !weekdays.includes(day))) return 'Choose distinct days matching days per week (1–7).';
  if (typeof value.goal !== 'string' || value.goal.length > 500) return 'Keep the goal within 500 characters.';
  if (typeof value.current_level !== 'string' || !value.current_level || value.current_level.length > 80) return 'Choose a current level.';
  return validateFitness(value);
}
// Stable level IDs keep renames and reordering from changing a class's progress.
export function validateLevels(levels) {
  if (!Array.isArray(levels) || levels.length < 1 || levels.length > 30) return 'Use 1–30 levels.';
  if (levels.some(level => !level || typeof level.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(level.id) || typeof level.name !== 'string' || !level.name.trim() || level.name.length > 60 || !Array.isArray(level.skills) || level.skills.length > 20 || level.skills.some(skill => typeof skill !== 'string' || !skill.trim() || skill.length > 200))) return 'Each level needs a name (up to 60 characters) and up to 20 short skills (200 characters each).';
  if (new Set(levels.map(level => level.id)).size !== levels.length) return 'Level IDs must be distinct.';
  return null;
}
// Date-only strings avoid accidental timezone shifts in class assignments.
export function validClassDate(value) {
  return value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1900 && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
}
