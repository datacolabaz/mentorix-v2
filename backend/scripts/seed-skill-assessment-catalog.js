#!/usr/bin/env node
/**
 * Seed exam_categories, sample verified exams, and career paths.
 * Usage: node backend/scripts/seed-skill-assessment-catalog.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/utils/db');
const { PARENTS, CAREER_PATHS, inferExamMeta } = require('./skillAssessmentCatalogData');
const {
  translationsJsonForCategory,
  translationsJsonForCareerPath,
  translationsJsonForExamTitle,
  ruNameForCategory,
  ruNameForCareerPath,
  ruDescriptionForCareerPath,
  ruTitleForExam,
} = require('./catalogTranslationMap');

const OFFICIAL_EMAIL = process.env.MENTORIX_OFFICIAL_EMAIL || 'mentorix.resmi@mentorix.local';
const OFFICIAL_NAME = 'Mentorix Rəsmi';

async function upsertCategory(client, { parentId, slug, name, icon, description, sortOrder }) {
  const translations = translationsJsonForCategory(slug, name);
  const nameRu = ruNameForCategory(slug, name);
  const { rows } = await client.query(
    `INSERT INTO exam_categories (parent_id, slug, name, name_ru, icon, description, sort_order, translations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT (slug) DO UPDATE SET
       parent_id = EXCLUDED.parent_id,
       name = EXCLUDED.name,
       name_ru = EXCLUDED.name_ru,
       icon = EXCLUDED.icon,
       description = EXCLUDED.description,
       sort_order = EXCLUDED.sort_order,
       translations = EXCLUDED.translations
     RETURNING id, slug`,
    [parentId, slug, name, nameRu, icon || null, description || null, sortOrder || 0, translations],
  );
  return rows[0];
}

async function ensureOfficialInstructor(client) {
  const { rows } = await client.query(
    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [OFFICIAL_EMAIL],
  );
  if (rows[0]) return rows[0].id;
  const { rows: created } = await client.query(
    `INSERT INTO users (email, full_name, role, is_active, is_verified, password_hash)
     VALUES ($1, $2, 'instructor', TRUE, TRUE, NULL) RETURNING id`,
    [OFFICIAL_EMAIL, OFFICIAL_NAME],
  );
  return created[0].id;
}

function makeOptions() {
  return ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Variant ${key}` }));
}

async function ensureExam(client, instructorId, { title, categoryId, parentSlug, duration = 25, passPct = 70 }) {
  const meta = inferExamMeta(title, parentSlug);
  const { rows: existing } = await client.query(
    `SELECT id FROM exams WHERE instructor_id = $1 AND title = $2 AND COALESCE(is_deleted, FALSE) = FALSE LIMIT 1`,
    [instructorId, title],
  );

  if (existing[0]) {
    await client.query(
      `UPDATE exams SET
         category_id = $2,
         level = $3,
         certificate_type = $4,
         is_public = TRUE,
         is_verified = TRUE,
         certificate_enabled = TRUE,
         certificate_pass_pct = $5,
         translations = $6::jsonb,
         title_ru = $7,
         updated_at = NOW()
       WHERE id = $1`,
      [
        existing[0].id,
        categoryId,
        meta.level,
        meta.certificate_type,
        passPct,
        translationsJsonForExamTitle(title),
        ruTitleForExam(title),
      ],
    );
    return existing[0].id;
  }

  const now = new Date();
  const until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const { rows } = await client.query(
    `INSERT INTO exams (
       instructor_id, title, subject, topic, duration_minutes,
       start_time, available_from, available_until,
       show_results, certificate_enabled, certificate_pass_pct,
       category_id, level, certificate_type, is_public, is_verified, status, translations, title_ru
     ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$6::timestamptz,$7::timestamptz,
       TRUE,TRUE,$8,$9,$10,$11,TRUE,TRUE,'scheduled',$12::jsonb,$13)
     RETURNING id`,
    [
      instructorId,
      title,
      title.split(' ')[0],
      title,
      duration,
      now.toISOString(),
      until.toISOString(),
      passPct,
      categoryId,
      meta.level,
      meta.certificate_type,
      translationsJsonForExamTitle(title),
      ruTitleForExam(title),
    ],
  );
  const examId = rows[0].id;

  for (let i = 0; i < 3; i++) {
    await client.query(
      `INSERT INTO exam_questions (exam_id, question_text, question_type, points, order_num, correct_answer, options, negative_marking)
       SELECT $1, $2, 'closed', 1, $3, 'B', $4::jsonb, 0
       WHERE NOT EXISTS (SELECT 1 FROM exam_questions WHERE exam_id = $1 AND order_num = $3)`,
      [examId, `${title} — sual ${i + 1}`, i + 1, JSON.stringify(makeOptions())],
    );
  }
  return examId;
}

async function main() {
  const slugToId = new Map();

  await db.transaction(async (client) => {
    for (const parent of PARENTS) {
      const parentRow = await upsertCategory(client, {
        parentId: null,
        slug: parent.slug,
        name: parent.nameAz || parent.name,
        icon: parent.icon,
        description: parent.name,
        sortOrder: parent.sort,
      });
      slugToId.set(parent.slug, parentRow.id);

      let childSort = 0;
      for (const child of parent.children || []) {
        childSort += 10;
        const childRow = await upsertCategory(client, {
          parentId: parentRow.id,
          slug: child.slug,
          name: child.name,
          icon: null,
          description: null,
          sortOrder: childSort,
        });
        slugToId.set(child.slug, childRow.id);
      }
    }

    const instructorId = await ensureOfficialInstructor(client);
    const examTitleToId = new Map();

    for (const parent of PARENTS) {
      for (const child of parent.children || []) {
        const categoryId = slugToId.get(child.slug);
        const topics = child.topics || [];
        const sampleTopics = topics.length <= 2 ? topics : [topics[0], topics[Math.floor(topics.length / 2)]];
        for (const title of sampleTopics) {
          const examId = await ensureExam(client, instructorId, {
            title,
            categoryId,
            parentSlug: parent.slug,
          });
          examTitleToId.set(title, examId);
        }
      }
    }

    for (const path of CAREER_PATHS) {
      const categoryId = slugToId.get(path.categorySlug) || null;
      const { rows: cpRows } = await client.query(
        `INSERT INTO career_paths (category_id, name, name_ru, slug, description, description_ru, icon, sort_order, translations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         ON CONFLICT (slug) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           name = EXCLUDED.name,
           name_ru = EXCLUDED.name_ru,
           description = EXCLUDED.description,
           description_ru = EXCLUDED.description_ru,
           icon = EXCLUDED.icon,
           sort_order = EXCLUDED.sort_order,
           translations = EXCLUDED.translations
         RETURNING id`,
        [
          categoryId,
          path.nameAz || path.name,
          ruNameForCareerPath(path.slug, path.nameAz || path.name),
          path.slug,
          path.description,
          ruDescriptionForCareerPath(path.slug, path.description),
          path.icon,
          10,
          translationsJsonForCareerPath(path.slug, path.nameAz || path.name, path.description),
        ],
      );
      const careerPathId = cpRows[0].id;

      await client.query(`DELETE FROM career_path_steps WHERE career_path_id = $1`, [careerPathId]);

      let order = 0;
      for (const stepTitle of path.steps) {
        order += 1;
        let examId = examTitleToId.get(stepTitle);
        if (!examId) {
          const catSlug = path.categorySlug === 'data-analytics' ? 'data-analytics-core' : 'web-development';
          examId = await ensureExam(client, instructorId, {
            title: stepTitle,
            categoryId: slugToId.get(catSlug),
            parentSlug: path.categorySlug,
          });
          examTitleToId.set(stepTitle, examId);
        }
        await client.query(
          `INSERT INTO career_path_steps (career_path_id, exam_id, step_order, is_required)
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (career_path_id, exam_id) DO UPDATE SET step_order = EXCLUDED.step_order`,
          [careerPathId, examId, order],
        );
      }
      console.log('Career path seeded:', path.slug);
    }

    console.log('Categories:', slugToId.size);
    console.log('Sample exams:', examTitleToId.size);
  });

  console.log('Skill assessment catalog seed OK.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
