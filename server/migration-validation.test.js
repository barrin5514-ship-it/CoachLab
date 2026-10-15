import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import pg from 'pg';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const parseUrl = value => { try { return new URL(value); } catch { throw new Error('Invalid connection configuration.'); } };
const fields = ['id', 'title', 'discipline', 'skill_level', 'duration_minutes', 'goal', 'drills', 'coaching_notes', 'created_at'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fileHash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const canonical = rows => rows.map(row => fields.map(key => key === 'created_at' ? new Date(row[key]).toISOString() : row[key]));
const equalRows = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  const left = canonical(actual), right = canonical(expected);
  for (let row = 0; row < right.length; row++) {
    for (let field = 0; field < fields.length; field++) {
      assert.ok(left[row][field] === right[row][field], `Mismatch in row ${row}, field ${fields[field]}`);
    }
  }
};

test('isolated PostgreSQL migration validation', { skip: process.env.COACHLAB_RUN_MIGRATION_TESTS !== 'verified-development', timeout: 120000 }, async t => {
  const env = process.env;
  assert.equal(env.COACHLAB_DB_ENV, 'development');
  assert.equal(env.COACHLAB_DEV_PROJECT_ID, 'rapid-firefly-98778665');
  assert.equal(env.COACHLAB_DEV_BRANCH_ID, 'br-flat-fog-b5t1m0vy');
  const direct = parseUrl(env.COACHLAB_DEV_DIRECT_URL);
  const pooled = parseUrl(env.COACHLAB_DEV_DATABASE_URL);
  assert.equal(pooled.hostname, env.COACHLAB_DEV_EXPECTED_HOST);
  assert.ok(pooled.hostname.startsWith('ep-long-bird-b50l2nhb-pooler.') && pooled.hostname.endsWith('.neon.tech'));
  assert.equal(direct.hostname, pooled.hostname.replace('-pooler.', '.'));
  assert.equal(direct.pathname, '/neondb');
  assert.equal(pooled.pathname, direct.pathname);
  assert.equal(env.COACHLAB_DEV_EXPECTED_DATABASE, 'neondb');
  assert.equal(direct.username, pooled.username);
  for (const url of [direct, pooled]) {
    assert.ok(url.protocol === 'postgresql:' && url.username && url.password);
    assert.ok(['require', 'verify-full'].includes(url.searchParams.get('sslmode')));
    assert.ok([...url.searchParams.keys()].every(key => ['sslmode', 'channel_binding'].includes(key)));
  }
  const sources = JSON.parse(env.COACHLAB_MIGRATION_SOURCES);
  assert.ok(Array.isArray(sources) && sources.length === 2);
  const archive = mkdtempSync(path.join(tmpdir(), 'coachlab-migration-validation-'));
  assert.ok(!/onedrive/i.test(archive));
  const hashes = sources.map(fileHash);
  const datasets = [];
  for (const [index, filename] of sources.entries()) {
    assert.ok(path.isAbsolute(filename));
    const original = new Database(filename, { readonly: true, fileMustExist: true });
    const copy = path.join(archive, `source-${index}.sqlite`);
    try { await original.backup(copy); } finally { original.close(); }
    const database = new Database(copy, { readonly: true, fileMustExist: true });
    try {
      assert.equal(database.pragma('integrity_check', { simple: true }), 'ok');
      const rows = database.prepare('SELECT * FROM lessons ORDER BY id').safeIntegers().all();
      for (const row of rows) {
        assert.ok(row.id >= -2147483648n && row.id < 2147483647n);
        row.id = Number(row.id);
        if (row.duration_minutes !== null) {
          assert.ok(row.duration_minutes > 0n && row.duration_minutes <= 2147483647n);
          row.duration_minutes = Number(row.duration_minutes);
        }
        assert.equal(new Date(row.created_at).toISOString(), row.created_at);
      }
      datasets.push(rows);
    } finally { database.close(); }
  }
  assert.deepEqual(datasets.map(rows => rows.length), [2, 7]);
  direct.search = '';
  const client = new pg.Client({ connectionString: direct.toString(), ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
  const schema = 'coachlab_validation_' + randomUUID().replaceAll('-', '');
  const read = async () => (await client.query('SELECT * FROM lessons ORDER BY id')).rows;
  const insert = async row => client.query(`INSERT INTO lessons (${fields.join(',')}) VALUES (${fields.map((_, i) => '$' + (i + 1)).join(',')})`, fields.map(key => row[key]));
  const importRows = async rows => {
    await client.query('SAVEPOINT import_batch');
    try {
      for (const row of rows) {
        assert.ok(Number.isInteger(row.id) && row.id >= -2147483648 && row.id < 2147483647);
        assert.ok(Number.isFinite(Date.parse(row.created_at)));
        await insert(row);
      }
      const maximum = (await client.query('SELECT MAX(id) AS maximum FROM lessons')).rows[0].maximum;
      const next = Math.max(1, (maximum ?? 0) + 1);
      assert.ok(Number.isSafeInteger(next) && next <= 2147483647);
      await client.query(`ALTER SEQUENCE lessons_id_seq RESTART WITH ${next}`);
      await client.query('RELEASE SAVEPOINT import_batch');
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT import_batch');
      await client.query('RELEASE SAVEPOINT import_batch');
      throw new Error(/^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : 'Import rejected');
    }
  };
  let publicBefore;
  let stage = 'connection';
  try {
    await client.connect();
    stage = 'identity';
    const identity = (await client.query('SELECT current_database() AS name, current_user AS role')).rows[0];
    assert.ok(identity.name === 'neondb' && identity.role === decodeURIComponent(direct.username));
    publicBefore = digest((await client.query('SELECT * FROM public.lessons ORDER BY id')).rows);
    const sequenceBefore = digest((await client.query('SELECT * FROM public.lessons_id_seq')).rows);
    assert.equal((await client.query('SELECT count(*)::integer AS n FROM public.lessons')).rows[0].n, 0);
    stage = 'isolated schema';
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    assert.equal((await client.query('SELECT current_schema() AS name')).rows[0].name, schema);
    const sql = readFileSync(new URL('../prisma/migrations/20261015000100_create_lessons/migration.sql', import.meta.url), 'utf8');
    await client.query(sql.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''));
    const relation = (await client.query("SELECT 'lessons'::regclass::oid = to_regclass($1)::oid AS isolated", [schema + '.lessons'])).rows[0];
    assert.equal(relation.isolated, true);
    stage = 'scenarios';
    const scenario = async (name, run) => t.test(name, async () => {
      await client.query('SAVEPOINT scenario');
      try { await run(); } finally { await client.query('ROLLBACK TO SAVEPOINT scenario'); await client.query('RELEASE SAVEPOINT scenario'); }
    });
    for (const [index, rows] of datasets.entries()) {
      await scenario(`source ${index + 1}: all nine fields and millisecond timestamps`, async () => {
        await importRows(rows);
        equalRows(await read(), rows);
        await client.query("SET LOCAL TIME ZONE 'America/New_York'");
        equalRows(await read(), rows);
        t.diagnostic(`${rows.length} records, ${rows.length * fields.length} field values matched`);
      });
    }
    await scenario('repeated imports and overlapping ID ranges reject without overwriting', async () => {
      await importRows(datasets[0]);
      await assert.rejects(importRows(datasets[0]), /23505/);
      await assert.rejects(importRows(datasets[1]), /23505/);
      equalRows(await read(), datasets[0]);
    });
    await scenario('mid-batch failure rolls back every inserted row and recovery succeeds', async () => {
      const rows = datasets[1].map(row => ({ ...row }));
      rows[1].title = '';
      await assert.rejects(importRows(rows), /23514/);
      assert.equal((await read()).length, 0);
      await importRows(datasets[1]);
      equalRows(await read(), datasets[1]);
    });
    await scenario('constraint failures remain recoverable', async () => {
      for (const invalid of [{ title: '' }, { discipline: '' }, { skill_level: '' }, { duration_minutes: 0 }, { title: null }]) {
        await assert.rejects(importRows([{ ...datasets[0][0], ...invalid }]), /23514|23502/);
        assert.equal((await read()).length, 0);
      }
    });
    await scenario('sequence advances above imported IDs and returns API-compatible creation fields', async () => {
      await importRows(datasets[1]);
      const row = datasets[1][0];
      const created = (await client.query('INSERT INTO lessons(title,discipline) VALUES ($1,$2) RETURNING *', [row.title, row.discipline])).rows[0];
      assert.equal(created.id, Math.max(...datasets[1].map(item => item.id)) + 1);
      assert.equal(created.skill_level, 'Beginner');
      assert.equal(created.duration_minutes, null);
      assert.equal(typeof JSON.parse(JSON.stringify(created)).created_at, 'string');
      assert.ok(Math.abs(Date.now() - created.created_at.getTime()) < 120000);
    });
    await scenario('empty and nonpositive ID imports start sequence at one', async () => {
      await importRows([]);
      await importRows([{ ...datasets[0][0], id: -1 }]);
      assert.equal((await client.query("SELECT nextval('lessons_id_seq') AS id")).rows[0].id, '1');
    });
    await scenario('PostgreSQL update and delete primitives work only in isolated schema', async () => {
      await importRows(datasets[0]);
      const row = datasets[0][0];
      const updated = await client.query('UPDATE lessons SET goal=$1 WHERE id=$2 RETURNING goal', [row.drills, row.id]);
      assert.equal(digest(updated.rows[0].goal), digest(row.drills));
      assert.equal((await client.query('DELETE FROM lessons WHERE id=$1', [row.id])).rowCount, 1);
    });
    await client.query('ROLLBACK');
    assert.equal((await client.query('SELECT to_regnamespace($1) AS schema', [schema])).rows[0].schema, null);
    assert.equal(digest((await client.query('SELECT * FROM public.lessons ORDER BY id')).rows), publicBefore);
    assert.equal(digest((await client.query('SELECT * FROM public.lessons_id_seq')).rows), sequenceBefore);
    t.diagnostic('Isolated schema removed by rollback; public lessons and sequence unchanged.');
  } catch (error) {
    throw new Error('Migration validation failed at ' + stage + ': ' + (/^[0-9A-Z_]+$/.test(error.code || '') ? error.code : error.name));
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
    assert.deepEqual(sources.map(fileHash), hashes, 'Original SQLite file hashes unchanged');
  }
});
