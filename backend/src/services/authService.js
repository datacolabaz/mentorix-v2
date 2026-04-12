/**
 * Vahid telefon + PIN girişi (Müəllim / Tələbə / Valideyn).
 * DB: tək `users` cədvəli (role), PIN `pin_hash` (bcrypt). Ayrıca cədvəl yoxdur;
 * məntiqi olaraq rol üzrə sorğu + eyni nömrə üçün rol uyğunluğu yoxlanılır.
 * SMS limiti: `instructor_profiles` (müəllim özü; tələbə/valideyn — aktiv enrollment-dən müəllim).
 */
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { sendSms } = require('./smsService');
const { checkSmsQuota } = require('./smsQuotaService');

/** JS `normalizePhone` ilə eyni: bütün qeyri-rəqəmləri sil (boşluq, mötərizə və s.) */
const PHONE_NORM = "regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g')";

const PHONE_PIN_ROLES = new Set(['instructor', 'student', 'parent']);

const notFoundByRole = {
  instructor: 'Bu nomre ile muellim tapilmadi. Admin terefinden qeydiyyatdan kecdiyinizi yoxlayin.',
  student: 'Bu nomre ile telebe tapilmadi. Admin ve ya muelliminiz terefinden qeydiyyatinizi yoxlayin.',
  parent: 'Bu nomre ile valideyn tapilmadi. Qeydiyyatinizi yoxlayin.',
};

const roleLabelAz = {
  instructor: 'Muellim',
  student: 'Telebe',
  parent: 'Valideyn',
};

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

function generatePhonePin() {
  const len = 4 + Math.floor(Math.random() * 3);
  let pin = '';
  for (let i = 0; i < len; i++) pin += String(Math.floor(Math.random() * 10));
  if (/^0+$/.test(pin)) return generatePhonePin();
  return pin;
}

/** Telefon + seçilmiş rol ilə istifadəçi (aktiv, yalnız giris rollari) */
async function findUserByPhoneAndRole(cleanPhone, role) {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE ${PHONE_NORM} = $1 AND is_active = TRUE AND role = $2`,
    [cleanPhone, role],
  );
  return rows[0] || null;
}

/** Eyni nömrə ilə hansısa giris rolu (telefon UNIQUE — ən çox 1 sətir) */
async function findUserByPhoneAmongLoginRoles(cleanPhone) {
  const { rows } = await db.query(
    `SELECT * FROM users WHERE ${PHONE_NORM} = $1 AND is_active = TRUE
     AND role IN ('instructor','student','parent')`,
    [cleanPhone],
  );
  return rows[0] || null;
}

/** Köhnə klient yalnız telefon göndərəndə (rolsuz) — DB-dən rol təxmini */
async function inferLoginRoleFromPhone(phone) {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  const u = await findUserByPhoneAmongLoginRoles(clean);
  return u?.role ?? null;
}

/**
 * SMS kotası kimin hesabına yazılsın (instructor_profiles.sms_used).
 * Müəllim: özü; tələbə/valideyn: ilk aktiv enrollment müəllimi.
 */
async function resolveSmsBillingInstructorId(user) {
  if (user.role === 'instructor') return user.id;
  if (user.role === 'student') {
    const { rows } = await db.query(
      `SELECT e.instructor_id FROM enrollments e
       WHERE e.student_id = $1 AND e.status = 'active'
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [user.id],
    );
    return rows[0]?.instructor_id || null;
  }
  if (user.role === 'parent') {
    const { rows } = await db.query(
      `SELECT e.instructor_id FROM enrollments e
       INNER JOIN student_profiles sp ON sp.user_id = e.student_id
       WHERE sp.parent_id = $1 AND e.status = 'active'
       ORDER BY e.enrolled_at DESC NULLS LAST
       LIMIT 1`,
      [user.id],
    );
    return rows[0]?.instructor_id || null;
  }
  return null;
}

async function assertSmsQuotaAllowsSend(billingInstructorId) {
  const q = await checkSmsQuota(billingInstructorId, { requireProfile: false });
  if (!q.ok) {
    const err = new Error('SMS_LIMIT');
    err.statusCode = q.statusCode;
    err.payload = q.body;
    throw err;
  }
}

async function deliverPinSms(cleanPhone, plainPin, billingInstructorId) {
  const message = `Mentorix: Giris PIN kodunuz: ${plainPin}. Bu kodu hec kese demeyin.`;
  const result = await sendSms({
    instructorId: billingInstructorId || null,
    phone: cleanPhone,
    message,
  });
  if (!result.success) {
    const err = new Error('SMS_SEND_FAILED');
    err.statusCode = 502;
    err.payload = {
      success: false,
      message: result.error || 'SMS gonderile bilmedi. Bir az sonra yeniden cehd edin.',
    };
    throw err;
  }
}

function badRoleResponse() {
  return {
    status: 400,
    body: { success: false, message: 'Rol teleb olunur: instructor, student ve ya parent' },
  };
}

/**
 * Seçilmiş rol ilə nömrənin hansı hesaba aid olduğunu yoxlayır.
 * @returns {{ user: object } | { status: number, body: object }}
 */
async function resolveLoginUserOrError(cleanPhone, role) {
  if (!role || !PHONE_PIN_ROLES.has(role)) return badRoleResponse();
  if (!cleanPhone) {
    return { status: 400, body: { success: false, message: 'Telefon nomresi teleb olunur' } };
  }

  const byRole = await findUserByPhoneAndRole(cleanPhone, role);
  if (byRole) return { user: byRole };

  const any = await findUserByPhoneAmongLoginRoles(cleanPhone);
  if (any && any.role !== role) {
    const actual = roleLabelAz[any.role] || any.role;
    const wanted = roleLabelAz[role] || role;
    return {
      status: 403,
      body: {
        success: false,
        message: `Bu nomre ${actual} hesabina aiddir. Giris ucun "${wanted}" yerine "${actual}" secin.`,
        actualRole: any.role,
      },
    };
  }

  return {
    status: 404,
    body: { success: false, message: notFoundByRole[role] || 'Istifadeci tapilmadi' },
  };
}

/**
 * 1-ci addım: PIN yoxdursa yaradıb SMS; varsa yalnız PIN ekranı.
 */
async function unifiedPhoneStep(phone, role) {
  if (!role || !PHONE_PIN_ROLES.has(role)) return badRoleResponse();
  const clean = normalizePhone(phone);
  const resolved = await resolveLoginUserOrError(clean, role);
  if (resolved.status) return { status: resolved.status, body: resolved.body };
  const { user } = resolved;

  if (!user.pin_hash) {
    const plain = generatePhonePin();
    const hash = await bcrypt.hash(plain, 12);
    const billingId = await resolveSmsBillingInstructorId(user);
    try {
      await assertSmsQuotaAllowsSend(billingId);
      await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, user.id]);
      await deliverPinSms(clean, plain, billingId);
    } catch (e) {
      await db.query('UPDATE users SET pin_hash = NULL WHERE id = $1', [user.id]).catch(() => {});
      if (e.statusCode && e.payload) return { status: e.statusCode, body: e.payload };
      throw e;
    }
    return {
      status: 200,
      body: {
        success: true,
        awaitingPin: true,
        pinSent: true,
        message: 'PIN kod nomrenize gonderildi. Ilk giris ucun daxil edin',
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      awaitingPin: true,
      pinSent: false,
      message: 'PIN kodunuzu daxil edin',
    },
  };
}

/** 2-ci addım: PIN yoxlama + JWT üçün user payload */
async function unifiedPhoneVerify(phone, role, pinRaw) {
  if (!role || !PHONE_PIN_ROLES.has(role)) return badRoleResponse();
  const clean = normalizePhone(phone);
  const pin = pinRaw != null ? String(pinRaw).trim() : '';
  const resolved = await resolveLoginUserOrError(clean, role);
  if (resolved.status) return { status: resolved.status, body: resolved.body };
  const { user } = resolved;

  if (!pin) {
    return { status: 400, body: { success: false, message: 'Telefon ve PIN teleb olunur' } };
  }
  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return { status: 400, body: { success: false, message: 'PIN 4-6 reqem olmalidir' } };
  }
  if (!user.pin_hash) {
    return {
      status: 400,
      body: { success: false, message: 'Once nomrenizi daxil edin', needsPhoneStep: true },
    };
  }
  const valid = await bcrypt.compare(pin, user.pin_hash);
  if (!valid) {
    return { status: 401, body: { success: false, message: 'PIN yanlisdir' } };
  }
  await db.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [user.id]);
  return {
    status: 200,
    body: {
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        phone_verified: true,
      },
    },
  };
}

/** PIN unutdum: yeni PIN + SMS (limit ilə) */
async function unifiedForgotPin(phone, role) {
  if (!role || !PHONE_PIN_ROLES.has(role)) return badRoleResponse();
  const clean = normalizePhone(phone);
  const resolved = await resolveLoginUserOrError(clean, role);
  if (resolved.status) return { status: resolved.status, body: resolved.body };
  const { user } = resolved;

  const prevHash = user.pin_hash;
  const prevVerified = user.phone_verified;
  const plain = generatePhonePin();
  const hash = await bcrypt.hash(plain, 12);
  const billingId = await resolveSmsBillingInstructorId(user);
  try {
    await assertSmsQuotaAllowsSend(billingId);
    await db.query('UPDATE users SET pin_hash = $1, phone_verified = FALSE WHERE id = $2', [hash, user.id]);
    await deliverPinSms(clean, plain, billingId);
  } catch (e) {
    await db
      .query('UPDATE users SET pin_hash = $1, phone_verified = $2 WHERE id = $3', [prevHash, prevVerified, user.id])
      .catch(() => {});
    if (e.statusCode && e.payload) return { status: e.statusCode, body: e.payload };
    throw e;
  }
  return {
    status: 200,
    body: {
      success: true,
      awaitingPin: true,
      pinSent: true,
      message: 'Yeni PIN kod nomrenize gonderildi',
    },
  };
}

/**
 * Köhnə / pin/login: rol göndərilmir; telefon UNIQUE ilə user tapılır.
 * PIN yoxdursa eyni SMS + limit məntiqi.
 */
async function unifiedLoginWithPinBody(phone, pin) {
  const clean = normalizePhone(phone);
  if (!clean) {
    return { status: 400, body: { success: false, message: 'Telefon nomresi teleb olunur' } };
  }
  const { rows } = await db.query(
    `SELECT * FROM users WHERE ${PHONE_NORM} = $1 AND is_active = TRUE`,
    [clean],
  );
  const user = rows[0];
  if (!user) {
    return { status: 404, body: { success: false, message: 'Istifadeci tapilmadi' } };
  }
  if (!PHONE_PIN_ROLES.has(user.role)) {
    return { status: 403, body: { success: false, message: 'Bu giris novu telefon ile desteklenmir' } };
  }

  if (!user.pin_hash) {
    const plain = generatePhonePin();
    const hash = await bcrypt.hash(plain, 12);
    const billingId = await resolveSmsBillingInstructorId(user);
    try {
      await assertSmsQuotaAllowsSend(billingId);
      await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [hash, user.id]);
      await deliverPinSms(clean, plain, billingId);
    } catch (e) {
      await db.query('UPDATE users SET pin_hash = NULL WHERE id = $1', [user.id]).catch(() => {});
      if (e.statusCode && e.payload) return { status: e.statusCode, body: e.payload };
      throw e;
    }
    return {
      status: 400,
      body: {
        success: false,
        pinSent: true,
        message: 'PIN nomrenize SMS ile gonderildi. PIN-i daxil edib yeniden cehd edin.',
      },
    };
  }
  if (pin == null || String(pin).trim() === '') {
    return { status: 400, body: { success: false, message: 'PIN daxil edin' } };
  }
  const valid = await bcrypt.compare(String(pin).trim(), user.pin_hash);
  if (!valid) {
    return { status: 401, body: { success: false, message: 'PIN yanlisdir' } };
  }
  await db.query('UPDATE users SET phone_verified = TRUE WHERE id = $1', [user.id]);
  return {
    status: 200,
    body: {
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        phone_verified: true,
      },
    },
  };
}

module.exports = {
  normalizePhone,
  generatePhonePin,
  PHONE_PIN_ROLES,
  notFoundByRole,
  inferLoginRoleFromPhone,
  unifiedPhoneStep,
  unifiedPhoneVerify,
  unifiedForgotPin,
  unifiedLoginWithPinBody,
};
