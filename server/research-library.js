// Owner-scoped imported research posts, with the same shape for SQLite and Prisma.
const columns = 'id, title, url, summary, transcript, discipline, drills, created_at';
export function sqliteResearchLibrary(database) {
  const list = database.prepare(`SELECT ${columns} FROM research_posts WHERE owner_id = ? ORDER BY created_at DESC, id DESC`);
  const add = (ownerId, post) => {
    if (database.prepare('SELECT 1 FROM research_posts WHERE owner_id = ? AND source_id = ?').get(ownerId, post.source_id)) return null;
    const result = database.prepare('INSERT INTO research_posts (owner_id, source_id, title, url, summary, transcript, discipline, drills) VALUES (@ownerId, @source_id, @title, @url, @summary, @transcript, @discipline, @drills)').run({ ownerId, ...post });
    return { id: Number(result.lastInsertRowid), ...post };
  };
  return { list: ownerId => list.all(ownerId), add, defaultOwner: () => { const rows = database.prepare('SELECT id FROM auth_users ORDER BY created_at LIMIT 2').all(); return rows.length === 1 ? rows[0].id : null; }, findUserByEmail: email => database.prepare('SELECT id FROM auth_users WHERE lower(email)=lower(?)').get(email)?.id || null, countUsers: () => database.prepare('SELECT COUNT(*) AS count FROM auth_users').get().count };
}
export function prismaResearchLibrary(client) {
  const serialize = ({ owner_id, source_id, ...row }) => ({ ...row, created_at: row.created_at.toISOString() });
  return {
    list: async ownerId => (await client.researchPost.findMany({ where: { owner_id: ownerId }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] })).map(serialize),
    add: async (ownerId, post) => {
      const existing = await client.researchPost.findUnique({ where: { owner_id_source_id: { owner_id: ownerId, source_id: post.source_id } } });
      if (existing) return null;
      return serialize(await client.researchPost.create({ data: { owner_id: ownerId, ...post } }));
    },
    defaultOwner: async () => { const rows = await client.user.findMany({ take: 2, select: { id: true } }); return rows.length === 1 ? rows[0].id : null; },
    findUserByEmail: async email => (await client.user.findUnique({ where: { email }, select: { id: true } }))?.id || null,
    countUsers: async () => client.user.count()
  };
}
