// Gives SQLite and Prisma the same owner-scoped lesson and attachment operations.
export class MediaReferenceError extends Error {}

const lessonColumns = "id, title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes, created_at, COALESCE(audience, 'Unspecified') AS audience";
const publicColumns = 'id, lesson_id, position, kind, origin, url, title, activity, mime, size_bytes, credit, source_page, created_at';
const publicSelect = { id: true, lesson_id: true, position: true, kind: true, origin: true, url: true, title: true, activity: true, mime: true, size_bytes: true, credit: true, source_page: true, created_at: true };
// Returns a useful attachment error without revealing another owner's record.
const missingMedia = () => new MediaReferenceError('An attached picture or video no longer exists. Remove it and add it again.');

// Keeps SQLite values bound to prepared statements and scopes records to their owner.
export function sqliteLessons(database) {
  database.pragma('foreign_keys = ON');
  const list = database.prepare(`SELECT ${lessonColumns} FROM lessons WHERE owner_id = ? ORDER BY created_at DESC, id DESC`);
  const find = database.prepare(`SELECT ${lessonColumns} FROM lessons WHERE id = ?`);
  // Bind lesson values as parameters so text cannot become SQL commands.
  const insert = database.prepare(`INSERT INTO lessons
    (title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes, owner_id, audience)
    VALUES (@title, @discipline, @skill_level, @duration_minutes, @goal, @drills, @coaching_notes, @ownerId, @audience)`);
  const attachedIds = database.prepare('SELECT id FROM lesson_media WHERE lesson_id = ?');
  const findMedia = database.prepare('SELECT id, lesson_id, owner_id FROM lesson_media WHERE id = ?');
  const claim = database.prepare('UPDATE lesson_media SET lesson_id=@lessonId, position=@position, title=@title, activity=@activity WHERE id=@id');
  const addLink = database.prepare(`INSERT INTO lesson_media (lesson_id, owner_id, position, kind, origin, url, title, activity, credit, source_page)
    VALUES (@lessonId, @ownerId, @position, @kind, @origin, @url, @title, @activity, @credit, @source_page)`);
  const dropMedia = database.prepare('DELETE FROM lesson_media WHERE id = ?');
  // Verifies attachment ownership and updates the chosen set inside the enclosing lesson transaction.
  function attach(ownerId, lessonId, items) {
    const before = attachedIds.all(lessonId).map(row => row.id);
    const keep = new Set();
    items.forEach((item, position) => {
      if (item.id) {
        const row = findMedia.get(item.id);
        // Reject attachments from another owner or lesson before changing any saved media.
        if (!row || row.owner_id !== ownerId || (row.lesson_id !== null && row.lesson_id !== lessonId)) throw missingMedia();
        claim.run({ lessonId, position, title: item.title, activity: item.activity, id: item.id });
        keep.add(item.id);
      } else {
        keep.add(Number(addLink.run({ lessonId, ownerId, position, kind: item.kind, origin: item.origin, url: item.url, title: item.title, activity: item.activity, credit: item.credit || '', source_page: item.source_page || null }).lastInsertRowid));
      }
    });
    for (const id of before) if (!keep.has(id)) dropMedia.run(id);
  }
  // A failed attachment change must roll back the lesson write as well.
  const create = database.transaction((ownerId, lesson, media) => {
    const result = insert.run({ ...lesson, ownerId });
    if (media) attach(ownerId, Number(result.lastInsertRowid), media);
    return find.get(result.lastInsertRowid);
  });
  const update = database.transaction((ownerId, id, lesson, media) => {
    const result = database.prepare('UPDATE lessons SET title=@title, discipline=@discipline, skill_level=@skill_level, duration_minutes=@duration_minutes, goal=@goal, drills=@drills, coaching_notes=@coaching_notes, audience=@audience WHERE id=@id AND owner_id=@ownerId').run({ ...lesson, id, ownerId });
    if (!result.changes) return null;
    if (media) attach(ownerId, id, media);
    return find.get(id);
  });
  const remove = database.transaction((ownerId, id) => {
    if (!database.prepare('SELECT 1 FROM lessons WHERE id=? AND owner_id=?').get(id, ownerId)) return false;
    database.prepare('DELETE FROM lesson_media WHERE lesson_id=?').run(id);
    return database.prepare('DELETE FROM lessons WHERE id=? AND owner_id=?').run(id, ownerId).changes > 0;
  });
  const media = {
    // Lists only this owner's records, preventing one account from seeing another's data.
    list: ownerId => database.prepare(`SELECT ${publicColumns} FROM lesson_media WHERE owner_id = ? AND lesson_id IS NOT NULL ORDER BY lesson_id, position, id`).all(ownerId),
    // Stores an upload as pending until it is attached to a saved lesson.
    addUpload: (ownerId, { kind, mime, title, data }) => {
      const id = database.prepare('INSERT INTO lesson_media (owner_id, kind, origin, title, mime, size_bytes, data) VALUES (?, ?, ?, ?, ?, ?, ?)').run(ownerId, kind, 'upload', title, mime, data.length, data).lastInsertRowid;
      return database.prepare(`SELECT ${publicColumns} FROM lesson_media WHERE id = ?`).get(id);
    },
    // Returns upload bytes only when the requested file belongs to this owner.
    getFile: (ownerId, id) => database.prepare("SELECT mime, data FROM lesson_media WHERE id = ? AND owner_id = ? AND origin = 'upload'").get(id, ownerId) || null,
    // Deletes only a pending upload owned by the caller, not a saved lesson attachment.
    removeOrphan: (ownerId, id) => database.prepare("DELETE FROM lesson_media WHERE id = ? AND owner_id = ? AND lesson_id IS NULL AND origin = 'upload'").run(id, ownerId).changes > 0,
    // Removes old unattached uploads so abandoned drafts do not grow storage forever.
    purgeOrphans: maxAgeMs => database.prepare('DELETE FROM lesson_media WHERE lesson_id IS NULL AND created_at < ?').run(new Date(Date.now() - maxAgeMs).toISOString()).changes,
  };
  return { list: ownerId => list.all(ownerId), create, update, remove, media };
}

// Uses Prisma operations with the same ownership and atomic-save rules as SQLite.
export function prismaLessons(client) {
  // Converts database dates to API text and removes the internal owner field.
  const serialize = ({ owner_id, ...row }) => ({ ...row, audience: row.audience ?? 'Unspecified', created_at: row.created_at.toISOString() });
  // Converts attachment dates to API text without exposing the internal owner field.
  const serializeMedia = ({ owner_id, ...row }) => ({ ...row, created_at: row.created_at.toISOString() });
  // Verifies attachment ownership and updates the chosen set inside the enclosing lesson transaction.
  async function attach(tx, ownerId, lessonId, items) {
    const before = (await tx.lessonMedia.findMany({ where: { lesson_id: lessonId }, select: { id: true } })).map(row => row.id);
    const keep = new Set();
    for (const [position, item] of items.entries()) {
      if (item.id) {
        const row = await tx.lessonMedia.findUnique({ where: { id: item.id }, select: { lesson_id: true, owner_id: true } });
        // Reject attachments from another owner or lesson before changing any saved media.
        if (!row || row.owner_id !== ownerId || (row.lesson_id !== null && row.lesson_id !== lessonId)) throw missingMedia();
        await tx.lessonMedia.update({ where: { id: item.id }, data: { lesson_id: lessonId, position, title: item.title, activity: item.activity } });
        keep.add(item.id);
      } else {
        const created = await tx.lessonMedia.create({ data: { lesson_id: lessonId, owner_id: ownerId, position, kind: item.kind, origin: item.origin, url: item.url, title: item.title, activity: item.activity, credit: item.credit || '', source_page: item.source_page || null }, select: { id: true } });
        keep.add(created.id);
      }
    }
    const stale = before.filter(id => !keep.has(id));
    if (stale.length) await tx.lessonMedia.deleteMany({ where: { id: { in: stale } } });
  }
  // Bounds how long an atomic database operation can wait or run.
  const transaction = work => client.$transaction(work, { timeout: 30000, maxWait: 10000 });
  return {
    // Lists only this owner's records, preventing one account from seeing another's data.
    list: async ownerId => (await client.lesson.findMany({ where: { owner_id: ownerId }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] })).map(serialize),
    // Creates the lesson and its attachments together so a partial save cannot survive.
    create: (ownerId, lesson, media) => transaction(async tx => {
      const created = await tx.lesson.create({ data: { ...lesson, owner_id: ownerId } });
      if (media) await attach(tx, ownerId, created.id, media);
      return serialize(created);
    }),
    // Updates the cards and sends their combined text back to the parent form.
    update: (ownerId, id, lesson, media) => transaction(async tx => {
      let updated;
      try { updated = await tx.lesson.update({ where: { id, owner_id: ownerId }, data: lesson }); }
      catch (error) { if (error.code === 'P2025') return null; throw error; }
      if (media) await attach(tx, ownerId, id, media);
      return serialize(updated);
    }),
    // Removes the selected item only through this explicit handler.
    remove: (ownerId, id) => transaction(async tx => {
      if (!await tx.lesson.findFirst({ where: { id, owner_id: ownerId }, select: { id: true } })) return false;
      await tx.lessonMedia.deleteMany({ where: { lesson_id: id } });
      return (await tx.lesson.deleteMany({ where: { id, owner_id: ownerId } })).count > 0;
    }),
    media: {
      // Lists only this owner's records, preventing one account from seeing another's data.
      list: async ownerId => (await client.lessonMedia.findMany({ where: { owner_id: ownerId, lesson_id: { not: null } }, orderBy: [{ lesson_id: 'asc' }, { position: 'asc' }, { id: 'asc' }], select: publicSelect })).map(serializeMedia),
      // Stores an upload as pending until it is attached to a saved lesson.
      addUpload: async (ownerId, { kind, mime, title, data }) => serializeMedia(await client.lessonMedia.create({ data: { owner_id: ownerId, kind, origin: 'upload', title, mime, size_bytes: data.length, data }, select: publicSelect })),
      // Returns upload bytes only when the requested file belongs to this owner.
      getFile: async (ownerId, id) => {
        const row = await client.lessonMedia.findFirst({ where: { id, owner_id: ownerId, origin: 'upload' }, select: { mime: true, data: true } });
        return row ? { mime: row.mime, data: Buffer.from(row.data) } : null;
      },
      // Deletes only a pending upload owned by the caller, not a saved lesson attachment.
      removeOrphan: async (ownerId, id) => (await client.lessonMedia.deleteMany({ where: { id, owner_id: ownerId, lesson_id: null, origin: 'upload' } })).count > 0,
      // Removes old unattached uploads so abandoned drafts do not grow storage forever.
      purgeOrphans: async maxAgeMs => (await client.lessonMedia.deleteMany({ where: { lesson_id: null, created_at: { lt: new Date(Date.now() - maxAgeMs) } } })).count,
    },
  };
}
