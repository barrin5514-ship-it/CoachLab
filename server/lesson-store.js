export class MediaReferenceError extends Error {}

const publicColumns = 'id, lesson_id, position, kind, origin, url, title, activity, mime, size_bytes, credit, source_page, created_at';
const publicSelect = { id: true, lesson_id: true, position: true, kind: true, origin: true, url: true, title: true, activity: true, mime: true, size_bytes: true, credit: true, source_page: true, created_at: true };
const missingMedia = () => new MediaReferenceError('An attached picture or video no longer exists. Remove it and add it again.');

export function sqliteLessons(database) {
  database.pragma('foreign_keys = ON');
  const list = database.prepare('SELECT * FROM lessons ORDER BY created_at DESC, id DESC');
  const find = database.prepare('SELECT * FROM lessons WHERE id = ?');
  const insert = database.prepare(`INSERT INTO lessons
    (title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes)
    VALUES (@title, @discipline, @skill_level, @duration_minutes, @goal, @drills, @coaching_notes)`);
  const attachedIds = database.prepare('SELECT id FROM lesson_media WHERE lesson_id = ?');
  const findMedia = database.prepare('SELECT id, lesson_id FROM lesson_media WHERE id = ?');
  const claim = database.prepare('UPDATE lesson_media SET lesson_id=@lessonId, position=@position, title=@title, activity=@activity WHERE id=@id');
  const addLink = database.prepare(`INSERT INTO lesson_media (lesson_id, position, kind, origin, url, title, activity, credit, source_page)
    VALUES (@lessonId, @position, @kind, @origin, @url, @title, @activity, @credit, @source_page)`);
  const dropMedia = database.prepare('DELETE FROM lesson_media WHERE id = ?');
  function attach(lessonId, items) {
    const before = attachedIds.all(lessonId).map(row => row.id);
    const keep = new Set();
    items.forEach((item, position) => {
      if (item.id) {
        const row = findMedia.get(item.id);
        if (!row || (row.lesson_id !== null && row.lesson_id !== lessonId)) throw missingMedia();
        claim.run({ lessonId, position, title: item.title, activity: item.activity, id: item.id });
        keep.add(item.id);
      } else {
        keep.add(Number(addLink.run({ lessonId, position, kind: item.kind, origin: item.origin, url: item.url, title: item.title, activity: item.activity, credit: item.credit || '', source_page: item.source_page || null }).lastInsertRowid));
      }
    });
    for (const id of before) if (!keep.has(id)) dropMedia.run(id);
  }
  const create = database.transaction((lesson, media) => {
    const result = insert.run(lesson);
    if (media) attach(Number(result.lastInsertRowid), media);
    return find.get(result.lastInsertRowid);
  });
  const update = database.transaction((id, lesson, media) => {
    const result = database.prepare('UPDATE lessons SET title=@title, discipline=@discipline, skill_level=@skill_level, duration_minutes=@duration_minutes, goal=@goal, drills=@drills, coaching_notes=@coaching_notes WHERE id=@id').run({ ...lesson, id });
    if (!result.changes) return null;
    if (media) attach(id, media);
    return find.get(id);
  });
  const remove = database.transaction(id => {
    database.prepare('DELETE FROM lesson_media WHERE lesson_id=?').run(id);
    return database.prepare('DELETE FROM lessons WHERE id=?').run(id).changes > 0;
  });
  const media = {
    list: () => database.prepare(`SELECT ${publicColumns} FROM lesson_media WHERE lesson_id IS NOT NULL ORDER BY lesson_id, position, id`).all(),
    addUpload: ({ kind, mime, title, data }) => {
      const id = database.prepare('INSERT INTO lesson_media (kind, origin, title, mime, size_bytes, data) VALUES (?, ?, ?, ?, ?, ?)').run(kind, 'upload', title, mime, data.length, data).lastInsertRowid;
      return database.prepare(`SELECT ${publicColumns} FROM lesson_media WHERE id = ?`).get(id);
    },
    getFile: id => database.prepare("SELECT mime, data FROM lesson_media WHERE id = ? AND origin = 'upload'").get(id) || null,
    removeOrphan: id => database.prepare("DELETE FROM lesson_media WHERE id = ? AND lesson_id IS NULL AND origin = 'upload'").run(id).changes > 0,
    purgeOrphans: maxAgeMs => database.prepare('DELETE FROM lesson_media WHERE lesson_id IS NULL AND created_at < ?').run(new Date(Date.now() - maxAgeMs).toISOString()).changes,
  };
  return { list: () => list.all(), create, update, remove, media };
}

export function prismaLessons(client) {
  const serialize = row => ({ ...row, created_at: row.created_at.toISOString() });
  const serializeMedia = row => ({ ...row, created_at: row.created_at.toISOString() });
  async function attach(tx, lessonId, items) {
    const before = (await tx.lessonMedia.findMany({ where: { lesson_id: lessonId }, select: { id: true } })).map(row => row.id);
    const keep = new Set();
    for (const [position, item] of items.entries()) {
      if (item.id) {
        const row = await tx.lessonMedia.findUnique({ where: { id: item.id }, select: { lesson_id: true } });
        if (!row || (row.lesson_id !== null && row.lesson_id !== lessonId)) throw missingMedia();
        await tx.lessonMedia.update({ where: { id: item.id }, data: { lesson_id: lessonId, position, title: item.title, activity: item.activity } });
        keep.add(item.id);
      } else {
        const created = await tx.lessonMedia.create({ data: { lesson_id: lessonId, position, kind: item.kind, origin: item.origin, url: item.url, title: item.title, activity: item.activity, credit: item.credit || '', source_page: item.source_page || null }, select: { id: true } });
        keep.add(created.id);
      }
    }
    const stale = before.filter(id => !keep.has(id));
    if (stale.length) await tx.lessonMedia.deleteMany({ where: { id: { in: stale } } });
  }
  const transaction = work => client.$transaction(work, { timeout: 30000, maxWait: 10000 });
  return {
    list: async () => (await client.lesson.findMany({ orderBy: [{ created_at: 'desc' }, { id: 'desc' }] })).map(serialize),
    create: (lesson, media) => transaction(async tx => {
      const created = await tx.lesson.create({ data: lesson });
      if (media) await attach(tx, created.id, media);
      return serialize(created);
    }),
    update: (id, lesson, media) => transaction(async tx => {
      let updated;
      try { updated = await tx.lesson.update({ where: { id }, data: lesson }); }
      catch (error) { if (error.code === 'P2025') return null; throw error; }
      if (media) await attach(tx, id, media);
      return serialize(updated);
    }),
    remove: async id => (await client.lesson.deleteMany({ where: { id } })).count > 0,
    media: {
      list: async () => (await client.lessonMedia.findMany({ where: { lesson_id: { not: null } }, orderBy: [{ lesson_id: 'asc' }, { position: 'asc' }, { id: 'asc' }], select: publicSelect })).map(serializeMedia),
      addUpload: async ({ kind, mime, title, data }) => serializeMedia(await client.lessonMedia.create({ data: { kind, origin: 'upload', title, mime, size_bytes: data.length, data }, select: publicSelect })),
      getFile: async id => {
        const row = await client.lessonMedia.findFirst({ where: { id, origin: 'upload' }, select: { mime: true, data: true } });
        return row ? { mime: row.mime, data: Buffer.from(row.data) } : null;
      },
      removeOrphan: async id => (await client.lessonMedia.deleteMany({ where: { id, lesson_id: null, origin: 'upload' } })).count > 0,
      purgeOrphans: async maxAgeMs => (await client.lessonMedia.deleteMany({ where: { lesson_id: null, created_at: { lt: new Date(Date.now() - maxAgeMs) } } })).count,
    },
  };
}
