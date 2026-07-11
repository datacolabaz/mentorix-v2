import NavIcon from '../components/common/NavIcon'

/** Kod tərəfində sabit sidebar linkləri — admin yalnız bölmə başlıqlarını və qrup strukturunu dəyişir. */
export const INSTRUCTOR_NAV_ITEM_DEFS = {
  dashboard: { to: '/instructor', labelKey: 'nav.instructor.dashboard', label: 'Dashboard', icon: 'dashboard', end: true },
  teaching_groups: { to: '/instructor/teaching-groups', labelKey: 'nav.instructor.teaching_groups', label: 'Sahələr və qruplar', icon: 'courses' },
  live_history: { to: '/instructor/live/history', labelKey: 'nav.instructor.live_history', label: 'Canlı dərslər', icon: 'live' },
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
  materials_library: { to: '/instructor/materials', labelKey: 'nav.instructor.materials_library', label: 'Kitabxana', icon: 'materials' },
  analytics: { to: '/instructor/analytics', labelKey: 'nav.instructor.analytics', label: 'Analitika', icon: 'analytics' },
  payments: { to: '/instructor/payments', labelKey: 'nav.instructor.payments', label: 'Ödənişlər', icon: 'payments' },
  notifications: { to: '/instructor/notifications', labelKey: 'nav.instructor.notifications', label: 'Bildirişlər', icon: 'notifications' },
  settings: { to: '/instructor/settings', labelKey: 'nav.instructor.settings', label: 'Tənzimləmələr', icon: 'settings' },
}

/** Sidebar linkləri yalnız bu bölmədə görünsün. */
const ITEM_CANONICAL_SECTION = {
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

    if (target.itemKeys && !target.itemKeys.includes(key)) target.itemKeys.push(key)
    if (!(target.items || []).some((item) => item?.key === key)) {
      const built = itemFromKey(key)
      if (built) {
        if (!target.items) target.items = []
        target.items.push(built)
      }
    }
  }

  return list
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
  return [
    {
      id: 'management',
      title: 'MANAGEMENT',
      enabled: true,
      itemKeys: [
        'dashboard',
        'teaching_groups',
        'live_history',
        'students',
        'join_requests',
        'inquiries',
        'schedule',
        'attendance',
        'exams',
        'certificates',
        'tasks',
        'ai_generator',
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
  ]
}

/** API `nav.sections` və ya admin payload `sections` → InstructorLayout NAV_SECTIONS */
export function buildInstructorNavSections(navPayload) {
  const sections = Array.isArray(navPayload?.sections) ? navPayload.sections : defaultInstructorNavSections()

  return ensureAiGeneratorItem(
    dedupeNavSections(
      sections
        .filter((s) => s && s.enabled !== false)
        .map((section) => {
          const keys = Array.isArray(section.itemKeys) ? section.itemKeys : []
          const items = keys
            .filter((key) => key !== 'materials_upload')
            .map(itemFromKey)
            .filter(Boolean)
          return {
            id: section.id,
            title: String(section.title || '').trim() || 'Bölmə',
            items,
          }
        })
        .filter((s) => s.items.length > 0),
    ).filter((s) => s.items.length > 0),
  )
}

export function buildInstructorNavSectionsFromClient(nav) {
  if (!nav?.sections?.length) return buildInstructorNavSections({ sections: defaultInstructorNavSections() })

  return ensureAiGeneratorItem(
    dedupeNavSections(
    nav.sections
      .map((section) => ({
        id: section.id,
        title: String(section.title || '').trim() || 'Bölmə',
        items: (section.items || [])
          .filter((item) => item?.key !== 'materials_upload')
          .map((item) => {
            const def = INSTRUCTOR_NAV_ITEM_DEFS[item.key] || item
            if (!def?.to) return null
            return {
              key: item.key,
              to: def.to || item.to,
              label: def.label || item.label,
              labelKey: def.labelKey || item.labelKey,
              end: def.end ?? item.end,
              badgeKey: def.badgeKey ?? item.badgeKey,
              icon: <NavIcon name={def.icon || item.icon} />,
            }
          })
          .filter(Boolean),
      }))
      .filter((s) => s.items.length > 0),
    ).filter((s) => s.items.length > 0),
  )
}
