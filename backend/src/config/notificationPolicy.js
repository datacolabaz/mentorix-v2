/**
 * Bildiriş siyasəti (pure, DB-siz): kateqoriyalar, prioritetlər, rol üzrə default matris,
 * məcburi (söndürülə bilməyən) hadisələr, heç vaxt email göndərilməyən hadisələr,
 * köhnə `notifications.type` → kateqoriya xəritəsi və seçimlərin həlli.
 */

const CATEGORIES = Object.freeze([
  'security',
  'assessment',
  'assignment',
  'material',
  'group',
  'grading',
  'partner',
  'billing',
  'system',
]);
const PRIORITIES = Object.freeze(['CRITICAL', 'HIGH', 'NORMAL', 'LOW']);
const CHANNELS = Object.freeze(['in_app', 'email']);
const FREQUENCIES = Object.freeze(['immediate', 'daily', 'weekly', 'off']);
const CHANNEL_FREQUENCIES = Object.freeze({
  in_app: Object.freeze(['immediate', 'off']),
  email: FREQUENCIES,
});

/** Bütöv kateqoriya kilidli: in-app və email həmişə açıq, dərhal. */
const LOCKED_CATEGORIES = new Set(['security']);

/** Kateqoriyadan asılı olmayaraq seçimlə söndürülə bilməyən hadisələr. */
const MANDATORY_EVENT_TYPES = new Set([
  'security_alert',
  'login_security_alert',
  'google_account_changed',
  'account_suspended',
  'privacy_request_status',
]);

/** Heç vaxt email yoxdur (seçimlə də açıla bilməz). */
const NEVER_EMAIL_EVENT_TYPES = new Set([
  'heartbeat',
  'page_view',
  'exam_autosaved',
  'exam_question_answered',
  'material_opened',
]);

/** Default email yoxdur; yalnız hadisə səviyyəsində açıq email override-ı olduqda. */
const OPT_IN_EMAIL_EVENT_TYPES = new Set([
  'material_viewed',
  'material_downloaded',
  'video_started',
  'video_progressed',
]);

const ROLE_GROUPS = Object.freeze({
  admin: 'admin',
  instructor: 'provider',
  course: 'provider',
  student: 'learner',
  parent: 'learner',
});

function roleGroup(role) {
  return ROLE_GROUPS[String(role || '').toLowerCase()] || 'learner';
}

const ON = 'immediate';
const OFF = 'off';

/** Spec "Recommended defaults". Açar = rol qrupu → kateqoriya → { in_app, email }. */
const ROLE_DEFAULTS = Object.freeze({
  provider: {
    security: { in_app: ON, email: ON },
    assessment: { in_app: ON, email: ON },
    assignment: { in_app: ON, email: ON },
    material: { in_app: ON, email: OFF },
    group: { in_app: ON, email: ON },
    grading: { in_app: ON, email: ON },
    partner: { in_app: ON, email: ON },
    billing: { in_app: ON, email: ON },
    system: { in_app: ON, email: OFF },
  },
  learner: {
    security: { in_app: ON, email: ON },
    assessment: { in_app: ON, email: ON },
    assignment: { in_app: ON, email: ON },
    material: { in_app: ON, email: ON },
    group: { in_app: ON, email: ON },
    grading: { in_app: ON, email: ON },
    partner: { in_app: ON, email: ON },
    billing: { in_app: ON, email: ON },
    system: { in_app: ON, email: OFF },
  },
  admin: {
    security: { in_app: ON, email: ON },
    assessment: { in_app: ON, email: OFF },
    assignment: { in_app: ON, email: OFF },
    material: { in_app: ON, email: OFF },
    group: { in_app: ON, email: OFF },
    grading: { in_app: ON, email: OFF },
    partner: { in_app: ON, email: ON },
    billing: { in_app: ON, email: ON },
    system: { in_app: ON, email: ON },
  },
});

const VISIBLE_CATEGORIES = Object.freeze({
  provider: ['security', 'assessment', 'assignment', 'material', 'group', 'grading', 'billing', 'system'],
  learner: ['security', 'assessment', 'assignment', 'material', 'group', 'grading', 'billing', 'system'],
  admin: ['security', 'partner', 'billing', 'system'],
});

/** Kateqoriya üzrə default prioritet (hadisə açıq prioritet verməyəndə). */
const CATEGORY_DEFAULT_PRIORITY = Object.freeze({
  security: 'CRITICAL',
  assessment: 'NORMAL',
  assignment: 'NORMAL',
  material: 'LOW',
  group: 'NORMAL',
  grading: 'NORMAL',
  partner: 'NORMAL',
  billing: 'HIGH',
  system: 'NORMAL',
});

/** Köhnə sətirlər (category IS NULL): type → { category, priority }. */
const LEGACY_EXACT_TYPES = Object.freeze({
  exam: { category: 'assessment', priority: 'NORMAL' },
  exam_access_request: { category: 'assessment', priority: 'HIGH' },
  exam_access_approved: { category: 'assessment', priority: 'NORMAL' },
  exam_access_rejected: { category: 'assessment', priority: 'NORMAL' },
  catalog_exam_approved: { category: 'assessment', priority: 'NORMAL' },
  catalog_exam_rejected: { category: 'assessment', priority: 'NORMAL' },
  task_access_request: { category: 'assignment', priority: 'HIGH' },
  assignment_new: { category: 'assignment', priority: 'NORMAL' },
  assignment_reminder: { category: 'assignment', priority: 'NORMAL' },
  assignment_overdue: { category: 'assignment', priority: 'HIGH' },
  assignment_submitted: { category: 'assignment', priority: 'NORMAL' },
  assignment_reviewed: { category: 'grading', priority: 'NORMAL' },
  open_grading_pending: { category: 'grading', priority: 'HIGH' },
  material_reminder: { category: 'material', priority: 'NORMAL' },
  join_request: { category: 'group', priority: 'HIGH' },
  instructor_panel: { category: 'group', priority: 'NORMAL' },
  partner_payout_paid: { category: 'partner', priority: 'NORMAL' },
  student_limit_block: { category: 'billing', priority: 'HIGH' },
  payment: { category: 'billing', priority: 'NORMAL' },
  payment_confirmed: { category: 'billing', priority: 'NORMAL' },
  profile_completion: { category: 'system', priority: 'LOW' },
  instructor_complete_profile: { category: 'system', priority: 'LOW' },
  marketplace_opportunity: { category: 'system', priority: 'LOW' },
});

const LEGACY_PREFIXES = Object.freeze([
  { prefix: 'billing_', category: 'billing', priority: 'NORMAL' },
  { prefix: 'assignment_', category: 'assignment', priority: 'NORMAL' },
  { prefix: 'exam_', category: 'assessment', priority: 'NORMAL' },
  { prefix: 'partner_', category: 'partner', priority: 'NORMAL' },
]);

const FALLBACK_CATEGORY = 'system';

function isCategory(v) {
  return CATEGORIES.includes(v);
}

function isPriority(v) {
  return PRIORITIES.includes(v);
}

function legacyClassification(type) {
  const t = String(type || '').trim().toLowerCase();
  if (LEGACY_EXACT_TYPES[t]) return { ...LEGACY_EXACT_TYPES[t] };
  const hit = LEGACY_PREFIXES.find((p) => t.startsWith(p.prefix));
  if (hit) return { category: hit.category, priority: hit.priority };
  return { category: FALLBACK_CATEGORY, priority: 'NORMAL' };
}

/** DB sətri üçün effektiv kateqoriya/prioritet (yeni sütunlar doludursa onlar, yoxsa köhnə xəritə). */
function classifyNotification(row) {
  const legacy = legacyClassification(row?.type);
  const category = isCategory(row?.category) ? row.category : legacy.category;
  const storedPriority = isPriority(row?.priority) ? row.priority : null;
  // Köhnə sətirlərdə priority sütunu DEFAULT 'NORMAL' ilə dolur — kateqoriyasızdırsa xəritəyə üstünlük ver.
  const priority = row?.category ? storedPriority || legacy.priority : legacy.priority;
  return { category, priority };
}

/**
 * Kateqoriya filtri üçün köhnə tiplərin siyahısı.
 * `exact` — bu kateqoriyaya düşən dəqiq tiplər; `prefixes` — LIKE nümunələri;
 * `allExact` prefix uyğunluğundan çıxarılmalıdır (məs. assignment_reviewed → grading).
 */
function legacyTypeFilter(category) {
  const allExact = Object.keys(LEGACY_EXACT_TYPES);
  const exact = allExact.filter((t) => LEGACY_EXACT_TYPES[t].category === category);
  const prefixes = LEGACY_PREFIXES.filter((p) => p.category === category).map((p) => `${p.prefix}%`);
  return {
    exact,
    prefixes,
    allExact,
    allPrefixes: LEGACY_PREFIXES.map((p) => `${p.prefix}%`),
    includeUnmapped: category === FALLBACK_CATEGORY,
  };
}

function isMandatory({ category, eventType }) {
  return LOCKED_CATEGORIES.has(category) || MANDATORY_EVENT_TYPES.has(String(eventType || ''));
}

function defaultSetting(role, category, channel) {
  const group = roleGroup(role);
  const row = ROLE_DEFAULTS[group]?.[category] || ROLE_DEFAULTS.learner[category];
  const frequency = row?.[channel] || OFF;
  return { enabled: frequency !== OFF, frequency };
}

function normalizePrefRow(p) {
  const freq = FREQUENCIES.includes(p?.frequency) ? p.frequency : 'immediate';
  const enabled = p?.enabled !== false && freq !== OFF;
  return { enabled, frequency: enabled ? freq : OFF };
}

/** Hadisə override → kateqoriya override → rol default. */
function effectiveSetting({ role, category, eventType, channel, prefs = [] }) {
  const mine = (prefs || []).filter((p) => p && p.category === category && p.channel === channel);
  const eventRow = eventType ? mine.find((p) => p.event_type && p.event_type === eventType) : null;
  if (eventRow) return { ...normalizePrefRow(eventRow), source: 'event' };
  const catRow = mine.find((p) => !p.event_type);
  if (catRow) return { ...normalizePrefRow(catRow), source: 'category' };
  return { ...defaultSetting(role, category, channel), source: 'default' };
}

/**
 * Bildiriş yaradılmazdan (və email növbəyə düşməzdən) ƏVVƏL çağırılır.
 * @returns {{ mandatory: boolean, inApp: boolean, email: { eligible: boolean, frequency: string|null, reason: string } }}
 */
function resolveDelivery({ role, category, eventType, prefs = [], wantsEmail = false }) {
  const ev = String(eventType || '');
  const mandatory = isMandatory({ category, eventType: ev });
  const neverEmail = NEVER_EMAIL_EVENT_TYPES.has(ev);

  if (mandatory) {
    const eligible = Boolean(wantsEmail) && !neverEmail;
    return {
      mandatory: true,
      inApp: true,
      email: eligible
        ? { eligible: true, frequency: 'immediate', reason: 'mandatory' }
        : { eligible: false, frequency: null, reason: neverEmail ? 'never_email' : 'not_requested' },
    };
  }

  const inApp = effectiveSetting({ role, category, eventType: ev, channel: 'in_app', prefs }).enabled;

  let email;
  if (!wantsEmail) {
    email = { eligible: false, frequency: null, reason: 'not_requested' };
  } else if (neverEmail) {
    email = { eligible: false, frequency: null, reason: 'never_email' };
  } else {
    const s = effectiveSetting({ role, category, eventType: ev, channel: 'email', prefs });
    if (OPT_IN_EMAIL_EVENT_TYPES.has(ev) && s.source !== 'event') {
      email = { eligible: false, frequency: null, reason: 'opt_in_required' };
    } else if (!s.enabled) {
      email = { eligible: false, frequency: null, reason: 'preference_off' };
    } else {
      email = { eligible: true, frequency: s.frequency, reason: s.source };
    }
  }

  return { mandatory: false, inApp, email };
}

function visibleCategories(role, { isPartner = false } = {}) {
  const list = [...(VISIBLE_CATEGORIES[roleGroup(role)] || VISIBLE_CATEGORIES.learner)];
  if (isPartner && !list.includes('partner')) {
    const idx = list.indexOf('billing');
    list.splice(idx >= 0 ? idx : list.length, 0, 'partner');
  }
  return list;
}

/** Seçimlər UI-si üçün matris (yalnız kateqoriya səviyyəsi). */
function buildPreferenceMatrix({ role, isPartner = false, prefs = [] }) {
  return visibleCategories(role, { isPartner }).map((category) => {
    const locked = LOCKED_CATEGORIES.has(category);
    const channels = {};
    for (const channel of CHANNELS) {
      const def = defaultSetting(role, category, channel);
      const eff = locked
        ? { enabled: true, frequency: 'immediate', source: 'locked' }
        : effectiveSetting({ role, category, eventType: null, channel, prefs: (prefs || []).filter((p) => !p.event_type) });
      channels[channel] = {
        frequency: eff.frequency,
        enabled: eff.enabled,
        locked,
        default_frequency: locked ? 'immediate' : def.frequency,
        allowed_frequencies: [...CHANNEL_FREQUENCIES[channel]],
      };
    }
    return { category, locked, channels };
  });
}

/**
 * PUT /preferences gövdəsinin yoxlanması.
 * @returns {{ ok: true, rows: Array<{category, channel, enabled, frequency}> } | { ok: false, code: string, message: string }}
 */
function validatePreferenceUpdate({ role, isPartner = false, items }) {
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, code: 'INVALID_BODY', message: 'preferences array required' };
  }
  if (items.length > CATEGORIES.length * CHANNELS.length) {
    return { ok: false, code: 'INVALID_BODY', message: 'too many preference rows' };
  }
  const allowed = new Set(visibleCategories(role, { isPartner }));
  const out = new Map();
  for (const raw of items) {
    const category = String(raw?.category || '').trim();
    const channel = String(raw?.channel || '').trim();
    const frequency = String(raw?.frequency || '').trim();
    if (!allowed.has(category)) {
      return { ok: false, code: 'INVALID_CATEGORY', message: `category not allowed: ${category}` };
    }
    if (!CHANNELS.includes(channel)) {
      return { ok: false, code: 'INVALID_CHANNEL', message: `invalid channel: ${channel}` };
    }
    if (!CHANNEL_FREQUENCIES[channel].includes(frequency)) {
      return { ok: false, code: 'INVALID_FREQUENCY', message: `invalid frequency for ${channel}: ${frequency}` };
    }
    if (LOCKED_CATEGORIES.has(category)) {
      if (frequency !== 'immediate') {
        return { ok: false, code: 'LOCKED_CATEGORY', message: `${category} notifications cannot be disabled` };
      }
      continue;
    }
    out.set(`${category}:${channel}`, { category, channel, enabled: frequency !== OFF, frequency });
  }
  return { ok: true, rows: [...out.values()] };
}

function defaultPriority(category) {
  return CATEGORY_DEFAULT_PRIORITY[category] || 'NORMAL';
}

module.exports = {
  CATEGORIES,
  PRIORITIES,
  CHANNELS,
  FREQUENCIES,
  CHANNEL_FREQUENCIES,
  LOCKED_CATEGORIES,
  MANDATORY_EVENT_TYPES,
  NEVER_EMAIL_EVENT_TYPES,
  OPT_IN_EMAIL_EVENT_TYPES,
  ROLE_DEFAULTS,
  isCategory,
  isPriority,
  roleGroup,
  legacyClassification,
  classifyNotification,
  legacyTypeFilter,
  isMandatory,
  defaultSetting,
  effectiveSetting,
  resolveDelivery,
  visibleCategories,
  buildPreferenceMatrix,
  validatePreferenceUpdate,
  defaultPriority,
};
