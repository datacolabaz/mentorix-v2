const db = require('../utils/db');

const BIO_MAX = 300;
const EDUCATION_MAX = 500;

async function ensureInstructorProfileRow(userId) {
  const { rows } = await db.query(`SELECT 1 FROM instructor_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
  if (!rows.length) {
    await db.query(`INSERT INTO instructor_profiles (user_id) VALUES ($1)`, [userId]);
  }
}

/** GET /api/instructor/professional-details */
const getProfessionalDetails = async (req, res) => {
  try {
    await ensureInstructorProfileRow(req.user.id);
    const { rows } = await db.query(
      `SELECT education, experience_years, bio
       FROM instructor_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [req.user.id],
    );
    const row = rows[0] || {};
    res.json({
      success: true,
      education: row.education || '',
      experience_years:
        row.experience_years != null && Number.isFinite(Number(row.experience_years))
          ? Number(row.experience_years)
          : null,
      bio: row.bio || '',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

/** PATCH /api/instructor/professional-details */
const patchProfessionalDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureInstructorProfileRow(userId);

    const educationRaw = req.body?.education;
    const expRaw = req.body?.experience_years;
    const bioRaw = req.body?.bio;

    let education = null;
    if (educationRaw !== undefined && educationRaw !== null) {
      const s = String(educationRaw).trim();
      education = s ? s.slice(0, EDUCATION_MAX) : null;
    }

    let experienceYears = null;
    if (expRaw !== undefined && expRaw !== null && String(expRaw).trim() !== '') {
      const n = Number.parseInt(String(expRaw).trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 60) {
        return res.status(400).json({
          success: false,
          message: 'Təcrübə 0–60 il aralığında olmalıdır',
        });
      }
      experienceYears = n;
    } else if (expRaw !== undefined) {
      experienceYears = null;
    }

    let bio = null;
    if (bioRaw !== undefined && bioRaw !== null) {
      const s = String(bioRaw).trim();
      bio = s ? s.slice(0, BIO_MAX) : null;
    }

    const sets = [];
    const vals = [];
    let pi = 1;

    if (educationRaw !== undefined) {
      sets.push(`education = $${pi++}`);
      vals.push(education);
    }
    if (expRaw !== undefined) {
      sets.push(`experience_years = $${pi++}`);
      vals.push(experienceYears);
    }
    if (bioRaw !== undefined) {
      sets.push(`bio = $${pi++}`);
      vals.push(bio);
    }

    if (!sets.length) {
      return res.status(400).json({ success: false, message: 'Yenilənəcək məlumat göndərin' });
    }

    if (bioRaw !== undefined) {
      sets.push(`discover_bio = $${pi++}`);
      vals.push(bio);
    }
    if (educationRaw !== undefined) {
      sets.push(`discover_education = $${pi++}`);
      vals.push(education);
    }

    vals.push(userId);
    await db.query(
      `UPDATE instructor_profiles SET ${sets.join(', ')} WHERE user_id = $${pi}`,
      vals,
    );

    const { rows } = await db.query(
      `SELECT education, experience_years, bio FROM instructor_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const row = rows[0] || {};
    res.json({
      success: true,
      message: 'Peşəkar məlumatlar saxlanıldı',
      education: row.education || '',
      experience_years:
        row.experience_years != null && Number.isFinite(Number(row.experience_years))
          ? Number(row.experience_years)
          : null,
      bio: row.bio || '',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getProfessionalDetails, patchProfessionalDetails };
