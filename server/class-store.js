// Uses Prisma's parameterized SQL and transactions; class writes never rewrite lessons.
import { randomUUID } from 'node:crypto';
import { defaultLevels } from '../client/src/classes.js';
import { fitnessFields } from '../client/src/fitness.js';
export class ClassError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
// The locked ladder serializes edits with class saves, preserving referenced level IDs.
async function ladder(tx, owner, discipline, audience) {
  await tx.$executeRaw`INSERT INTO class_ladders (id, owner_id, discipline, audience, levels) VALUES (${randomUUID()}, ${owner}, ${discipline}, ${audience}, ${JSON.stringify(defaultLevels(discipline, audience))}::jsonb) ON CONFLICT (owner_id, discipline, audience) DO NOTHING`;
  const rows = await tx.$queryRaw`SELECT * FROM class_ladders WHERE owner_id = ${owner} AND discipline = ${discipline} AND audience = ${audience} FOR UPDATE`;
  return rows[0];
}
// Ownership is checked inside each transaction, not trusted from a browser-supplied ID.
async function ownedClass(tx, owner, id, active = false) {
  const rows = await tx.$queryRaw`SELECT * FROM coaching_classes WHERE id = ${id} AND owner_id = ${owner} FOR UPDATE`;
  if (!rows.length) throw new ClassError(404, 'Class not found.');
  if (active && rows[0].archived) throw new ClassError(409, 'Restore this class before assigning lessons.');
  return rows[0];
}
export function prismaClasses(client) {
  return {
    // Read defaults without writing until the coach saves a class or ladder.
    getLadder: async (owner, discipline, audience) => {
      const rows = await client.$queryRaw`SELECT * FROM class_ladders WHERE owner_id = ${owner} AND discipline = ${discipline} AND audience = ${audience}`;
      return rows[0] || { discipline, audience, levels: defaultLevels(discipline, audience), revision: 0 };
    },
    saveLadder: (owner, discipline, audience, levels, revision) => client.$transaction(async tx => {
      const existing = await ladder(tx, owner, discipline, audience);
      if (existing.revision !== revision && !(revision === 0 && existing.revision === 1 && JSON.stringify(existing.levels) === JSON.stringify(defaultLevels(discipline, audience)))) throw new ClassError(409, 'The ladder changed. Reload before saving.');
      const used = await tx.$queryRaw`SELECT current_level FROM coaching_classes WHERE ladder_id = ${existing.id} AND owner_id = ${owner}`;
      if (used.some(row => !levels.some(level => level.id === row.current_level))) throw new ClassError(409, 'A class still uses a removed level. Choose another current level for that class first, including archived classes.');
      const rows = await tx.$queryRaw`UPDATE class_ladders SET levels = ${JSON.stringify(levels)}::jsonb, revision = revision + 1 WHERE id = ${existing.id} AND owner_id = ${owner} RETURNING *`;
      return rows[0];
    }),
    list: owner => client.$queryRaw`SELECT c.*, jsonb_array_length(c.days) AS days_per_week, l.levels, COALESCE((SELECT jsonb_agg(jsonb_build_object('lesson_id', a.lesson_id, 'title', s.title, 'scheduled_date', a.scheduled_date) ORDER BY a.scheduled_date NULLS LAST, a.lesson_id) FROM class_lessons a JOIN lessons s ON s.id = a.lesson_id AND s.owner_id = ${owner} WHERE a.class_id = c.id), '[]'::jsonb) AS assignments FROM coaching_classes c JOIN class_ladders l ON l.id = c.ladder_id AND l.owner_id = ${owner} WHERE c.owner_id = ${owner} ORDER BY c.archived, c.name, c.id`,
    save: (owner, id, value) => client.$transaction(async tx => {
      const selected = await ladder(tx, owner, value.discipline, value.audience);
      if (!selected.levels.some(level => level.id === value.current_level)) throw new ClassError(409, 'That level changed. Reload the ladder and choose a current level.');
      const fields = fitnessFields(value);
      if (id) {
        await ownedClass(tx, owner, id);
        const rows = await tx.$queryRaw`UPDATE coaching_classes SET name = ${value.name.trim()}, discipline = ${value.discipline}, audience = ${value.audience}, ladder_id = ${selected.id}, days = ${JSON.stringify(value.days)}::jsonb, goal = ${value.goal.trim()}, current_level = ${value.current_level}, class_type = ${fields.class_type}, class_type_other = ${fields.class_type_other}, class_format = ${fields.class_format} WHERE id = ${id} AND owner_id = ${owner} RETURNING *`;
        return rows[0];
      }
      const rows = await tx.$queryRaw`INSERT INTO coaching_classes (id, owner_id, ladder_id, name, discipline, audience, days, goal, current_level, class_type, class_type_other, class_format) VALUES (${randomUUID()}, ${owner}, ${selected.id}, ${value.name.trim()}, ${value.discipline}, ${value.audience}, ${JSON.stringify(value.days)}::jsonb, ${value.goal.trim()}, ${value.current_level}, ${fields.class_type}, ${fields.class_type_other}, ${fields.class_format}) RETURNING *`;
      return rows[0];
    }),
    archive: (owner, id, archived) => client.$transaction(async tx => {
      await ownedClass(tx, owner, id);
      const rows = await tx.$queryRaw`UPDATE coaching_classes SET archived = ${archived} WHERE id = ${id} AND owner_id = ${owner} RETURNING *`;
      return rows[0];
    }),
    // Lock class IDs in sorted order and verify every owner before inserting any links.
    assign: (owner, ids, lessonId, date) => client.$transaction(async tx => {
      for (const id of [...ids].sort()) await ownedClass(tx, owner, id, true);
      const lessons = await tx.$queryRaw`SELECT id FROM lessons WHERE id = ${lessonId} AND owner_id = ${owner} FOR KEY SHARE`;
      if (!lessons.length) throw new ClassError(404, 'Lesson not found.');
      for (const id of ids) await tx.$executeRaw`INSERT INTO class_lessons (class_id, lesson_id, scheduled_date) VALUES (${id}, ${lessonId}, ${date}::date) ON CONFLICT (class_id, lesson_id) DO UPDATE SET scheduled_date = EXCLUDED.scheduled_date`;
      return { assigned: ids.length };
    }),
    unassign: (owner, id, lessonId) => client.$transaction(async tx => {
      await ownedClass(tx, owner, id);
      await tx.$executeRaw`DELETE FROM class_lessons WHERE class_id = ${id} AND lesson_id = ${lessonId}`;
    }),
  };
}
