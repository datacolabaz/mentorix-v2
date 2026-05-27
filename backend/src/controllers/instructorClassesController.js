const db = require('../utils/db');

async function generateUniqueJoinCode() {
  for (let i = 0; i < 50; i++) {
    const code = `MX-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    const { rows } = await db.query(`SELECT 1 FROM instructor_groups WHERE join_code = $1 LIMIT 1`, [code]);
    if (!rows[0]) return code;
  }
  throw new Error('Join code yaradıla bilmədi');
}

const listClasses = async (req, res) => {
  try {
    const iid = req.user.id;
    const { rows } = await db.query(
      `SELECT ig.id,
              ig.name,
              ig.subject_id,
              COALESCE(NULLIF(TRIM(ist.name), ''), 'Sahəsiz') AS subject,
              ig.join_code,
              ig.join_code_expires_at,
              COALESCE(cnt.n, 0) AS student_count
       FROM instructor_groups ig
       LEFT JOIN instructor_subjects ist ON ist.id = ig.subject_id
       LEFT JOIN (
         SELECT e.group_id, COUNT(DISTINCT e.student_id) AS n
         FROM enrollments e
         WHERE COALESCE(LOWER(TRIM(e.status)), 'active') = 'active'
           AND e.group_id IS NOT NULL
         GROUP BY e.group_id
       ) cnt ON cnt.group_id = ig.id
       WHERE ig.instructor_id = $1
       ORDER BY subject ASC, ig.sort_order ASC, ig.name ASC`,
      [iid],
    );

    // Build invite link in frontend; keep API simple.
    res.json({ success: true, classes: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const rotateJoinCode = async (req, res) => {
  try {
    const iid = req.user.id;
    const gid = String(req.params.id || '').trim();
    if (!gid) return res.status(400).json({ success: false, message: 'ID tələb olunur' });
    const code = await generateUniqueJoinCode();
    const { rows } = await db.query(
      `UPDATE instructor_groups
       SET join_code = $3,
           join_code_expires_at = NULL
       WHERE id = $1 AND instructor_id = $2
       RETURNING id, join_code, join_code_expires_at`,
      [gid, iid, code],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true, group: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { listClasses, rotateJoinCode };

