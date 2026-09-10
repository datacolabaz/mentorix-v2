#!/usr/bin/env node
/**
 * Fresh-database bootstrap (idempotent).
 *
 * The application's runtime path (start.sh -> scripts/migrate.js) only applies
 * incremental migrations (002_*.sql and onward); it assumes the pre-migration
 * base tables (users, enrollments, exams, ...) already exist. On an empty
 * database those migrations fail immediately ("relation \"users\" does not
 * exist").
 *
 * This script provides that base for a brand-new database:
 *   1. If the `users` table is missing, apply src/models/schema.sql once.
 *   2. Seed schema_migrations with the one migration whose effect is already
 *      baked into schema.sql (024 renames instructor_tasks -> assignments,
 *      which schema.sql already creates in its final form).
 *
 * After this runs, scripts/migrate.js applies the remaining migrations cleanly.
 * On an already-initialised database this script is a no-op, so it is safe to
 * run on every boot before migrate.js.
 */
const fs = require('fs');
const path = require('path');

const envBackend = path.join(__dirname, '../.env');
const envRoot = path.join(__dirname, '../../.env');
require('dotenv').config({ path: envBackend, override: true });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: envRoot, override: true });
}

const { Client } = require('pg');

const SCHEMA_FILE = path.join(__dirname, '../src/models/schema.sql');

/** Migrations whose schema effect is already present in schema.sql. */
const SCHEMA_BAKED_MIGRATIONS = ['024_assignments_student_assignments.sql'];

function normalizeDatabaseUrl(raw) {
  if (raw == null) return '';
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function useSsl(connectionString) {
  const u = String(connectionString || '').toLowerCase();
  if (!u) return false;
  if (u.includes('localhost') || u.includes('127.0.0.1')) return false;
  return { rejectUnauthorized: false };
}

async function main() {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error('[init-fresh-db] DATABASE_URL is empty. Set it in backend/.env.');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: useSsl(url) });
  await client.connect();

  try {
    const { rows } = await client.query("SELECT to_regclass('public.users') AS reg");
    const usersExists = rows[0] && rows[0].reg;

    if (usersExists) {
      console.log('[init-fresh-db] users table already present — skipping base schema.');
      return;
    }

    console.log('[init-fresh-db] fresh database detected — applying base schema.sql…');
    const schemaSql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    await client.query(schemaSql);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    for (const filename of SCHEMA_BAKED_MIGRATIONS) {
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
        [filename]
      );
    }
    console.log('[init-fresh-db] base schema applied; run scripts/migrate.js next.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('[init-fresh-db]', e.message);
  process.exit(1);
});
