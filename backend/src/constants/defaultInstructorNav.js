const INSTRUCTOR_NAV_SLUG = 'instructor_nav';

/** Sidebar link registry — route/icon sabit qalır, admin yalnız bölmə başlıqlarını və qrup strukturunu dəyişir. */
const INSTRUCTOR_NAV_ITEM_DEFS = {
  dashboard: { to: '/instructor', label: 'Dashboard', icon: 'dashboard', end: true },
  teaching_groups: { to: '/instructor/teaching-groups', label: 'Kurslar və qruplar', icon: 'courses' },
  students: { to: '/instructor/students', label: 'Tələbələrim', icon: 'students' },
  join_requests: {
    to: '/instructor/join-requests',
    label: 'Sorğular',
    icon: 'notifications',
    badgeKey: 'join_requests',
  },
  inquiries: { to: '/instructor/inquiries', label: 'Xəritə müraciətləri', icon: 'instructors' },
  schedule: { to: '/instructor/schedule', label: 'Cədvəlim', icon: 'schedule' },
  attendance: { to: '/instructor/attendance', label: 'Davamiyyət', icon: 'attendance' },
  exams: { to: '/instructor/exams', label: 'İmtahanlar', icon: 'exams' },
  tasks: { to: '/instructor/tasks', label: 'Tapşırıqlar', icon: 'tasks' },
  materials_library: { to: '/instructor/materials', label: 'Kitabxana', icon: 'materials' },
  analytics: { to: '/instructor/analytics', label: 'Analitika', icon: 'analytics' },
  payments: { to: '/instructor/payments', label: 'Ödənişlər', icon: 'payments' },
  notifications: { to: '/instructor/notifications', label: 'Bildirişlər', icon: 'notifications' },
  settings: { to: '/instructor/settings', label: 'Tənzimləmələr', icon: 'settings' },
};

const ALL_ITEM_KEYS = Object.keys(INSTRUCTOR_NAV_ITEM_DEFS);

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function defaultInstructorNavPayload() {
  return {
    version: 1,
    sections: [
      {
        id: 'management',
        title: 'MANAGEMENT',
        enabled: true,
        itemKeys: [
          'dashboard',
          'teaching_groups',
          'students',
          'join_requests',
          'inquiries',
          'schedule',
          'attendance',
          'exams',
          'tasks',
        ],
      },
      {
        id: 'materials',
        title: 'MATERİALLAR',
        enabled: true,
        itemKeys: ['materials_library'],
      },
      {
        id: 'analytics',
        title: 'ANALYTICS',
        enabled: true,
        itemKeys: ['analytics', 'payments'],
      },
      {
        id: 'system',
        title: 'SYSTEM',
        enabled: true,
        itemKeys: ['notifications', 'settings'],
      },
    ],
  };
}

function slugifySectionId(raw, fallback = 'section') {
  const base = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || fallback;
}

function normalizeSection(section, index) {
  const def = defaultInstructorNavPayload();
  const fallback = def.sections[index] || def.sections[0];
  const id = slugifySectionId(section?.id || fallback?.id, `section_${index + 1}`);
  const title = String(section?.title ?? fallback?.title ?? 'Bölmə').trim() || 'Bölmə';
  const enabled = section?.enabled !== false;
  const itemKeys = Array.isArray(section?.itemKeys)
    ? section.itemKeys.map((k) => String(k || '').trim()).filter((k) => INSTRUCTOR_NAV_ITEM_DEFS[k])
    : [...(fallback?.itemKeys || [])];
  return { id, title, enabled, itemKeys };
}

function normalizePutPayload(raw) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const sectionsIn = Array.isArray(incoming.sections) ? incoming.sections : [];
  const defaults = defaultInstructorNavPayload();
  const source = sectionsIn.length ? sectionsIn : defaults.sections;

  const sections = [];
  const usedKeys = new Set();

  for (let i = 0; i < source.length; i += 1) {
    const sec = normalizeSection(source[i], i);
    const uniqueKeys = [];
    for (const key of sec.itemKeys) {
      if (usedKeys.has(key) || key === 'materials_upload') continue;
      usedKeys.add(key);
      uniqueKeys.push(key);
    }
    sections.push({ ...sec, itemKeys: uniqueKeys });
  }

  for (const key of ALL_ITEM_KEYS) {
    if (usedKeys.has(key)) continue;
    const target = sections.find((s) => s.id === 'management') || sections[0];
    if (!target) break;
    target.itemKeys.push(key);
    usedKeys.add(key);
  }

  return {
    version: 1,
    sections: sections.filter((s) => s.itemKeys.length > 0 || s.enabled !== false),
  };
}

function mergeInstructorNavFromDb(dbPayload) {
  const normalized = normalizePutPayload(dbPayload || {});
  const defaults = defaultInstructorNavPayload();

  const byId = new Map(defaults.sections.map((s) => [s.id, { ...s }]));
  for (const sec of normalized.sections) {
    byId.set(sec.id, sec);
  }

  const ordered = [];
  const seen = new Set();
  for (const sec of normalized.sections) {
    if (seen.has(sec.id)) continue;
    seen.add(sec.id);
    ordered.push(sec);
  }
  for (const sec of defaults.sections) {
    if (seen.has(sec.id)) continue;
    seen.add(sec.id);
    ordered.push(byId.get(sec.id));
  }

  return {
    version: 1,
    sections: ordered.filter(Boolean),
  };
}

function serializeNavForClient(payload) {
  const merged = mergeInstructorNavFromDb(payload);
  const sections = merged.sections
    .filter((s) => s.enabled !== false)
    .map((section) => ({
      id: section.id,
      title: section.title,
      items: section.itemKeys
        .map((key) => {
          const def = INSTRUCTOR_NAV_ITEM_DEFS[key];
          if (!def) return null;
          return { key, ...def };
        })
        .filter(Boolean),
    }))
    .filter((s) => s.items.length > 0);

  return { version: merged.version, sections };
}

module.exports = {
  INSTRUCTOR_NAV_SLUG,
  INSTRUCTOR_NAV_ITEM_DEFS,
  ALL_ITEM_KEYS,
  deepClone,
  defaultInstructorNavPayload,
  normalizePutPayload,
  mergeInstructorNavFromDb,
  serializeNavForClient,
};
