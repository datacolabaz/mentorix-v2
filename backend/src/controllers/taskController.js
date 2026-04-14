const db = require('../utils/db');

function parseDate(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

const listInstructorTasks = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { rows } = await db.query(
      `SELECT t.*,
              COALESCE(c.assigned_count, 0)::int AS assigned_count,
              COALESCE(c.done_count, 0)::int AS done_count,
              COALESCE(r.recipients, '[]'::json) AS recipients
       FROM assignments t
       LEFT JOIN (
         SELECT assignment_id,
                COUNT(*)::int AS assigned_count,
                COUNT(*) FILTER (WHERE status = 'completed')::int AS done_count
         FROM student_assignments
         GROUP BY assignment_id
       ) c ON c.assignment_id = t.id
       LEFT JOIN (
         SELECT a.assignment_id,
                json_agg(
                  json_build_object(
                    'student_id', a.student_id,
                    'full_name', u.full_name,
                    'status', a.status,
                    'student_assignment_id', a.id
                  )
                  ORDER BY u.full_name
                ) AS recipients
         FROM student_assignments a
         JOIN users u ON u.id = a.student_id
         GROUP BY a.assignment_id
       ) r ON r.assignment_id = t.id
       WHERE t.instructor_id = $1
       ORDER BY t.created_at DESC`,
      [instructorId]
    );
    res.json({ success: true, tasks: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createInstructorTask = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const title = String(req.body.title || '').trim();
    const topic = req.body.topic != null ? String(req.body.topic).trim() : '';
    const description = req.body.description != null ? String(req.body.description).trim() : '';
    const due_date = parseDate(req.body.due_date);
    const student_ids = Array.isArray(req.body.student_ids)
      ? [...new Set(req.body.student_ids.filter((x) => x != null && String(x).trim() !== ''))]
      : [];

    if (!title) return res.status(400).json({ success: false, message: 'Tapşırığın adı tələb olunur' });
    if (!student_ids.length) {
      return res.status(400).json({ success: false, message: 'Ən azı bir tələbə seçin' });
    }

    const out = await db.transaction(async (client) => {
      const { rows: trows } = await client.query(
        `INSERT INTO assignments (instructor_id, title, topic, description, due_date)
         VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),$5) RETURNING *`,
        [instructorId, title, topic || null, description || null, due_date]
      );
      const task = trows[0];

      const { rows: ok } = await client.query(
        `SELECT DISTINCT e.student_id
         FROM enrollments e
         WHERE e.instructor_id = $1 AND e.status = 'active' AND e.student_id = ANY($2::uuid[])`,
        [instructorId, student_ids]
      );
      const targets = ok.map((r) => r.student_id).filter(Boolean);

      if (!targets.length) {
        throw new Error('Seçilmiş tələbələrdən heç biri bu müəllimin aktiv siyahısında deyil');
      }

      await client.query(
        `INSERT INTO student_assignments (assignment_id, student_id, status)
         SELECT $1::uuid, x::uuid, 'pending'
         FROM UNNEST($2::uuid[]) AS x
         ON CONFLICT (assignment_id, student_id) DO NOTHING`,
        [task.id, targets]
      );

      return { task, assignedCount: targets.length };
    });

    res.status(201).json({ success: true, ...out });
  } catch (err) {
    const msg = err.message || 'Xəta';
    if (msg.includes('aktiv siyahısında')) {
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: msg });
  }
};

/** Müəllim tapşırığı silir — student_assignments ON DELETE CASCADE ilə silinir */
const deleteInstructorAssignment = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const id = req.params.id;
    const { rowCount } = await db.query(
      `DELETE FROM assignments WHERE id = $1 AND instructor_id = $2`,
      [id, instructorId]
    );
    if (rowCount === 0) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listMyTasks = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { rows } = await db.query(
      `SELECT a.id AS assignment_id, a.status, a.done_at, a.seen_at, a.created_at AS assigned_at,
              t.id AS task_id, t.title, t.topic, t.description, t.due_date, t.created_at AS assignment_created_at,
              t.instructor_id, u.full_name AS instructor_name
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       JOIN users u ON u.id = t.instructor_id
       WHERE a.student_id = $1
       ORDER BY COALESCE(t.due_date, DATE '2999-12-31') ASC, t.created_at DESC`,
      [studentId]
    );
    res.json({ success: true, tasks: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Yalnız öz student_assignments sətri — başqa tələbənin sətri URL ilə tamamlanmır */
const markMyTaskDone = async (req, res) => {
  try {
    const studentId = req.user.id;
    const id = req.params.id;
    const { rowCount } = await db.query(
      `UPDATE student_assignments
       SET status = 'completed', done_at = NOW()
       WHERE id = $1 AND student_id = $2 AND status = 'pending'`,
      [id, studentId]
    );
    if (rowCount > 0) return res.json({ success: true });

    const { rows } = await db.query(
      `SELECT student_id, status FROM student_assignments WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (String(rows[0].student_id) !== String(studentId)) {
      return res.status(403).json({ success: false, message: 'Bu tapşırıq sizə aid deyil' });
    }
    if (rows[0].status === 'completed') return res.json({ success: true, already: true });
    return res.status(400).json({ success: false, message: 'Əməliyyat mümkün deyil' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listInstructorTasks,
  createInstructorTask,
  deleteInstructorAssignment,
  listMyTasks,
  markMyTaskDone,
};
