// Maps only the owner's supplied photographs to existing discipline filters.
export const disciplineCards = [
  { title: 'Boxing', discipline: 'Boxing', image: 'boxing', description: 'Footwork, technique and controlled practice' },
  { title: 'Muay Thai', discipline: 'Muay Thai', image: 'muay-thai', description: 'Movement, combinations and coaching cues' },
  { title: 'Brazilian Jiu-Jitsu', discipline: 'Brazilian Jiu-Jitsu', image: 'bjj', description: 'Positions, progression and partner drills' },
  { title: 'Wrestling', discipline: 'Wrestling', image: 'wrestling', description: 'Positioning, movement and control' },
  { title: 'MMA', discipline: 'MMA', image: 'mma', description: 'Striking, grappling and transitions' },
  { title: 'Personal Training', discipline: 'Fitness', classType: 'Personal training', image: 'personal-training', description: 'Strength, conditioning and individual coaching' },
  { title: 'Classes', discipline: 'Fitness', classType: 'Group classes', image: 'classes', description: 'Cardio, dance, strength and group fitness' },
];
// Uses the same photo/filter mapping for page headings and new-form defaults.
export function disciplinePage(discipline, classType) {
  if (discipline === 'All') return null;
  if (discipline === 'Personal Training') return { ...disciplineCards[5], title: 'Personal Training (legacy)', discipline };
  if (discipline === 'Fitness') return { ...disciplineCards[classType === 'Personal training' ? 5 : 6], title: classType === 'All' ? 'Fitness' : classType === 'Group classes' ? 'Classes' : classType };
  return disciplineCards.find(card => card.discipline === discipline) || { title: discipline, discipline };
}
// Prefill only new lessons; existing lessons always supply their own stored values.
export function disciplineDefaults(discipline, classType) {
  if (discipline === 'All') return {};
  if (discipline === 'Personal Training') return { discipline: 'Fitness', class_type: 'Personal training', class_format: 'One-on-one' };
  if (discipline !== 'Fitness') return { discipline };
  return { discipline, class_type: ['All', 'Group classes', 'Unspecified'].includes(classType) ? '' : classType, class_format: classType === 'Personal training' ? 'One-on-one' : classType === 'Group classes' ? 'Group class' : '' };
}
