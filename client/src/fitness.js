// Shares optional Fitness choices and checks without changing legacy Personal Training records.
export const fitnessClassTypes = ['Personal training', 'Cardio kickboxing', 'Boxing fitness (non-contact)', 'Zumba / dance fitness', 'Rebounding (mini trampoline)', 'Bootcamp', 'HIIT', 'Circuit / strength', 'Spin / cycling', 'Yoga', 'Pilates', 'Other'];
export const fitnessFormats = ['One-on-one', 'Small group', 'Group class'];
export const fitnessKeys = ['class_type', 'class_type_other', 'class_format'];
export const emptyFitness = { class_type: '', class_type_other: '', class_format: '' };
// Reject unsupported choices and hidden stale values; omitted fields remain valid for older clients.
export function validateFitness(value) {
  for (const key of fitnessKeys) if (value[key] != null && typeof value[key] !== 'string') return 'Fitness fields must be text.';
  const type = value.class_type || '', other = value.class_type_other || '', format = value.class_format || '';
  if (value.discipline !== 'Fitness') return type || other || format ? 'Class type and format apply only to Fitness.' : null;
  if (type && !fitnessClassTypes.includes(type)) return 'Choose a supported Fitness class type.';
  if (format && !fitnessFormats.includes(format)) return 'Choose One-on-one, Small group, or Group class.';
  if (other.length > 40 || /[\r\n]/.test(other)) return 'Other class type must be one line of at most 40 characters.';
  if (type === 'Other' && !other.trim()) return 'Describe the Other class type in up to 40 characters.';
  if (type !== 'Other' && other.trim()) return 'Custom class text is only allowed for Other.';
  return null;
}
// Normalize optional PostgreSQL fields; changing away from Fitness clears stale metadata on explicit save.
export function fitnessFields(value) {
  return Object.fromEntries(fitnessKeys.map(key => [key, value.discipline === 'Fitness' ? value[key]?.trim() || null : null]));
}
// Use the coach's short custom label when Other is selected.
export const fitnessLabel = lesson => lesson.class_type === 'Other' ? lesson.class_type_other || 'Other' : lesson.class_type || '';
// Guide the provider without claiming that generated exercises are medically safe.
export function fitnessGuidance(request) {
  if (request.discipline !== 'Fitness') return '';
  return `Fitness class type: ${fitnessLabel(request) || 'General fitness'}. Format: ${request.class_format || 'Unspecified'}.
No medical claims, diagnoses or promises of injury prevention. Give low-impact options and beginner pacing; adapt to skill and audience.
For cardio kickboxing and boxing fitness: NO-CONTACT, no sparring and no hitting another person. For dance fitness and kickboxing, include simple music/tempo cues without requiring copyrighted songs.
Respect available equipment: rebounders/mini trampolines, bikes, mats or weights only when available; offer practical alternatives and explain safe setup without assuming readiness.
Group class and Small group formats need short demonstrations and cues the whole room can follow. One-on-one can personalize pace and options using generic goals, never personal or medical details.
Keep the same five timed sections. Partner exercises may use zero minutes and a solo alternative; never invent contact drills just to fill that section. Keep all audience safety rules.`;
}
