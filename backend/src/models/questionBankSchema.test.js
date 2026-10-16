const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { listUpMigrations } = require('../../scripts/migrate');

const migration = fs.readFileSync(path.join(__dirname, 'migrations/236_question_bank_foundation.sql'), 'utf8');
const rollback = fs.readFileSync(path.join(__dirname, '../../scripts/sql/rollback/236_question_bank_foundation.sql'), 'utf8');
const sql = migration.replace(/--.*$/gm, '');

test('236 is an additive runner-owned migration; rollback is manual only', () => {
  assert.deepEqual(listUpMigrations(['236_question_bank_foundation.sql', '236_question_bank_foundation.down.sql']),
    ['236_question_bank_foundation.sql']);
  assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im);
  assert.doesNotMatch(sql, /\b(?:DELETE FROM|UPDATE|ALTER TABLE|DROP TABLE)\s+(?:users|exams|exam_questions|exam_results|instructor_subjects)\b/i);
  assert.doesNotMatch(sql, /CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+(?!IF NOT EXISTS)/i);
  assert.match(rollback, /DESTRUCTIVE/);
  assert.doesNotMatch(rollback, /DROP TABLE(?: IF EXISTS)? (?:exams|exam_questions|exam_results|course_materials|instructor_subjects)\s*;/i);
});

test('both bank questions and private exam snapshots support all nine canonical question types', () => {
  for (const type of ['single_choice', 'multiple_choice', 'true_false', 'short_answer', 'numeric',
    'matching', 'ordering', 'open_answer', 'file_upload']) {
    assert.equal((migration.match(new RegExp(`'${type}'`, 'g')) || []).length >= 2, true, type);
  }
});

test('migration never adds private answer keys to legacy API tables', () => {
  assert.doesNotMatch(sql, /ALTER TABLE\s+(?:exams|exam_questions|exam_results)/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS exam_bank_questions/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS exam_answers/);
});

const url = process.env.TEST_DATABASE_URL || '';
let local = false;
try {
  const parsed = new URL(url);
  local = ['postgres:', 'postgresql:'].includes(parsed.protocol)
    && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
} catch { /* Explicit opt-in only. Never fall back to DATABASE_URL. */ }

test('real PostgreSQL: reapply, ownership, grading, snapshots, rollback and reinstall', {
  skip: local ? false : 'set TEST_DATABASE_URL to a localhost PostgreSQL; never uses DATABASE_URL',
}, () => {
  const schema = `qb_schema_test_${process.pid}_${Date.now()}`;
  const fixtures = fs.readFileSync(path.join(__dirname, 'questionBankSchema.fixture.sql'), 'utf8');
  const checks = fs.readFileSync(path.join(__dirname, 'questionBankSchema.checks.sql'), 'utf8');
  // Exercise the exact rollback body in the test's outer transaction, then roll everything back.
  const rollbackBody = rollback.replace(/^\s*(BEGIN|COMMIT)\s*;/gim, '');
  const script = `BEGIN;
    CREATE SCHEMA ${schema};
    SET LOCAL search_path TO ${schema}, pg_catalog;
    ${fixtures}
    ${migration}
    ${migration}
    ${checks}
    ${rollbackBody}
    DO $$ BEGIN
      IF to_regclass('bank_questions') IS NOT NULL THEN RAISE EXCEPTION 'rollback retained new tables'; END IF;
      IF (SELECT count(*) FROM exams) <> 2 OR (SELECT count(*) FROM exam_results) <> 3
        OR (SELECT count(*) FROM course_materials) <> 3 OR (SELECT count(*) FROM exam_questions) <> 4 THEN
        RAISE EXCEPTION 'rollback damaged legacy data';
      END IF;
    END $$;
    ${migration}
    ROLLBACK;
    SELECT 'QUESTION_BANK_SCHEMA_OK';`;
  const result = spawnSync('psql', ['-X', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-q', '-d', url], {
    input: script, encoding: 'utf8', timeout: 60000, maxBuffer: 1024 * 1024,
  });
  // Do not print the connection string or environment on failure.
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /QUESTION_BANK_SCHEMA_OK/);
});
