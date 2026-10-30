// Backs up and assigns selected legacy ownerless lessons only after explicit confirmation.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// Lessons that existed before accounts have no owner and nobody can see them. This module lets the person who controls the
// computer and the database (the only proof of ownership CoachLab can check) hand chosen lessons to one registered coach.

export const defaultBackupRoot = path.join(homedir(), 'CoachLab-backups');

// Rejects OneDrive backup paths so cloud sync cannot interfere with the backup.
export function assertSafeBackupDirectory(directory) {
  const resolved = path.resolve(directory);
  if (resolved.split(path.sep).some(part => /^onedrive(?:\s|$)/i.test(part))) throw new Error('Backups must be stored outside OneDrive.');
  return resolved;
}

// Provides owner-claim operations with bound SQLite values.
export function sqliteClaimStore(database) {
  return {
    // Looks up the registered destination coach before any ownership change.
    findUser: email => database.prepare('SELECT id, name, email FROM user WHERE email = ?').get(email.trim().toLowerCase()) || null,
    // Lists only ownerless legacy lessons eligible for an explicit claim.
    unclaimed: () => database.prepare('SELECT l.id, l.title, l.discipline, l.created_at, (SELECT count(*) FROM lesson_media m WHERE m.lesson_id = l.id) AS media FROM lessons l WHERE l.owner_id IS NULL ORDER BY l.id').all(),
    // Copies the selected ownerless lesson data for the pre-change backup.
    snapshot: ids => ({
      lessons: database.prepare(`SELECT * FROM lessons WHERE owner_id IS NULL AND id IN (${ids.map(() => '?').join(',')})`).all(...ids),
      media: database.prepare(`SELECT * FROM lesson_media WHERE owner_id IS NULL AND lesson_id IN (${ids.map(() => '?').join(',')})`).all(...ids).map(row => ({ ...row, data: row.data ? Buffer.from(row.data).toString('base64') : null })),
    }),
    claim: database.transaction((userId, ids) => {
      const marks = ids.map(() => '?').join(',');
      const lessons = database.prepare(`UPDATE lessons SET owner_id = ? WHERE owner_id IS NULL AND id IN (${marks})`).run(userId, ...ids).changes;
      const media = database.prepare(`UPDATE lesson_media SET owner_id = ? WHERE owner_id IS NULL AND lesson_id IN (${marks})`).run(userId, ...ids).changes;
      return { lessons, media };
    }),
    // Counts records now belonging to the destination coach to verify the claim.
    owned: (userId, ids) => database.prepare(`SELECT count(*) AS n FROM lessons WHERE owner_id = ? AND id IN (${ids.map(() => '?').join(',')})`).get(userId, ...ids).n,
  };
}

// Provides the same explicit owner-claim workflow through Prisma.
export function prismaClaimStore(client) {
  return {
    // Looks up the registered destination coach before any ownership change.
    findUser: async email => await client.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, name: true, email: true } }),
    // Lists only ownerless legacy lessons eligible for an explicit claim.
    unclaimed: async () => (await client.lesson.findMany({ where: { owner_id: null }, orderBy: { id: 'asc' }, select: { id: true, title: true, discipline: true, created_at: true, _count: { select: { media: true } } } })).map(row => ({ id: row.id, title: row.title, discipline: row.discipline, created_at: row.created_at.toISOString(), media: row._count.media })),
    // Copies the selected ownerless lesson data for the pre-change backup.
    snapshot: async ids => ({
      lessons: (await client.lesson.findMany({ where: { owner_id: null, id: { in: ids } } })).map(row => ({ ...row, created_at: row.created_at.toISOString() })),
      media: (await client.lessonMedia.findMany({ where: { owner_id: null, lesson_id: { in: ids } } })).map(row => ({ ...row, created_at: row.created_at.toISOString(), data: row.data ? Buffer.from(row.data).toString('base64') : null })),
    }),
    // Assigns the selected ownerless lessons and media together in a transaction.
    claim: (userId, ids) => client.$transaction(async tx => ({
      lessons: (await tx.lesson.updateMany({ where: { owner_id: null, id: { in: ids } }, data: { owner_id: userId } })).count,
      media: (await tx.lessonMedia.updateMany({ where: { owner_id: null, lesson_id: { in: ids } }, data: { owner_id: userId } })).count,
    }), { timeout: 30000 }),
    // Counts records now belonging to the destination coach to verify the claim.
    owned: (userId, ids) => client.lesson.count({ where: { owner_id: userId, id: { in: ids } } }),
  };
}

// Defaults to a dry run and verifies a backup before assigning selected ownerless lessons.
export async function claimLessons({ store, email, lessonIds, allUnclaimed = false, confirm = false, backupRoot = defaultBackupRoot, now = () => new Date(), log = () => {} }) {
  if (!email) throw new Error('Give the registered coach’s email with --email.');
  if (!allUnclaimed && !lessonIds?.length) throw new Error('Choose the lessons to claim with --lessons 8,9 or use --all-unclaimed.');
  const user = await store.findUser(email);
  if (!user) throw new Error('No registered coach has that email. Register (and sign in once) in CoachLab first.');
  const available = await store.unclaimed();
  const chosen = allUnclaimed ? available : available.filter(lesson => lessonIds.includes(lesson.id));
  const missing = (lessonIds || []).filter(id => !available.some(lesson => lesson.id === id));
  if (missing.length) throw new Error(`Lesson${missing.length > 1 ? 's' : ''} ${missing.join(', ')} not found among unclaimed lessons (already owned or missing). Nothing was changed.`);
  log(`Coach: ${user.name} <${user.email}>`);
  log(`Unclaimed lessons to hand over (${chosen.length}):`);
  for (const lesson of chosen) log(`  #${lesson.id}  ${lesson.title}  [${lesson.discipline}, ${lesson.media} attachment${lesson.media === 1 ? '' : 's'}, created ${lesson.created_at}]`);
  if (!chosen.length) return { changed: false, claimed: 0, reason: 'Nothing to claim.' };
  if (!confirm) { log('Dry run: nothing was changed. Run again with --confirm to hand these lessons to this coach.'); return { changed: false, claimed: 0, dryRun: true, lessons: chosen }; }
  const ids = chosen.map(lesson => lesson.id);
  const directory = path.join(assertSafeBackupDirectory(backupRoot), `claim-${now().toISOString().replace(/[:.]/g, '-')}`);
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'claimed-lessons-before.json');
  const snapshot = await store.snapshot(ids);
  writeFileSync(file, JSON.stringify({ takenAt: now().toISOString(), coach: user, ...snapshot }, null, 1));
  const reread = JSON.parse(readFileSync(file, 'utf8'));
  if (reread.lessons.length !== ids.length) throw new Error('The backup could not be verified, so nothing was changed.');
  log(`Backup written and verified: ${file}`);
  const result = await store.claim(user.id, ids);
  const verified = await store.owned(user.id, ids);
  if (verified !== ids.length || result.lessons !== ids.length) throw new Error(`Verification failed: expected ${ids.length} lessons, found ${verified}. Restore from ${file}.`);
  log(`Done: ${result.lessons} lesson${result.lessons === 1 ? '' : 's'} and ${result.media} attachment${result.media === 1 ? '' : 's'} now belong to ${user.email}.`);
  return { changed: true, claimed: result.lessons, media: result.media, backup: file };
}
