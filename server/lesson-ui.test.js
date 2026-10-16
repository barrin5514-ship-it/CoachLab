import test from 'node:test';
import assert from 'node:assert/strict';
import { activityBlocks, activityMinutes, joinActivities, moveActivity } from '../client/src/activities.js';
import { lessonMedia, mediaCatalog } from '../client/src/lesson-media.js';
import { disciplines, validateRequest } from '../client/src/lesson-draft.js';
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
