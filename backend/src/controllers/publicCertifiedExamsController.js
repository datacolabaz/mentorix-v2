const db = require('../utils/db');
const { LEVEL_RANK } = require('../lib/skillLevels');
const { resolveCatalogLang, localizedField, localizedDescription } = require('../lib/catalogI18n');

const CATALOG_BASE_WHERE = `
  e.is_public = TRUE
  AND e.is_verified = TRUE
  AND COALESCE(e.is_deleted, FALSE) = FALSE
  AND e.certificate_enabled = TRUE
`;

function mapExamRow(r, lang) {
  return {
    id: r.id,
    title: localizedField(
      { title: r.title, title_ru: r.title_ru, translations: r.exam_translations },
      lang,
      'title',
    ),
    subject: r.subject,
    topic: r.topic,
    duration_minutes: Number(r.duration_minutes) || 0,
    pass_pct: Number(r.certificate_pass_pct) || 70,
    level: r.level || 'beginner',
    certificate_type: r.certificate_type || 'professional',
    category_id: r.category_id,
    category_slug: r.category_slug,
    category_name: localizedField(
      { name: r.category_name_raw, name_ru: r.category_name_ru, translations: r.category_translations },
      lang,
      'name',
    ),
    instructor_name: r.instructor_name,
    question_count: Number(r.question_count) || 0,
    passed_count: Number(r.passed_count) || 0,
    certificate_count: Number(r.certificate_count) || 0,
  };
}

const EXAM_SELECT = `
  e.id, e.title, e.title_ru, e.subject, e.topic, e.duration_minutes, e.certificate_pass_pct,
  e.level, e.certificate_type, e.category_id, e.translations AS exam_translations,
  ec.slug AS category_slug, ec.name AS category_name_raw, ec.name_ru AS category_name_ru, ec.translations AS category_translations,
  COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(ip.public_label), ''), 'Müəllim') AS instructor_name,
  (SELECT COUNT(*)::int FROM exam_questions eq WHERE eq.exam_id = e.id) AS question_count,
  (
    SELECT COUNT(DISTINCT er.student_id)::int FROM exam_results er
    WHERE er.exam_id = e.id AND er.submitted_at IS NOT NULL AND er.score >= e.certificate_pass_pct
  ) AS passed_count,
  (
    SELECT COUNT(*)::int FROM certificates c WHERE c.exam_id = e.id AND c.status = 'issued'
  ) AS certificate_count
`;

async function listAllCatalogCategories(req, res) {
  try {
    const lang = resolveCatalogLang(req);
    const { rows } = await db.query(
      `SELECT c.id, c.slug, c.name, c.name_ru, c.icon, c.parent_id, c.translations,
              p.name AS parent_name, p.name_ru AS parent_name_ru, p.slug AS parent_slug, p.icon AS parent_icon, p.translations AS parent_translations
       FROM exam_categories c
       LEFT JOIN exam_categories p ON p.id = c.parent_id
       WHERE c.parent_id IS NOT NULL
       ORDER BY p.sort_order, c.sort_order, c.name`,
    );
    res.json({
      success: true,
      categories: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: localizedField(r, lang, 'name'),
        icon: r.icon,
        parent_id: r.parent_id,
        parent_name: localizedField(
          { name: r.parent_name, name_ru: r.parent_name_ru, translations: r.parent_translations },
          lang,
          'name',
        ),
        parent_slug: r.parent_slug,
        parent_icon: r.parent_icon,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function listParentCategories(req, res) {
  try {
    const lang = resolveCatalogLang(req);
    const { rows } = await db.query(
      `SELECT
         c.id, c.slug, c.name, c.name_ru, c.icon, c.description, c.description_ru, c.sort_order, c.translations,
         (
           SELECT COUNT(*)::int FROM exams e
           WHERE ${CATALOG_BASE_WHERE}
             AND (
               e.category_id = c.id
               OR e.category_id IN (SELECT id FROM exam_categories ch WHERE ch.parent_id = c.id)
             )
         ) AS assessment_count
       FROM exam_categories c
       WHERE c.parent_id IS NULL
       ORDER BY c.sort_order ASC, c.name ASC`,
    );
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.set('Vary', 'Accept-Language');
    res.json({
      success: true,
      categories: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: localizedField(r, lang, 'name'),
        icon: r.icon,
        description: localizedDescription(r, lang) || localizedField(r, lang, 'name'),
        assessment_count: Number(r.assessment_count) || 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function getCategoryBySlug(req, res) {
  try {
    const lang = resolveCatalogLang(req);
    const slug = String(req.params.slug || '').trim();
    const { rows: catRows } = await db.query(
      `SELECT id, slug, name, name_ru, icon, description, description_ru, parent_id, translations FROM exam_categories WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    const category = catRows[0];
    if (!category) return res.status(404).json({ success: false, message: 'Kateqoriya tapılmadı' });

    const mapCategory = (row) => ({
      id: row.id,
      slug: row.slug,
      name: localizedField(row, lang, 'name'),
      icon: row.icon,
      description: localizedDescription(row, lang) || row.description,
    });

    const categoryIds = [category.id];
    if (!category.parent_id) {
      const { rows: children } = await db.query(
        `SELECT id, slug, name, name_ru, sort_order, translations FROM exam_categories WHERE parent_id = $1 ORDER BY sort_order, name`,
        [category.id],
      );
      categoryIds.push(...children.map((c) => c.id));

      const { rows: exams } = await db.query(
        `SELECT ${EXAM_SELECT}
         FROM exams e
         JOIN users u ON u.id = e.instructor_id
         LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
         LEFT JOIN exam_categories ec ON ec.id = e.category_id
         WHERE ${CATALOG_BASE_WHERE}
           AND e.category_id = ANY($1::uuid[])
         ORDER BY ec.sort_order, e.title
         LIMIT 200`,
        [categoryIds.filter(Boolean)],
      );

      const groups = children.map((child) => ({
        id: child.id,
        slug: child.slug,
        name: localizedField(child, lang, 'name'),
        exams: exams.filter((e) => e.category_id === child.id).map((r) => mapExamRow(r, lang)),
      }));

      const { rows: paths } = await db.query(
        `SELECT id, slug, name, name_ru, description, description_ru, icon, sort_order, translations
         FROM career_paths WHERE category_id = $1 OR category_id = ANY(
           SELECT id FROM exam_categories WHERE parent_id = $1
         )
         ORDER BY sort_order, name`,
        [category.id],
      );

      res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      res.set('Vary', 'Accept-Language');
      return res.json({
        success: true,
        category: mapCategory(category),
        child_groups: groups,
        career_paths: paths.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: localizedField(p, lang, 'name'),
          description: localizedDescription(p, lang),
          icon: p.icon,
          sort_order: p.sort_order,
        })),
      });
    }

    const { rows: exams } = await db.query(
      `SELECT ${EXAM_SELECT}
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN exam_categories ec ON ec.id = e.category_id
       WHERE ${CATALOG_BASE_WHERE} AND e.category_id = $1
       ORDER BY e.title LIMIT 100`,
      [category.id],
    );

    const mapped = mapCategory(category);
    res.json({
      success: true,
      category: mapped,
      child_groups: [{ id: category.id, slug: category.slug, name: mapped.name, exams: exams.map((r) => mapExamRow(r, lang)) }],
      career_paths: [],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function getCareerPathBySlug(req, res) {
  try {
    const lang = resolveCatalogLang(req);
    const slug = String(req.params.slug || '').trim();
    const userId = req.user?.id || null;

    const { rows: pathRows } = await db.query(
      `SELECT cp.*, ec.slug AS category_slug, ec.name AS category_name, ec.name_ru AS category_name_ru, ec.translations AS category_translations
       FROM career_paths cp
       LEFT JOIN exam_categories ec ON ec.id = cp.category_id
       WHERE cp.slug = $1 LIMIT 1`,
      [slug],
    );
    const path = pathRows[0];
    if (!path) return res.status(404).json({ success: false, message: 'Career path tapılmadı' });

    const { rows: steps } = await db.query(
      `SELECT
         cps.id, cps.step_order, cps.is_required,
         e.id AS exam_id, e.title, e.title_ru, e.level, e.duration_minutes, e.certificate_pass_pct, e.translations AS exam_translations
       FROM career_path_steps cps
       JOIN exams e ON e.id = cps.exam_id
       WHERE cps.career_path_id = $1
       ORDER BY cps.step_order ASC`,
      [path.id],
    );

    let completedExamIds = new Set();
    if (userId) {
      const examIds = steps.map((s) => s.exam_id);
      if (examIds.length) {
        const { rows: certs } = await db.query(
          `SELECT DISTINCT exam_id FROM certificates
           WHERE student_id = $1 AND status = 'issued' AND exam_id = ANY($2::uuid[])`,
          [userId, examIds],
        );
        completedExamIds = new Set(certs.map((c) => c.exam_id));
      }
    }

    const mappedSteps = steps.map((s, idx) => {
      const completed = completedExamIds.has(s.exam_id);
      const prevRequired = steps.slice(0, idx).filter((x) => x.is_required);
      const prevDone = prevRequired.every((x) => completedExamIds.has(x.exam_id));
      let status = 'locked';
      if (completed) status = 'completed';
      else if (idx === 0 || prevDone) status = 'ready';

      return {
        id: s.id,
        step_order: s.step_order,
        is_required: s.is_required,
        exam_id: s.exam_id,
        title: localizedField(
          { title: s.title, title_ru: s.title_ru, translations: s.exam_translations },
          lang,
          'title',
        ),
        level: s.level,
        duration_minutes: Number(s.duration_minutes) || 0,
        pass_pct: Number(s.certificate_pass_pct) || 70,
        status,
      };
    });

    res.json({
      success: true,
      career_path: {
        id: path.id,
        slug: path.slug,
        name: localizedField(path, lang, 'name'),
        description: localizedDescription(path, lang),
        icon: path.icon,
        category_slug: path.category_slug,
        category_name: localizedField(
          { name: path.category_name, name_ru: path.category_name_ru, translations: path.category_translations },
          lang,
          'name',
        ),
      },
      steps: mappedSteps,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function listPublicCertifiedExams(req, res) {
  try {
    const lang = resolveCatalogLang(req);
    const categorySlug = String(req.query.category || req.query.category_slug || '').trim();
    const params = [];
    let filter = '';

    if (categorySlug && categorySlug !== 'all') {
      params.push(categorySlug);
      filter = ` AND (
        ec.slug = $${params.length}
        OR ec.parent_id = (SELECT id FROM exam_categories WHERE slug = $${params.length} LIMIT 1)
        OR ec.id = (SELECT id FROM exam_categories WHERE slug = $${params.length} LIMIT 1)
      )`;
    }

    const { rows } = await db.query(
      `SELECT ${EXAM_SELECT}
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       LEFT JOIN instructor_profiles ip ON ip.user_id = u.id
       LEFT JOIN exam_categories ec ON ec.id = e.category_id
       WHERE ${CATALOG_BASE_WHERE}${filter}
       ORDER BY ec.sort_order NULLS LAST, e.title
       LIMIT 200`,
      params,
    );

    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.set('Vary', 'Accept-Language');
    res.json({ success: true, category: categorySlug || 'all', exams: rows.map((r) => mapExamRow(r, lang)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function getPublicCertifiedExamStats(_req, res) {
  try {
    const { rows } = await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM certificates WHERE status = 'issued') AS certificates_issued,
         (SELECT COUNT(*)::int FROM exams e WHERE ${CATALOG_BASE_WHERE.replace(/\be\./g, 'e.')}) AS verified_exam_types,
         (SELECT COUNT(*)::int FROM exam_categories WHERE parent_id IS NULL) AS category_count`,
    );
    const stats = rows[0] || {};
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      success: true,
      stats: {
        certificates_issued: Number(stats.certificates_issued) || 0,
        verified_exam_types: Number(stats.verified_exam_types) || 0,
        category_count: Number(stats.category_count) || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function postWaitlistNotification(req, res) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Düzgün email daxil edin' });
    }
    const categorySlug = String(req.body?.category_slug || req.body?.category || '').trim() || null;
    await db.query(
      `INSERT INTO waitlist_notifications (email, category, category_slug, source)
       VALUES ($1, $2, $3, 'certified_catalog')
       ON CONFLICT (email, source) DO UPDATE SET
         category = EXCLUDED.category,
         category_slug = EXCLUDED.category_slug,
         created_at = NOW()`,
      [email.slice(0, 255), categorySlug, categorySlug],
    );
    res.json({ success: true, message: 'Bildiriş siyahısına əlavə olundu' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function getUserSkillProgress(req, res) {
  try {
    const lang = resolveCatalogLang(req);
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Auth tələb olunur' });

    const { rows } = await db.query(
      `SELECT usp.current_level, usp.updated_at,
              ec.id AS category_id, ec.slug, ec.name, ec.name_ru, ec.icon, ec.translations,
              parent.slug AS parent_slug, parent.name AS parent_name, parent.name_ru AS parent_name_ru, parent.translations AS parent_translations
       FROM user_skill_progress usp
       JOIN exam_categories ec ON ec.id = usp.category_id
       LEFT JOIN exam_categories parent ON parent.id = ec.parent_id
       WHERE usp.user_id = $1
       ORDER BY parent.sort_order NULLS LAST, ec.sort_order, ec.name`,
      [userId],
    );

    res.json({
      success: true,
      progress: rows.map((r) => ({
        category_id: r.category_id,
        slug: r.slug,
        name: localizedField(r, lang, 'name'),
        icon: r.icon,
        parent_slug: r.parent_slug,
        parent_name: localizedField(
          { name: r.parent_name, name_ru: r.parent_name_ru, translations: r.parent_translations },
          lang,
          'name',
        ),
        current_level: r.current_level,
        updated_at: r.updated_at,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

module.exports = {
  listParentCategories,
  listAllCatalogCategories,
  getCategoryBySlug,
  getCareerPathBySlug,
  listPublicCertifiedExams,
  getPublicCertifiedExamStats,
  postWaitlistNotification,
  getUserSkillProgress,
};
