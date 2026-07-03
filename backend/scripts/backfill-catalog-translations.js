#!/usr/bin/env node
/** Backfill translations JSONB for existing catalog rows. */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/utils/db');
const {
  translationsJsonForCategory,
  translationsJsonForCareerPath,
  translationsJsonForExamTitle,
} = require('./catalogTranslationMap');

async function main() {
  const { rows: categories } = await db.query(`SELECT id, slug, name FROM exam_categories`);
  for (const row of categories) {
    const tr = translationsJsonForCategory(row.slug, row.name);
    await db.query(`UPDATE exam_categories SET translations = $2::jsonb WHERE id = $1`, [row.id, tr]);
  }
  console.log('Categories updated:', categories.length);

  const { rows: paths } = await db.query(`SELECT id, slug, name, description FROM career_paths`);
  for (const row of paths) {
    const tr = translationsJsonForCareerPath(row.slug, row.name, row.description);
    await db.query(`UPDATE career_paths SET translations = $2::jsonb WHERE id = $1`, [row.id, tr]);
  }
  console.log('Career paths updated:', paths.length);

  const { rows: exams } = await db.query(
    `SELECT id, title FROM exams WHERE COALESCE(is_deleted, FALSE) = FALSE AND is_public = TRUE AND is_verified = TRUE`,
  );
  for (const row of exams) {
    const tr = translationsJsonForExamTitle(row.title);
    await db.query(`UPDATE exams SET translations = $2::jsonb WHERE id = $1`, [row.id, tr]);
  }
  console.log('Exams updated:', exams.length);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
