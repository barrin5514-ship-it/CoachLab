export function sqliteLessons(database) {
  const list = database.prepare('SELECT * FROM lessons ORDER BY created_at DESC, id DESC');
  const find = database.prepare('SELECT * FROM lessons WHERE id = ?');
  const insert = database.prepare(`INSERT INTO lessons
    (title, discipline, skill_level, duration_minutes, goal, drills, coaching_notes)
    VALUES (@title, @discipline, @skill_level, @duration_minutes, @goal, @drills, @coaching_notes)`);
  const create = database.transaction(lesson => {
    const result = insert.run(lesson);
    return find.get(result.lastInsertRowid);
  });
  const update = database.transaction((id, lesson) => {
    const result = database.prepare('UPDATE lessons SET title=@title, discipline=@discipline, skill_level=@skill_level, duration_minutes=@duration_minutes, goal=@goal, drills=@drills, coaching_notes=@coaching_notes WHERE id=@id').run({ ...lesson, id });
    return result.changes ? find.get(id) : null;
  });
  const remove = id => database.prepare('DELETE FROM lessons WHERE id=?').run(id).changes > 0;
  return { list: () => list.all(), create, update, remove };
}

export function prismaLessons(client) {
  const serialize = row => ({ ...row, created_at: row.created_at.toISOString() });
  return {
    list: async () => (await client.lesson.findMany({ orderBy: [{ created_at: 'desc' }, { id: 'desc' }] })).map(serialize),
    create: async lesson => serialize(await client.lesson.create({ data: lesson })),
    update: async (id, lesson) => {
      try { return serialize(await client.lesson.update({ where: { id }, data: lesson })); }
      catch (error) { if (error.code === 'P2025') return null; throw error; }
    },
    remove: async id => (await client.lesson.deleteMany({ where: { id } })).count > 0,
  };
}
