const db = require('../utils/db');

function parsePublicLabel(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'trainer' || s === 'telimci' || s === 'təlimçi') return 'trainer';
  return 'instructor';
}

function looksUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/** Müəllim: görünən ad + sahə/qrup siyahısı */
const getTeaching = async (req, res) => {
  try {
    const iid = req.user.id;
    const { rows: prof } = await db.query(
      `SELECT COALESCE(NULLIF(TRIM(public_label), ''), 'instructor') AS public_label
       FROM instructor_profiles WHERE user_id = $1`,
      [iid]
    );
    const public_label = parsePublicLabel(prof[0]?.public_label);

    const { rows: subjects } = await db.query(
      `SELECT id, name, sort_order
       FROM instructor_subjects
       WHERE instructor_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [iid]
    );
    const { rows: groups } = await db.query(
      `SELECT id, subject_id, name, sort_order
       FROM instructor_groups
       WHERE instructor_id = $1
       ORDER BY sort_order ASC, name ASC`,
      [iid]
    );
    const byId = new Map(subjects.map((s) => [String(s.id), { id: s.id, name: s.name, sort_order: s.sort_order, groups: [] }]));
    for (const g of groups) {
      const bucket = byId.get(String(g.subject_id));
      if (bucket) bucket.groups.push({ id: g.id, name: g.name, sort_order: g.sort_order });
    }

    res.json({ success: true, public_label, subjects: [...byId.values()] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const patchPublicLabel = async (req, res) => {
  try {
    const pl = parsePublicLabel(req.body?.public_label);
    const { rowCount } = await db.query(`UPDATE instructor_profiles SET public_label = $1 WHERE user_id = $2`, [
      pl,
      req.user.id,
    ]);
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Müəllim profili tapılmadı' });
    }
    res.json({ success: true, public_label: pl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const postSubject = async (req, res) => {
  try {
    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    if (!name) return res.status(400).json({ success: false, message: 'Sahə adı tələb olunur' });
    if (name.length > 200) return res.status(400).json({ success: false, message: 'Sahə adı çox uzundur' });
    const { rows: mx } = await db.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM instructor_subjects WHERE instructor_id = $1`,
      [req.user.id]
    );
    const so = Number(mx[0]?.n) || 0;
    const { rows } = await db.query(
      `INSERT INTO instructor_subjects (instructor_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id, name, sort_order`,
      [req.user.id, name, so]
    );
    res.status(201).json({ success: true, subject: { ...rows[0], groups: [] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const id = req.params.id;
    if (!looksUuid(id)) return res.status(400).json({ success: false, message: 'ID düzgün deyil' });
    const { rowCount } = await db.query(
      `DELETE FROM instructor_subjects WHERE id = $1 AND instructor_id = $2`,
      [id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const postGroup = async (req, res) => {
  try {
    const subject_id = req.body?.subject_id;
    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    if (!looksUuid(subject_id)) return res.status(400).json({ success: false, message: 'Sahə seçilməlidir' });
    if (!name) return res.status(400).json({ success: false, message: 'Qrup adı tələb olunur' });
    if (name.length > 200) return res.status(400).json({ success: false, message: 'Qrup adı çox uzundur' });
    const { rows: sub } = await db.query(`SELECT id FROM instructor_subjects WHERE id = $1 AND instructor_id = $2`, [
      subject_id,
      req.user.id,
    ]);
    if (!sub[0]) return res.status(403).json({ success: false, message: 'Bu sahəyə icazə yoxdur' });
    const { rows: mxg } = await db.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM instructor_groups WHERE subject_id = $1`,
      [subject_id]
    );
    const sgo = Number(mxg[0]?.n) || 0;
    const { rows } = await db.query(
      `INSERT INTO instructor_groups (instructor_id, subject_id, name, sort_order)
       VALUES ($1, $2, $3, $4) RETURNING id, subject_id, name, sort_order`,
      [req.user.id, subject_id, name, sgo]
    );
    res.status(201).json({ success: true, group: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const id = req.params.id;
    if (!looksUuid(id)) return res.status(400).json({ success: false, message: 'ID düzgün deyil' });
    const { rowCount } = await db.query(`DELETE FROM instructor_groups WHERE id = $1 AND instructor_id = $2`, [
      id,
      req.user.id,
    ]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getTeaching,
  patchPublicLabel,
  postSubject,
  deleteSubject,
  postGroup,
  deleteGroup,
};
