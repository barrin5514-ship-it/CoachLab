import { readFileSync } from 'node:fs';

export function migrate(database) {
  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  ) STRICT`);
  const migrations = [{ version: 1, file: '001_create_lessons.sql' }, { version: 2, file: '002_create_lesson_media.sql' }, { version: 3, file: '003_add_ownership.sql' }];
  for (const migration of migrations) {
    database.transaction(() => {
      const applied = database.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version);
      if (applied) return;
      const sql = readFileSync(new URL(`./migrations/${migration.file}`, import.meta.url), 'utf8');
      database.exec(sql);
      database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version);
    })();
  }
}
