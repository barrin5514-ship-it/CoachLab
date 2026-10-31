// Chooses class dates without moving existing lessons or generating an entire program.
import { weekdays } from '../client/src/classes.js';
export const dateText = value => value instanceof Date ? value.toISOString().slice(0, 10) : value;
const shift = (day, count) => new Date(Date.parse(day + 'T12:00:00Z') + count * 86400000).toISOString().slice(0, 10);
const monday = day => shift(day, -((new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7));
// New York is the owner's agreed schedule timezone, independent of Render's timezone.
export const todayInNewYork = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function progressionDates(group, links, lessonId, today) {
  const source = links.find(link => link.lesson_id === lessonId);
  if (!source) return null;
  const days = group.days.map(day => weekdays.indexOf(day)).sort((a, b) => a - b);
  const existing = dateText(source.scheduled_date);
  let start = monday(existing || today);
  // An undated lesson starts a full upcoming schedule, not a partly elapsed week.
  if (!existing && shift(start, days[0]) < today) start = shift(start, 7);
  const dates = days.map(day => shift(start, day));
  const occupied = new Set(links.filter(link => link.lesson_id !== lessonId).map(link => dateText(link.scheduled_date)));
  const sourceDate = existing || dates.find(day => !occupied.has(day));
  if (!sourceDate) return null;
  const nextDate = dates.find(day => day > sourceDate);
  const count = links.filter(link => { const date = dateText(link.scheduled_date); return date && date >= start && date < shift(start, 7); }).length + (existing ? 0 : 1);
  return { sourceDate, nextDate: count < days.length && nextDate && !occupied.has(nextDate) ? nextDate : null };
}
// Keep the previous lesson as data, with class safety supplied by the fixed Gemini prompt.
export function progressionRequest(plan) {
  const { group, source } = plan;
  const level = group.levels.find(item => item.id === group.current_level);
  const request = { discipline: group.discipline, audience: group.audience, skill_level: ['Beginner', 'Intermediate', 'Advanced'].includes(level?.name) ? level.name : 'Beginner', duration_minutes: source.duration_minutes, students: 2, objective: group.goal.slice(0, 500), techniques: '', equipment: '', privacy_confirmed: true, class_type: group.class_type || '', class_type_other: group.class_type_other || '', class_format: group.class_format || '' };
  const context = { level: level?.name, skills: level?.skills, previous: { title: source.title, goal: source.goal, drills: source.drills }, next_day: plan.nextDate, guidance: 'Same skills, slightly harder coordination, plus one new piece. Class size and equipment are unknown: use adaptable groups and minimal equipment. Never add hard sparring or head contact for Kids.' };
  return { request, context };
}
