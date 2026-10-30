// Builds dashboard filters and readable timelines from existing lesson fields.
export const disciplineNavigation = ['Boxing', 'Muay Thai', 'Brazilian Jiu-Jitsu', 'Wrestling', 'MMA', 'Fitness', 'Personal Training'];
// Combines discipline and audience filters without changing the saved list.
export function filterLessons(lessons, audience, discipline, classType = 'All') {
  return lessons.filter(lesson => (audience === 'All' || (lesson.audience ?? 'Unspecified') === audience) && (discipline === 'All' || lesson.discipline === discipline) && (discipline !== 'Fitness' || classType === 'All' || (classType === 'Group classes' ? !!lesson.class_type && lesson.class_type !== 'Personal training' : (lesson.class_type || 'Unspecified') === classType)));
}
// Separates heading, minutes and cues while preserving each activity's media index.
export function timelineEntries(blocks) {
  return blocks.map((block, index) => {
    const [heading, ...cues] = block.split('\n');
    const timed = heading.match(/^(.*?)\s*(?:—|–|-|:)\s*(\d{1,3})\s*(?:minutes?|mins?)\s*$/i);
    return { index, title: timed ? timed[1].trim() : 'Coaching cues', minutes: timed ? Number(timed[2]) : null, cues: timed ? cues.join('\n') : block };
  });
}
