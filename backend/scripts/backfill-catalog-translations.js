#!/usr/bin/env node
/** Backfill translations JSONB + name_ru/title_ru columns for catalog rows. */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/utils/db');
const {
  translationsJsonForCategory,
  translationsJsonForCareerPath,
  translationsJsonForExamTitle,
  ruNameForCategory,
  ruNameForCareerPath,
  ruDescriptionForCareerPath,
  ruTitleForExam,
} = require('./catalogTranslationMap');

async function main() {
  const { rows: categories } = await db.query(`SELECT id, slug, name, description FROM exam_categories`);
  for (const row of categories) {
    const tr = translationsJsonForCategory(row.slug, row.name);
    const nameRu = ruNameForCategory(row.slug, row.name);
    await db.query(
      `UPDATE exam_categories SET translations = $2::jsonb, name_ru = $3 WHERE id = $1`,
      [row.id, tr, nameRu],
    );
  }
  console.log('Categories updated:', categories.length);

  const { rows: paths } = await db.query(`SELECT id, slug, name, description FROM career_paths`);
  for (const row of paths) {
    const tr = translationsJsonForCareerPath(row.slug, row.name, row.description);
    const nameRu = ruNameForCareerPath(row.slug, row.name);
    const descRu = ruDescriptionForCareerPath(row.slug, row.description);
    await db.query(
      `UPDATE career_paths SET translations = $2::jsonb, name_ru = $3, description_ru = $4 WHERE id = $1`,
      [row.id, tr, nameRu, descRu],
    );
  }
  console.log('Career paths updated:', paths.length);

  const { rows: exams } = await db.query(
    `SELECT id, title FROM exams WHERE COALESCE(is_deleted, FALSE) = FALSE`,
  );
  for (const row of exams) {
    const tr = translationsJsonForExamTitle(row.title);
    const titleRu = ruTitleForExam(row.title);
    await db.query(
      `UPDATE exams SET translations = $2::jsonb, title_ru = $3 WHERE id = $1`,
      [row.id, tr, titleRu],
    );
  }
  console.log('Exams updated:', exams.length);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
