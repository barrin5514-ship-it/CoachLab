// Allocates a predictable lesson schedule and repairs only small timing differences.
import { sections, validateDraft } from '../client/src/lesson-draft.js';

// Splits requested minutes across five sections so the provider gets explicit targets.
export function sectionSchedule(duration) {
  const minutes = [0.15, 0.25, 0.30, 0.20].map(share => Math.floor(duration * share));
  minutes.push(duration - minutes.reduce((sum, value) => sum + value, 0));
  return sections.map((name, index) => ({ name, minutes: minutes[index] }));
}

// Repairs only a small timing mismatch; larger or malformed results must still fail validation.
export function reconcileDraftTiming(draft, request) {
  if (!Array.isArray(draft?.sections) || draft.sections.some(section => !Number.isInteger(section?.minutes))) return draft;
  const total = draft.sections.reduce((sum, section) => sum + section.minutes, 0);
  const difference = request.duration_minutes - total;
  if (!difference || Math.abs(difference) > Math.min(2, request.duration_minutes * 0.05)) return draft;
  if (validateDraft(draft, { ...request, duration_minutes: total })) return draft;
  const longest = draft.sections.reduce((best, section, index, items) => section.minutes > items[best].minutes ? index : best, 0);
  const corrected = { ...draft, sections: draft.sections.map((section, index) => index === longest ? { ...section, minutes: section.minutes + difference } : section) };
  return validateDraft(corrected, request) ? draft : corrected;
}
