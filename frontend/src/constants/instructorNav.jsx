import NavIcon from '../components/common/NavIcon'

/** Kod tərəfində sabit sidebar linkləri — admin yalnız bölmə başlıqlarını və qrup strukturunu dəyişir. */
export const INSTRUCTOR_NAV_ITEM_DEFS = {
  dashboard: { to: '/instructor', labelKey: 'nav.instructor.dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
  teaching_groups: { to: '/instructor/teaching-groups', labelKey: 'nav.instructor.teaching_groups', label: 'Sahələr və qruplar', icon: 'courses' },
  live_history: { to: '/instructor/live-lessons', labelKey: 'nav.instructor.live_history', label: 'Canlı dərslər', icon: 'live' },
  students: { to: '/instructor/students', labelKey: 'nav.instructor.students', label: 'Tələbələrim', icon: 'students' },
  join_requests: {
    to: '/instructor/join-requests',
    labelKey: 'nav.instructor.join_requests',
    label: 'Sorğular',
    icon: 'notifications',
    badgeKey: 'join_requests',
  },
  inquiries: { to: '/instructor/inquiries', labelKey: 'nav.instructor.inquiries', label: 'Axtarış müraciətləri', icon: 'instructors' },
  schedule: { to: '/instructor/schedule', labelKey: 'nav.instructor.schedule', label: 'Cədvəlim', icon: 'schedule' },
  attendance: { to: '/instructor/attendance', labelKey: 'nav.instructor.attendance', label: 'Davamiyyət', icon: 'attendance' },
  exams: { to: '/instructor/exams', labelKey: 'nav.instructor.exams', label: 'İmtahanlar', icon: 'exams' },
  certificates: { to: '/instructor/certificates', labelKey: 'nav.instructor.certificates', label: 'Sertifikatlar', icon: 'exams' },
  tasks: { to: '/instructor/tasks', labelKey: 'nav.instructor.tasks', label: 'Tapşırıqlar', icon: 'tasks' },
  ai_generator: { to: '/instructor/ai-generator', labelKey: 'nav.instructor.ai_generator', label: 'AI Sual Generatoru', icon: 'ai' },
  presentations: { to: '/instructor/presentations', labelKey: 'nav.instructor.presentations', label: 'Təqdimatlar', icon: 'presentations' },
  materials_library: { to: '/instructor/materials', labelKey: 'nav.instructor.materials_library', label: 'Kitabxana', icon: 'materials' },
  analytics: { to: '/instructor/analytics', labelKey: 'nav.instructor.analytics', label: 'Analitika', icon: 'analytics' },
  engagement: { to: '/instructor/engagement', labelKey: 'nav.instructor.engagement', label: 'Aktivlik', icon: 'progress' },
  payments: { to: '/instructor/payments', labelKey: 'nav.instructor.payments', label: 'Ödənişlər', icon: 'payments' },
  notifications: { to: '/notifications', labelKey: 'nav.instructor.notifications', label: 'Bildirişlər', icon: 'notifications' },
  settings: { to: '/instructor/settings', labelKey: 'nav.instructor.settings', label: 'Tənzimləmələr', icon: 'settings' },
}

/** Server menyu konfiqurasiyasında hələ olmasa da göstərilən yeni bəndlər. */
const ALWAYS_AVAILABLE_KEYS = ['engagement']

/** Instructor workspace is organized around the next user action, not implementation modules. */
const INSTRUCTOR_PRODUCT_GROUPS = [
  { id: 'today', title: 'BU GÜN', itemKeys: ['dashboard', 'schedule', 'join_requests', 'live_history'] },
  {
    id: 'teaching',
    title: 'TƏDRİS',
    itemKeys: ['teaching_groups', 'students', 'tasks', 'exams', 'ai_generator', 'presentations', 'materials_library'],
  },
  { id: 'contact', title: 'ƏLAQƏ', itemKeys: ['inquiries', 'notifications'] },
  { id: 'results', title: 'NƏTİCƏLƏR', itemKeys: ['engagement', 'attendance', 'certificates', 'analytics'] },
  { id: 'business', title: 'BİZNES', itemKeys: ['payments', 'settings'] },
]

/** Sidebar linkləri yalnız bu bölmədə görünsün. */
const ITEM_CANONICAL_SECTION = {
  presentations: 'materials',
  materials_library: 'materials',
}

function dedupeNavSections(sections) {
  const list = (sections || []).map((section) => ({
    ...section,
    items: [...(section.items || [])],
    itemKeys: section.itemKeys ? [...section.itemKeys] : undefined,
  }))

  for (const [key, sectionId] of Object.entries(ITEM_CANONICAL_SECTION)) {
    const hadKey = list.some(
      (s) => (s.itemKeys || []).includes(key) || (s.items || []).some((item) => item?.key === key),
    )
    if (!hadKey) continue

    for (const sec of list) {
      if (sec.itemKeys) sec.itemKeys = sec.itemKeys.filter((k) => k !== key)
      if (sec.items) sec.items = sec.items.filter((item) => item?.key !== key)
    }

    const target = list.find((s) => s.id === sectionId)
    if (!target) continue

    if (target.itemKeys && !target.itemKeys.includes(key)) {
      insertMaterialsSectionKey(target.itemKeys, key)
    }
    if (!(target.items || []).some((item) => item?.key === key)) {
      const built = itemFromKey(key)
      if (built) {
        if (!target.items) target.items = []
        insertMaterialsSectionItem(target.items, built)
      }
    }
  }

  return list
}

function insertMaterialsSectionKey(keys, key) {
  if (keys.includes(key)) return
  if (key === 'presentations') {
    keys.unshift(key)
    return
  }
  const presentationsIdx = keys.indexOf('presentations')
  if (key === 'materials_library' && presentationsIdx >= 0) {
    keys.splice(presentationsIdx + 1, 0, key)
    return
  }
  keys.push(key)
}

function insertMaterialsSectionItem(items, built) {
  if (items.some((item) => item?.key === built.key)) return
  if (built.key === 'presentations') {
    items.unshift(built)
    return
  }
  const presentationsIdx = items.findIndex((item) => item?.key === 'presentations')
  if (built.key === 'materials_library' && presentationsIdx >= 0) {
    items.splice(presentationsIdx + 1, 0, built)
    return
  }
  items.push(built)
}

/**
 * Guarantees the AI generator link is present even when a server/admin nav
 * config predates this feature and omits the `ai_generator` key.
 */
function ensureAiGeneratorItem(sections) {
  const AI_KEY = 'ai_generator'
  const AI_TO = '/instructor/ai-generator'
  const exists = (sections || []).some((s) =>
    (s.items || []).some((item) => item?.key === AI_KEY || item?.to === AI_TO),
  )
  if (exists) return sections

  const built = itemFromKey(AI_KEY)
  if (!built) return sections

  const list = (sections || []).map((s) => ({ ...s, items: [...(s.items || [])] }))
  const target = list.find((s) => s.id === 'management') || list[0]
  if (!target) return sections

  const tasksIdx = target.items.findIndex((item) => item?.key === 'tasks')
  if (tasksIdx >= 0) target.items.splice(tasksIdx + 1, 0, built)
  else target.items.push(built)
  return list
}

function ensurePresentationsItem(sections) {
  const KEY = 'presentations'
  const TO = '/instructor/presentations'
  const exists = (sections || []).some((s) =>
    (s.items || []).some((item) => item?.key === KEY || item?.to === TO),
  )
  if (exists) return sections

  const built = itemFromKey(KEY)
  if (!built) return sections

  const list = (sections || []).map((s) => ({ ...s, items: [...(s.items || [])] }))
  let target = list.find((s) => s.id === 'materials')
  if (!target) {
    target = { id: 'materials', title: 'MATERİALLAR', items: [] }
    const mgmtIdx = list.findIndex((s) => s.id === 'management')
    if (mgmtIdx >= 0) list.splice(mgmtIdx + 1, 0, target)
    else list.push(target)
  }
  target.items.unshift(built)
  return list
}

function itemFromKey(key) {
  const def = INSTRUCTOR_NAV_ITEM_DEFS[key]
  if (!def) return null
  return {
    key,
    to: def.to,
    label: def.label,
    labelKey: def.labelKey,
    end: def.end,
    badgeKey: def.badgeKey,
    icon: <NavIcon name={def.icon} />,
  }
}

export function defaultInstructorNavSections() {
  return INSTRUCTOR_PRODUCT_GROUPS.map((group) => ({ ...group, enabled: true }))
}

function reframeInstructorSections(sourceSections) {
  const available = new Set(
    (sourceSections || []).flatMap((section) => [
      ...(section.itemKeys || []),
      ...(section.items || []).map((item) => item?.key).filter(Boolean),
    ]),
  )
  const source = available.size ? available : new Set(Object.keys(INSTRUCTOR_NAV_ITEM_DEFS))
  for (const key of ALWAYS_AVAILABLE_KEYS) source.add(key)
  return INSTRUCTOR_PRODUCT_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    items: group.itemKeys.filter((key) => source.has(key)).map(itemFromKey).filter(Boolean),
  })).filter((section) => section.items.length > 0)
}

/** API `nav.sections` və ya admin payload `sections` → InstructorLayout NAV_SECTIONS */
export function buildInstructorNavSections(navPayload) {
  const sections = Array.isArray(navPayload?.sections) ? navPayload.sections : defaultInstructorNavSections()
  return reframeInstructorSections(sections)
}

export function buildInstructorNavSectionsFromClient(nav) {
  return reframeInstructorSections(nav?.sections?.length ? nav.sections : defaultInstructorNavSections())
}
