#!/usr/bin/env node
/**
 * Tətbiq olunmamış SQL migrasiyalarını ardıcıllıqla işlədir (schema_migrations cədvəli).
 * Railway / prod: start əmri əvvəl bunu çağırır — exam_files və s. avtomatik əlavə olunur.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '../src/models/migrations');

function useSsl(connectionString) {
  if (!connectionString) return false;
  const u = connectionString.toLowerCase();
  if (u.includes('localhost') || u.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({
    connectionString: url,
    ssl: useSsl(url),
  });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: applied } = await client.query('SELECT filename FROM schema_migrations');
  const done = new Set(applied.map((r) => r.filename));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    if (done.has(filename)) continue;
    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(fullPath, 'utf8').trim();
    if (!sql) continue;

    console.log('Applying migration:', filename);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Migration failed:', filename, e.message);
      throw e;
    }
  }

  await client.end();
  console.log('Migrations OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
