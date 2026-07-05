const db = require('../utils/db');
const { resolveCatalogLang, localizedField } = require('../lib/catalogI18n');

function siteOrigin() {
  return String(process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.io').replace(/\/+$/, '');
}

const OG_CERT_IMAGE_PATH = '/og-certified.svg';

async function getCertifiedCategoryOg(req, res) {
  try {
    const slug = String(req.params.slug || '').trim();
    const lang = resolveCatalogLang(req);
    const { rows } = await db.query(
      `SELECT id, slug, name, name_ru, translations FROM exam_categories WHERE slug = $1 LIMIT 1`,
      [slug],
    );
    const cat = rows[0];
    if (!cat) return res.status(404).json({ success: false, message: 'Kateqoriya tapılmadı' });

    const name = localizedField(cat, lang, 'name');
    const title = `${name} — Sertifikatlı İmtahan | Mentorix`;
    const description = `${name} sahəsində biliyini sərtifikatla təsdiqlə. QR kodu ilə doğrulanan Mentorix sertifikatı qazan.`;
    const canonicalPath = `/sertifikatli-imtahanlar/${encodeURIComponent(slug)}`;

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      success: true,
      title,
      description,
      url: `${siteOrigin()}${canonicalPath}`,
      canonical_path: canonicalPath,
      image: `${siteOrigin()}${OG_CERT_IMAGE_PATH}`,
      og_type: 'website',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

async function getExamOg(req, res) {
  try {
    const examId = req.params.examId;
    const { rows } = await db.query(
      `SELECT e.id, e.title, e.certificate_pass_pct, COALESCE(e.is_deleted, FALSE) AS is_deleted
       FROM exams e WHERE e.id = $1::uuid LIMIT 1`,
      [examId],
    );
    const exam = rows[0];
    if (!exam || exam.is_deleted) {
      return res.status(404).json({ success: false, message: 'İmtahan tapılmadı' });
    }

    const pass = Number(exam.certificate_pass_pct) || 70;
    const title = `${exam.title} — Sertifikatlı İmtahan | Mentorix`;
    const description =
      `${exam.title} imtahanını ver, keçid balını topla, QR kodu ilə doğrulanan sertifikat qazan. Keçid balı: ${pass}%`;
    const canonicalPath = `/exam/${encodeURIComponent(examId)}`;

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      success: true,
      title,
      description,
      url: `${siteOrigin()}${canonicalPath}`,
      canonical_path: canonicalPath,
      image: `${siteOrigin()}${OG_CERT_IMAGE_PATH}`,
      og_type: 'website',
      pass_pct: pass,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

const CATALOG_EXAM_WHERE = `
  e.is_public = TRUE
  AND e.is_verified = TRUE
  AND COALESCE(e.is_deleted, FALSE) = FALSE
  AND e.certificate_enabled = TRUE
`;

async function getCertifiedExamOg(req, res) {
  try {
    const categorySlug = String(req.params.categorySlug || '').trim();
    const examSlug = String(req.params.examSlug || '').trim();
    const lang = resolveCatalogLang(req);

    const { rows } = await db.query(
      `SELECT e.id, e.title, e.title_ru, e.translations, e.certificate_pass_pct, e.slug
       FROM exams e
       LEFT JOIN exam_categories ec ON ec.id = e.category_id
       LEFT JOIN exam_categories parent ON parent.id = ec.parent_id
       WHERE e.slug = $1
         AND ${CATALOG_EXAM_WHERE}
         AND (ec.slug = $2 OR parent.slug = $2)
       LIMIT 1`,
      [examSlug, categorySlug],
    );
    const exam = rows[0];
    if (!exam) return res.status(404).json({ success: false, message: 'İmtahan tapılmadı' });

    const name = localizedField(exam, lang, 'title');
    const pass = Number(exam.certificate_pass_pct) || 70;
    const title = `${name} — Sertifikatlı İmtahan | Mentorix`;
    const description =
      `${name} imtahanını ver, keçid balını topla, QR kodu ilə doğrulanan sertifikat qazan. Keçid balı: ${pass}%`;
    const canonicalPath = `/sertifikatli-imtahanlar/${encodeURIComponent(categorySlug)}/${encodeURIComponent(examSlug)}`;

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      success: true,
      title,
      description,
      url: `${siteOrigin()}${canonicalPath}`,
      canonical_path: canonicalPath,
      image: `${siteOrigin()}${OG_CERT_IMAGE_PATH}`,
      og_type: 'website',
      pass_pct: pass,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
}

module.exports = { getCertifiedCategoryOg, getExamOg, getCertifiedExamOg };
