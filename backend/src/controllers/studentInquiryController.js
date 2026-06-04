const db = require('../utils/db');
const {
  isDiscoverPremium,
  getInstructorPlanSlug,
  countInquiryContactsViewedThisMonth,
  FREE_INQUIRY_CONTACTS_PER_MONTH,
} = require('../services/discoverMarketplaceService');

const ALLOWED_FORMATS = ['online', 'teacher_place', 'student_place'];

/** POST /api/public/inquiries — valideyn/tələbə müraciəti */
const postPublicInquiry = async (req, res) => {
  try {
    const instructorUserId = String(req.body?.instructor_user_id || '').trim();
    const requesterName = String(req.body?.requester_name || '').trim();
    const requesterPhone = String(req.body?.requester_phone || '').replace(/\s/g, '');
    const categoryId = req.body?.category_id ? String(req.body.category_id).trim() : null;
    let deliveryFormat = req.body?.delivery_format ? String(req.body.delivery_format).toLowerCase() : null;
    const studentLevel = req.body?.student_level ? String(req.body.student_level).slice(0, 120) : null;
    const message = req.body?.message ? String(req.body.message).slice(0, 2000) : null;

    if (!instructorUserId || !requesterName || !requesterPhone) {
      return res.status(400).json({ success: false, message: 'Müəllim, ad və telefon mütləqdir' });
    }
    if (deliveryFormat && !ALLOWED_FORMATS.includes(deliveryFormat)) deliveryFormat = null;

    const { rows: inst } = await db.query(
      `SELECT u.id FROM users u
       INNER JOIN instructor_profiles ip ON ip.user_id = u.id
       WHERE u.id = $1 AND u.role = 'instructor' AND COALESCE(ip.map_visible, TRUE) = TRUE
       LIMIT 1`,
      [instructorUserId],
    );
    if (!inst.length) {
      return res.status(404).json({ success: false, message: 'Müəllim tapılmadı və ya axtarışda deaktivdir' });
    }

    const { rows } = await db.query(
      `INSERT INTO student_inquiries (
         instructor_user_id, category_id, requester_name, requester_phone,
         delivery_format, student_level, message
       ) VALUES ($1,$2,$3,$4,$5::delivery_format,$6,$7)
       RETURNING id, created_at, status`,
      [instructorUserId, categoryId, requesterName, requesterPhone, deliveryFormat, studentLevel, message],
    );

    res.status(201).json({
      success: true,
      message: 'Müraciətiniz göndərildi. Müəllim tezliklə sizinlə əlaqə saxlayacaq.',
      inquiry: rows[0],
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

/** GET /api/instructor/inquiries */
const listInstructorInquiries = async (req, res) => {
  try {
    const uid = req.user.id;
    const plan = await getInstructorPlanSlug(uid);
    const premium = isDiscoverPremium(plan);
    const viewed = await countInquiryContactsViewedThisMonth(uid);

    const { rows } = await db.query(
      `SELECT si.id, si.requester_name, si.requester_phone, si.delivery_format, si.student_level,
              si.message, si.status, si.created_at, si.contact_revealed_at,
              c.name_az AS category_name
       FROM student_inquiries si
       LEFT JOIN categories c ON c.id = si.category_id
       WHERE si.instructor_user_id = $1
       ORDER BY si.created_at DESC
       LIMIT 100`,
      [uid],
    );

    const maskPhone = (phone, revealed) => {
      if (revealed || premium) return phone;
      if (!phone || phone.length < 6) return '••••••';
      return `${phone.slice(0, 4)}••••${phone.slice(-2)}`;
    };

    let revealBudget = premium ? Infinity : Math.max(0, FREE_INQUIRY_CONTACTS_PER_MONTH - viewed);
    const inquiries = rows.map((row) => {
      const alreadyRevealed = Boolean(row.contact_revealed_at);
      const canReveal = premium || alreadyRevealed || revealBudget > 0;
      if (!alreadyRevealed && canReveal && !premium) revealBudget -= 1;
      return {
        ...row,
        phone_masked: maskPhone(row.requester_phone, alreadyRevealed || (premium && canReveal)),
        phone_visible: alreadyRevealed || premium,
        can_reveal_contact: canReveal && !alreadyRevealed,
      };
    });

    res.json({
      success: true,
      inquiries,
      usage: {
        contacts_viewed_this_month: viewed,
        monthly_limit: premium ? null : FREE_INQUIRY_CONTACTS_PER_MONTH,
        premium,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

/** POST /api/instructor/inquiries/:id/reveal-contact */
const revealInquiryContact = async (req, res) => {
  try {
    const uid = req.user.id;
    const id = req.params.id;
    const plan = await getInstructorPlanSlug(uid);
    const premium = isDiscoverPremium(plan);

    const { rows } = await db.query(
      `SELECT id, requester_phone, contact_revealed_at FROM student_inquiries
       WHERE id = $1 AND instructor_user_id = $2 LIMIT 1`,
      [id, uid],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Sorğu tapılmadı' });
    const row = rows[0];
    if (row.contact_revealed_at) {
      return res.json({ success: true, phone: row.requester_phone });
    }
    if (!premium) {
      const viewed = await countInquiryContactsViewedThisMonth(uid);
      if (viewed >= FREE_INQUIRY_CONTACTS_PER_MONTH) {
        return res.status(403).json({
          success: false,
          message: `Pulsuz paketdə ayda ən çox ${FREE_INQUIRY_CONTACTS_PER_MONTH} sorğunun nömrəsini görə bilərsiniz. PRO paketə keçin.`,
          upgrade_required: true,
        });
      }
    }
    await db.query(
      `UPDATE student_inquiries SET contact_revealed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id],
    );
    res.json({ success: true, phone: row.requester_phone });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = {
  postPublicInquiry,
  listInstructorInquiries,
  revealInquiryContact,
};
