// Checks lesson ui behavior with controlled fixtures; read each test name for its expected outcome.
import { disciplineNavigation, filterLessons, timelineEntries } from '../client/src/lesson-view.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { activityBlocks, activityMinutes, joinActivities, moveActivity } from '../client/src/activities.js';
import { lessonMedia, mediaCatalog } from '../client/src/lesson-media.js';
import { disciplines, validateRequest } from '../client/src/lesson-draft.js';
import { readFileSync } from 'node:fs';
import { groupMedia, headingOf } from '../client/src/media.js';

test('activity editing preserves cues and supports removal, insertion and bounded reordering', () => {
  const original = 'Warm-up — 5 minutes\nWalk slowly.\nKeep balance.\n\nDrill — 10 minutes\nPractice.';
  const items = activityBlocks(original);
  assert.equal(items.join('\n\n'), original);
  assert.deepEqual(moveActivity(items, 0, 1), [items[1], items[0]]);
  assert.deepEqual(moveActivity(items, 0, -1), items);
  assert.deepEqual(items, activityBlocks(original));
  assert.deepEqual(activityBlocks(''), []);
  assert.deepEqual(activityBlocks([...items.slice(1), 'Cooldown'].join('\n\n')), [items[1], 'Cooldown']);
});

test('card text keeps blank lines out of a card and activity minutes are summed from headings', () => {
  assert.equal(joinActivities(['Warm-up — 5 minutes\n\n\nWalk', '', 'Drill — 10 min\nGo']), 'Warm-up — 5 minutes\nWalk\n\n\n\nDrill — 10 min\nGo');
  assert.deepEqual(activityBlocks(joinActivities(['a\n\nb', 'c'])), ['a\nb', 'c']);
  assert.equal(activityMinutes('Warm-up — 5 minutes\nWalk 20 minutes\n\nDrill — 10 min\nGo\n\nNo time here\n\nRest: 1 minute'), 16);
  assert.equal(activityMinutes(''), 0);
});

test('lesson cards place each attachment under the first activity with its heading and collect the rest', () => {
  const blocks = activityBlocks('Warm-up — 5 minutes\nJog\n\nDrill — 10 minutes\nSnap\n\nDrill — 10 minutes\nAgain');
  assert.equal(headingOf(blocks[1]), 'Drill — 10 minutes');
  const media = [{ id: 1, activity: 'Drill — 10 minutes' }, { id: 2, activity: 'Warm-up — 5 minutes' }, { id: 3, activity: '' }, { id: 4, activity: 'Removed activity' }, { id: 5, activity: 'Drill — 10 minutes' }];
  const { byBlock, rest } = groupMedia(media, blocks);
  assert.deepEqual([...byBlock].map(([index, items]) => [index, items.map(item => item.id)]), [[1, [1, 5]], [0, [2]]]);
  assert.deepEqual(rest.map(item => item.id), [3, 4]);
});

test('media fields are detached from the lesson form so Enter can never save the lesson without a pending attachment', () => {
  const source = readFileSync(new URL('../client/src/MediaEditor.jsx', import.meta.url), 'utf8');
  const fields = source.match(/<(input|select)\b[^>]*>/g) || [];
  assert.ok(fields.length >= 5);
  for (const field of fields) assert.ok(field.includes('form={detached}'), field.slice(0, 60));
  assert.match(source, /const detached = 'coachlab-media-fields'/);
  const forms = readFileSync(new URL('../client/src/LessonForm.jsx', import.meta.url), 'utf8') + readFileSync(new URL('../client/src/AiLessonForm.jsx', import.meta.url), 'utf8');
  assert.ok(!forms.includes('id="coachlab-media-fields"'));
  assert.ok(forms.includes('registry.count()'));
});

test('minimal AI requests work for every discipline; optional details remain bounded', () => {
  const request = { skill_level: 'Beginner', duration_minutes: 60, students: 2, privacy_confirmed: true };
  for (const discipline of disciplines) assert.equal(validateRequest({ ...request, discipline }), null);
  assert.ok(validateRequest({ ...request, discipline: 'Boxing', equipment: 42 }));
  assert.ok(validateRequest({ ...request, discipline: 'Boxing', objective: 'x'.repeat(501) }));
});

test('media matches both discipline and technique with an empty safe fallback', () => {
  for (const [discipline, title] of [['Boxing', 'Jab'], ['Muay Thai', 'Jab'], ['MMA', 'Double leg'], ['Wrestling', 'Double-leg'], ['Brazilian Jiu-Jitsu', 'Kimura'], ['Personal Training', 'Squat']]) assert.equal(lessonMedia({ discipline, title }).length, 1);
  assert.deepEqual(lessonMedia({ discipline: 'Boxing', title: 'Kimura' }), []);
  assert.deepEqual(lessonMedia({ discipline: 'MMA', title: 'Uncatalogued technique' }), []);
  for (const item of mediaCatalog) for (const field of ['source', 'image', item.video ? 'video' : 'videoPage']) assert.equal(new URL(item[field]).protocol, 'https:');
});

test('dashboard filters combine discipline and audience without hiding legacy unspecified lessons', () => {
  const lessons = [{ id: 1, discipline: 'Boxing', audience: 'Kids' }, { id: 2, discipline: 'Boxing', audience: 'Adults' }, { id: 3, discipline: 'MMA' }];
  assert.deepEqual(filterLessons(lessons, 'Kids', 'Boxing').map(row => row.id), [1]);
  assert.deepEqual(filterLessons(lessons, 'Unspecified', 'All').map(row => row.id), [3]);
  assert.deepEqual(filterLessons(lessons, 'All', 'All'), lessons);
  assert.deepEqual(filterLessons(lessons, 'Adults', 'MMA'), []);
  assert.deepEqual([...disciplineNavigation].sort(), [...disciplines].sort());
});

test('timeline separates minutes from cues and preserves media block indices and untimed text', () => {
  const blocks = ['Techniques: Footwork', 'Warm-up — 5 minutes\n1. Walk.\n2. Pause.', 'Drill: 10 min\nStay balanced.', 'Cooldown — 3 minutes\nRelax.'];
  const timeline = timelineEntries(blocks);
  assert.deepEqual(timeline.map(row => row.index), [0, 1, 2, 3]);
  assert.equal(timeline[0].cues, blocks[0]);
  assert.equal(timeline[0].minutes, null);
  assert.deepEqual(timeline[1], { index: 1, title: 'Warm-up', minutes: 5, cues: '1. Walk.\n2. Pause.' });
  assert.equal(timeline[2].minutes, 10);
  assert.equal(timeline[3].title, 'Cooldown');
});

// Owner dashboard cards must reuse existing Fitness values and lightweight local assets.
test('discipline cards map Fitness shortcuts without introducing new disciplines', async () => {
  const { disciplineCards } = await import('../client/src/discipline-pages.js');
  const { statSync } = await import('node:fs');
  assert.equal(disciplineCards.length, 7);
  for (const card of disciplineCards) assert.ok(statSync(new URL('../client/public/images/' + card.image + '.webp', import.meta.url)).size < 200000);
  assert.equal(disciplineCards.find(card => card.title === 'Personal Training').classType, 'Personal training');
  assert.equal(disciplineCards.find(card => card.title === 'Fitness').discipline, 'Fitness');
  const { filterLessons } = await import('../client/src/lesson-view.js');
  const rows = [{ discipline: 'Fitness', class_type: 'Personal training' }, { discipline: 'Fitness', class_type: 'Yoga' }, { discipline: 'Personal Training' }];
  assert.deepEqual(filterLessons(rows, 'All', 'Fitness', 'Group classes'), [rows[1]]);
  assert.deepEqual(filterLessons(rows, 'All', 'Personal Training'), [rows[2]]);
});

// New-form defaults follow navigation without rewriting stored legacy records.
test('discipline page defaults preserve Fitness and legacy navigation', async () => {
  const { disciplineDefaults, disciplinePage } = await import('../client/src/discipline-pages.js');
  assert.deepEqual(disciplineDefaults('All', 'All'), {});
  assert.deepEqual(disciplineDefaults('MMA', 'All'), { discipline: 'MMA' });
  assert.equal(disciplineDefaults('Fitness', 'Personal training').class_type, 'Personal training');
  assert.equal(disciplineDefaults('Fitness', 'Group classes').class_format, 'Group class');
  assert.equal(disciplineDefaults('Fitness', 'Group classes').class_type, '');
  assert.equal(disciplinePage('Fitness', 'Group classes').image, 'classes');
  assert.equal(disciplinePage('Personal Training', 'All').discipline, 'Personal Training');
});

test('Personal Training shortcut includes legacy and Fitness records without changing them', () => {
  const rows = [{ id: 1, discipline: 'Personal Training', audience: 'Adults' }, { id: 2, discipline: 'Fitness', class_type: 'Personal training', audience: 'Adults' }, { id: 3, discipline: 'Fitness', class_type: 'Yoga' }, { id: 4, discipline: 'Boxing' }];
  const before = structuredClone(rows);
  assert.deepEqual(filterLessons(rows, 'All', 'Fitness', 'Personal training'), rows.slice(0, 2));
  assert.deepEqual(filterLessons(rows, 'Kids', 'Fitness', 'Personal training'), []);
  assert.deepEqual(filterLessons(rows, 'All', 'Fitness', 'Group classes'), [rows[2]]);
  assert.deepEqual(filterLessons(rows, 'All', 'All'), rows);
  assert.deepEqual(rows, before);
  const navigation = readFileSync(new URL('../client/src/DisciplineHeader.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(navigation, /All Fitness|Legacy Personal Training/);
});
