const {
  getPublicJoinInfo,
  createJoinRequest,
  listPendingJoinRequests,
  countPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} = require('../services/joinInvitationService');
const {
  listPendingExamAccessRequests,
  countPendingExamAccessRequests,
  approveExamAccessRequest,
  rejectExamAccessRequest,
  isMissingExamAccessTableError,
} = require('../services/examAccessRequestService');

const getPublicJoin = async (req, res) => {
  try {
    const code = req.params.code;
    const info = await getPublicJoinInfo(code);
    res.json({ success: true, ...info });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

const listJoinRequests = async (req, res) => {
  try {
    const warnings = [];
    const groupRequests = await listPendingJoinRequests(req.user.id);
    let examRequests = [];
    try {
      examRequests = await listPendingExamAccessRequests(req.user.id);
    } catch (e) {
      if (isMissingExamAccessTableError(e)) {
        warnings.push(
          'İmtahan sorğuları aktiv deyil: serverdə «node scripts/migrate.js» (migrasiya 126) işə salın.',
        );
      } else {
        warnings.push(e.message || 'İmtahan sorğuları yüklənmədi');
      }
    }
    const requests = [
      ...groupRequests.map((r) => ({ ...r, kind: 'group_join' })),
      ...examRequests,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, requests, warnings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Sorğular boşdursa: migrasiya / DB diaqnostikası */
const joinRequestsDiagnostics = async (req, res) => {
  try {
    let examTableOk = true;
    let examTableError = null;
    try {
      await require('../utils/db').query('SELECT 1 FROM exam_access_requests LIMIT 1');
    } catch (e) {
      examTableOk = false;
      examTableError = e.message;
    }
    const db = require('../utils/db');
    const instructorId = req.user.id;
    let pending = 0;
    let total = 0;
    let recent = [];
    if (examTableOk) {
      const { rows: counts } = await db.query(
        `SELECT
           COUNT(*) FILTER (WHERE UPPER(TRIM(status)) = 'PENDING')::int AS pending,
           COUNT(*)::int AS total
         FROM exam_access_requests
         WHERE instructor_id = $1::uuid`,
        [instructorId],
      );
      pending = Number(counts[0]?.pending ?? 0) || 0;
      total = Number(counts[0]?.total ?? 0) || 0;
      const { rows } = await db.query(
        `SELECT ear.id, ear.status, ear.created_at, ear.student_name, ear.student_email,
                e.title AS exam_title
         FROM exam_access_requests ear
         JOIN exams e ON e.id = ear.exam_id
         WHERE ear.instructor_id = $1::uuid
         ORDER BY ear.created_at DESC
         LIMIT 8`,
        [instructorId],
      );
      recent = rows;
    }
    res.json({
      success: true,
      exam_access_table_ok: examTableOk,
      exam_access_table_error: examTableError,
      exam_requests_pending: pending,
      exam_requests_total: total,
      recent_exam_requests: recent,
      share_link_hint: 'İmtahanlar → link kopyala — URL /exam/... olmalıdır',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const joinRequestsCount = async (req, res) => {
  try {
    const groupCount = await countPendingJoinRequests(req.user.id);
    let examCount = 0;
    try {
      examCount = await countPendingExamAccessRequests(req.user.id);
    } catch (e) {
      if (!isMissingExamAccessTableError(e)) throw e;
    }
    res.json({ success: true, count: groupCount + examCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const approveRequest = async (req, res) => {
  try {
    const kind = String(req.body?.kind || req.query?.kind || 'group_join').trim();
    const sendSms =
      req.body?.send_sms === true ||
      req.body?.send_sms === 'true' ||
      req.body?.send_sms === 1;
    const result =
      kind === 'exam_access'
        ? await approveExamAccessRequest(req.params.id, req.user.id, { sendSms })
        : await approveJoinRequest(req.params.id, req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const kind = String(req.body?.kind || req.query?.kind || 'group_join').trim();
    const result =
      kind === 'exam_access'
        ? await rejectExamAccessRequest(req.params.id, req.user.id)
        : await rejectJoinRequest(req.params.id, req.user.id, req.body?.reason);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const submitJoinWithProfile = async (req, res) => {
  try {
    const {
      code,
      first_name,
      last_name,
      phone_number,
      parent_name,
      parent_phone,
    } = req.body || {};
    const result = await createJoinRequest({
      studentId: req.user.id,
      code,
      first_name,
      last_name,
      phone_number,
      parent_name,
      parent_phone,
      payment_terms_accepted: Boolean(req.body?.payment_terms_accepted),
      referral_source_id: req.body?.referral_source_id,
      referral_notes: req.body?.referral_notes,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

module.exports = {
  getPublicJoin,
  listJoinRequests,
  joinRequestsDiagnostics,
  joinRequestsCount,
  approveRequest,
  rejectRequest,
  submitJoinWithProfile,
};
