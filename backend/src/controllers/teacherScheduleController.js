const db = require('../utils/db');

function normInst(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function sameUuid(a, b) {
  if (a == null || b == null) return false;
  return normInst(a) === normInst(b);
}

function parseDay(v) {
  const d = parseInt(String(v), 10);
  if (!Number.isFinite(d) || d < 1 || d > 7) return null;
  return d;
}

/** HH:MM və ya HH:MM:SS */
function parseTime(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const sec = m[3] != null ? parseInt(m[3], 10) : 0;
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function toMinutes(t) {
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

const listMine = async (req, res) => {
  try {
    const iid = req.user.role === 'admin' ? req.query.instructor_id || req.user.id : req.user.id;
    const { rows } = await db.query(
      `SELECT ts.id, ts.instructor_id, ts.day_of_week, ts.start_time, ts.end_time,
              ts.is_occupied, ts.enrollment_id, ts.student_id, ts.subject_id, ts.group_id, ts.created_at,
              u.full_name AS student_name
       FROM teacher_schedules ts
       LEFT JOIN users u ON u.id = ts.student_id
       WHERE REPLACE(LOWER(TRIM(ts.instructor_id::text)), '-', '') = $1
       ORDER BY ts.day_of_week, ts.start_time`,
      [normInst(iid)]
    );
    res.json({ success: true, slots: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Tələbə əlavə formu: boş slotlar + slot mütləqdirsə */
const forEnrollment = async (req, res) => {
  try {
    const iid = req.user.id;
    const ni = normInst(iid);
    const { rows: c } = await db.query(
      `SELECT COUNT(*)::int AS n FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1`,
      [ni]
    );
    const totalSlots = c[0]?.n || 0;
    const { rows: avail } = await db.query(
      `SELECT id, day_of_week, start_time, end_time
       FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
         AND is_occupied = FALSE
       ORDER BY day_of_week, start_time`,
      [ni]
    );
    res.json({
      success: true,
      requiresScheduleSlot: totalSlots > 0,
      availableSlots: avail,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

async function hasOverlap(client, instructorId, day, startT, endT, excludeId) {
  const ni = normInst(instructorId);
  const { rows } = await client.query(
    `SELECT id FROM teacher_schedules
     WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
       AND day_of_week = $2
       AND NOT (end_time <= $3::time OR start_time >= $4::time)
       ${excludeId ? 'AND id <> $5::uuid' : ''}`,
    excludeId ? [ni, day, startT, endT, excludeId] : [ni, day, startT, endT]
  );
  return rows.length > 0;
}

const createSlot = async (req, res) => {
  try {
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    if (!instructor_id) {
      return res.status(400).json({ success: false, message: 'instructor_id tələb olunur' });
    }
    const day = parseDay(req.body.day_of_week);
    const start = parseTime(req.body.start_time);
    const end = parseTime(req.body.end_time);
    if (day == null || !start || !end) {
      return res.status(400).json({ success: false, message: 'Gün və ya vaxt yanlışdır' });
    }
    if (toMinutes(start) >= toMinutes(end)) {
      return res.status(400).json({ success: false, message: 'Bitmə vaxtı başlanğıcdan böyük olmalıdır' });
    }

    const overlap = await hasOverlap(db, instructor_id, day, start, end, null);
    if (overlap) {
      return res.status(409).json({ success: false, message: 'Bu vaxtda artıq slot var' });
    }

    const { rows } = await db.query(
      `INSERT INTO teacher_schedules (instructor_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3::time, $4::time) RETURNING *`,
      [instructor_id, day, start, end]
    );
    res.json({ success: true, slot: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: 'Bu slot artıq mövcuddur' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const generateSlots = async (req, res) => {
  try {
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    const { days, slot_start, slot_end, step_minutes } = req.body;
    if (!instructor_id) {
      return res.status(400).json({ success: false, message: 'instructor_id tələb olunur' });
    }
    if (!Array.isArray(days) || !days.length) {
      return res.status(400).json({ success: false, message: 'Ən azı bir gün seçin' });
    }
    const step = parseInt(String(step_minutes || 60), 10);
    if (!Number.isFinite(step) || step < 15 || step > 240) {
      return res.status(400).json({ success: false, message: 'Addım 15–240 dəq arası olmalıdır' });
    }
    const startS = parseTime(slot_start || '09:00');
    const endS = parseTime(slot_end || '20:00');
    if (!startS || !endS || toMinutes(startS) >= toMinutes(endS)) {
      return res.status(400).json({ success: false, message: 'Ümumi iş saatları yanlışdır' });
    }

    let created = 0;
    await db.transaction(async (client) => {
      for (const dv of days) {
        const day = parseDay(dv);
        if (day == null) continue;
        let cur = toMinutes(startS);
        const endM = toMinutes(endS);
        while (cur + step <= endM) {
          const next = cur + step;
          const st = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}:00`;
          const en = `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(next % 60).padStart(2, '0')}:00`;
          const o = await hasOverlap(client, instructor_id, day, st, en, null);
          if (!o) {
            try {
              await client.query(
                `INSERT INTO teacher_schedules (instructor_id, day_of_week, start_time, end_time)
                 VALUES ($1, $2, $3::time, $4::time)`,
                [instructor_id, day, st, en]
              );
              created += 1;
            } catch (e) {
              if (e.code !== '23505') throw e;
            }
          }
          cur = next;
        }
      }
    });
    res.json({ success: true, created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(
      `SELECT * FROM teacher_schedules WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(rows[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (rows[0].enrollment_id != null) {
      return res.status(400).json({
        success: false,
        message: 'Bu slot tələbəyə bağlıdır — əvvəl qeydiyyatı silin',
      });
    }
    await db.query(`DELETE FROM teacher_schedules WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Boş slotu əl ilə məşğul (blok) et */
const blockSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`SELECT * FROM teacher_schedules WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(rows[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (rows[0].is_occupied) {
      return res.status(400).json({ success: false, message: 'Slot artıq məşğuldur' });
    }
    await db.query(
      `UPDATE teacher_schedules SET is_occupied = TRUE WHERE id = $1`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Tələbəsiz məşğul slotu yenidən boşalt */
const unblockSlot = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query(`SELECT * FROM teacher_schedules WHERE id = $1`, [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (req.user.role === 'instructor' && !sameUuid(rows[0].instructor_id, req.user.id)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    if (rows[0].enrollment_id != null) {
      return res.status(400).json({ success: false, message: 'Tələbə slotunu buradan boşaltmaq olmaz' });
    }
    await db.query(
      `UPDATE teacher_schedules SET is_occupied = FALSE WHERE id = $1`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Boş və blok (tələbəsiz) slotları sil; tələbəyə bağlı slotlar saxlanılır */
const clearUnassignedSlots = async (req, res) => {
  try {
    const instructor_id = req.user.role === 'admin' ? req.body.instructor_id : req.user.id;
    if (!instructor_id) {
      return res.status(400).json({ success: false, message: 'instructor_id tələb olunur' });
    }
    const ni = normInst(instructor_id);

    const { rows: kept } = await db.query(
      `SELECT COUNT(*)::int AS n FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
         AND enrollment_id IS NOT NULL`,
      [ni]
    );

    const { rows } = await db.query(
      `DELETE FROM teacher_schedules
       WHERE REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $1
         AND enrollment_id IS NULL
       RETURNING id`,
      [ni]
    );

    res.json({
      success: true,
      deletedCount: rows.length,
      keptWithStudent: kept[0]?.n || 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  listMine,
  forEnrollment,
  createSlot,
  generateSlots,
  deleteSlot,
  blockSlot,
  unblockSlot,
  clearUnassignedSlots,
};
