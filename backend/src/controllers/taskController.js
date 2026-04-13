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
              COUNT(a.id)::int AS assigned_count,
              COUNT(a.id) FILTER (WHERE a.status = 'done')::int AS done_count
       FROM instructor_tasks t
       LEFT JOIN task_assignments a ON a.task_id = t.id
       WHERE t.instructor_id = $1
       GROUP BY t.id
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
    const description = req.body.description != null ? String(req.body.description).trim() : '';
    const due_date = parseDate(req.body.due_date);
    const student_ids = Array.isArray(req.body.student_ids)
      ? [...new Set(req.body.student_ids.filter((x) => x != null && String(x).trim() !== ''))]
      : null;

    if (!title) return res.status(400).json({ success: false, message: 'Başlıq tələb olunur' });

    const out = await db.transaction(async (client) => {
      const { rows: trows } = await client.query(
        `INSERT INTO instructor_tasks (instructor_id, title, description, due_date)
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [instructorId, title, description || null, due_date]
      );
      const task = trows[0];

      let targets = student_ids;
      if (!targets) {
        const { rows: enr } = await client.query(
          `SELECT DISTINCT e.student_id
           FROM enrollments e
           WHERE e.instructor_id = $1 AND e.status = 'active'`,
          [instructorId]
        );
        targets = enr.map((r) => r.student_id).filter(Boolean);
      } else {
        // yalnız bu müəllimin aktiv tələbələri
        const { rows: ok } = await client.query(
          `SELECT DISTINCT e.student_id
           FROM enrollments e
           WHERE e.instructor_id = $1 AND e.status = 'active' AND e.student_id = ANY($2::uuid[])`,
          [instructorId, targets]
        );
        targets = ok.map((r) => r.student_id).filter(Boolean);
      }

      if (targets.length) {
        await client.query(
          `INSERT INTO task_assignments (task_id, student_id, status)
           SELECT $1::uuid, x::uuid, 'assigned'
           FROM UNNEST($2::uuid[]) AS x
           ON CONFLICT (task_id, student_id) DO NOTHING`,
          [task.id, targets]
        );
      }

      return { task, assignedCount: targets.length };
    });

    res.status(201).json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listMyTasks = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { rows } = await db.query(
      `SELECT a.id AS assignment_id, a.status, a.done_at, a.seen_at, a.created_at AS assigned_at,
              t.id AS task_id, t.title, t.description, t.due_date, t.created_at AS task_created_at,
              t.instructor_id, u.full_name AS instructor_name
       FROM task_assignments a
       JOIN instructor_tasks t ON t.id = a.task_id
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

const markMyTaskDone = async (req, res) => {
  try {
    const studentId = req.user.id;
    const id = req.params.id;
    const { rowCount } = await db.query(
      `UPDATE task_assignments
       SET status = 'done', done_at = NOW()
       WHERE id = $1 AND student_id = $2`,
      [id, studentId]
    );
    if (rowCount === 0) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listInstructorTasks,
  createInstructorTask,
  listMyTasks,
  markMyTaskDone,
};

