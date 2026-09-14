const db = require('../utils/db');
const {
  isPersonaId,
  authRoleForPersona,
  personaFromLegacyRole,
  sanitizePersonaProfile,
  requiredProfileComplete,
  parseStoredProfile,
  mergePersonaProfile,
  isAdminRole,
  rowNeedsOnboarding,
  PERSONAS,
} = require('../config/personas');
const { grantUserRole } = require('./userRolesService');
const { rolesToGrantAfterPersonaChange } = require('../lib/multiRoleMembership');

function badRequest(message, code = 'INVALID_PERSONA') {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = code;
  return err;
}

async function fetchPersonaState(userId) {
  try {
    const { rows } = await db.query(
      `SELECT id, role, role_selected, persona, persona_profile, onboarding_completed
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId],
    );
    return rows[0] || null;
  } catch {
    try {
      const { rows } = await db.query(
        `SELECT id, role, role_selected FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      const row = rows[0];
      if (!row) return null;
      return { ...row, persona: null, persona_profile: {}, onboarding_completed: row.role_selected !== false };
    } catch {
      return null;
    }
  }
}

async function userNeedsOnboarding(userId) {
  const row = await fetchPersonaState(userId);
  if (!row) return true;
  return rowNeedsOnboarding(row);
}

function attachPersonaFields(userLite, row = null) {
  if (!userLite) return userLite;
  const src = row || userLite;
  return {
    ...userLite,
    persona: src.persona || null,
    persona_profile: parseStoredProfile(src.persona_profile),
    onboarding_completed: src.onboarding_completed === true,
  };
}

async function provisionForAuthRole(client, { userId, authRole, fullName, persona, profile, req, grantTrial }) {
  if (authRole === 'instructor') {
    const { rows: existing } = await client.query(
      'SELECT user_id, subject FROM instructor_profiles WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    if (!existing[0]) {
      await client.query(
        `INSERT INTO instructor_profiles (user_id, subject, billing_type)
         VALUES ($1, $2, '8_lessons')
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, profile.subject || null],
      );
    } else if (persona === PERSONAS.TEACHER && profile.subject && !existing[0].subject) {
      await client.query(
        `UPDATE instructor_profiles SET subject = $2 WHERE user_id = $1 AND (subject IS NULL OR TRIM(subject) = '')`,
        [userId, profile.subject],
      );
    }
    if (persona === PERSONAS.TEACHER) {
      await grantUserRole(userId, 'course', client);
      await client.query(
        `INSERT INTO course_profiles (user_id, course_name)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, fullName || 'Kurs'],
      );
    }
    if (grantTrial) {
      const { grantBasicTrialForInstructor } = require('./basicTrialIpService');
      const { clientIp } = require('../utils/clientIp');
      const { BASIC_TRIAL_DAYS } = require('../config/billingTrial');
      let trialDays = BASIC_TRIAL_DAYS;
      try {
        const { resolveTrialDaysForUser } = require('./partner/partnerTrialService');
        trialDays = await resolveTrialDaysForUser(userId);
      } catch {
        // keep BASIC_TRIAL_DAYS
      }
      await grantBasicTrialForInstructor(client, userId, clientIp(req));
      await client.query(
        `INSERT INTO subscriptions (user_id, plan, status, current_period_start, current_period_end, updated_at)
         VALUES ($1, 'basic', 'active', NOW(), NOW() + ($2 || ' days')::interval, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           plan = CASE WHEN subscriptions.plan IS NULL OR LOWER(TRIM(subscriptions.plan)) = 'basic'
                  THEN 'basic' ELSE subscriptions.plan END,
           current_period_start = COALESCE(subscriptions.current_period_start, NOW()),
           current_period_end = COALESCE(
             subscriptions.current_period_end,
             NOW() + ($2 || ' days')::interval
           ),
           updated_at = NOW()`,
        [userId, String(trialDays)],
      );
    }
    return;
  }

  if (authRole === 'course') {
    const courseName = profile.center_name || fullName || 'Təhsil mərkəzi';
    await client.query(
      `INSERT INTO course_profiles (user_id, course_name)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET
         course_name = CASE
           WHEN course_profiles.course_name IS NULL OR TRIM(course_profiles.course_name) = ''
           THEN EXCLUDED.course_name
           ELSE course_profiles.course_name
         END,
         updated_at = NOW()`,
      [userId, courseName],
    );
    return;
  }

  if (authRole === 'student') {
    await client.query(
      'INSERT INTO student_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [userId],
    ).catch(() => {});
  }
}

/**
 * Apply or change a persona. Never deletes previous persona_profile slices.
 * @param {{ requireComplete?: boolean, merge?: boolean }} opts
 */
async function applyPersonaSelection({ userId, persona, profile, req, requireComplete = true, merge = true }) {
  const personaId = String(persona || '').trim();
  if (!isPersonaId(personaId)) {
    throw badRequest('İstifadə məqsədini seçin', 'INVALID_PERSONA');
  }

  const sanitized = sanitizePersonaProfile(personaId, profile);
  if (requireComplete && !requiredProfileComplete(personaId, sanitized)) {
    throw badRequest('Zəhmət olmasa bütün məlumatları doldurun', 'INCOMPLETE_PROFILE');
  }

  let authRole = authRoleForPersona(personaId);

  await db.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const me = rows[0];
    if (!me || me.is_active === false) {
      const err = new Error('Tapılmadı');
      err.statusCode = 404;
      throw err;
    }

    const nextProfile = merge
      ? mergePersonaProfile(me.persona_profile, personaId, sanitized)
      : { [personaId]: sanitized, current: personaId };

    // Partner = referral purpose only. Keep existing auth role so users can switch
    // back to teacher/participant later without losing cabinet access.
    if (personaId === PERSONAS.PARTNER || !authRole) {
      const current = String(me.role || '').trim().toLowerCase();
      authRole = current && current !== 'admin' ? current : 'student';
    }

    const alreadyInstructor = me.role === 'instructor';
    const { rows: instRows } = await client.query(
      'SELECT 1 FROM instructor_profiles WHERE user_id = $1 LIMIT 1',
      [userId],
    );
    const grantTrial =
      personaId !== PERSONAS.PARTNER &&
      authRole === 'instructor' &&
      !alreadyInstructor &&
      !instRows[0];

    const previousRole = String(me.role || '').trim().toLowerCase();
    const previousPersona = String(me.persona || '').trim() || null;

    await client.query(
      `UPDATE users
       SET persona = $2,
           persona_profile = $3::jsonb,
           onboarding_completed = TRUE,
           role_selected = TRUE,
           role = $4
       WHERE id = $1`,
      [userId, personaId, JSON.stringify(nextProfile), authRole],
    );

    const membershipRoles = rolesToGrantAfterPersonaChange({
      previousRole,
      authRole,
      personaId,
      previousPersona,
    });
    for (const role of membershipRoles) {
      await grantUserRole(userId, role, client);
    }
    if (personaId !== PERSONAS.PARTNER) {
      await provisionForAuthRole(client, {
        userId,
        authRole,
        fullName: me.full_name,
        persona: personaId,
        profile: sanitized,
        req,
        grantTrial,
      });
    }
  });

  return { persona: personaId, authRole };
}

/**
 * Legacy helper: mark onboarding done without a persona.
 * Public signup must NOT call this — skipping left role='student' and made
 * accounts look like students without an explicit purpose choice.
 * Kept for tests / one-off admin scripts only.
 */
async function skipOnboarding(userId) {
  await db.query(
    `UPDATE users
     SET onboarding_completed = TRUE,
         role_selected = TRUE,
         persona = NULL
     WHERE id = $1`,
    [userId],
  );
  return { persona: null, authRole: null, skipped: true };
}

function resolvePersonaInput(body) {
  const direct = String(body?.persona || '').trim();
  if (isPersonaId(direct)) return direct;
  const legacy = personaFromLegacyRole(body?.role);
  return legacy || '';
}

module.exports = {
  fetchPersonaState,
  userNeedsOnboarding,
  attachPersonaFields,
  applyPersonaSelection,
  skipOnboarding,
  resolvePersonaInput,
  isAdminRole,
  rowNeedsOnboarding,
};
