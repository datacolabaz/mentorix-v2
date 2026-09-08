export const ORG_NAV_SECTIONS = [
  {
    id: 'management',
    titleKey: 'nav.sections.management',
    title: 'İDARƏETMƏ',
    items: [
      { to: '/org', key: 'dashboard', labelKey: 'nav.org.dashboard', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view', end: true },
      { to: '/org/participants', key: 'participants', labelKey: 'nav.org.participants', label: 'İştirakçılar', icon: 'students', permission: 'users.view' },
      { to: '/org/teams', key: 'teams', labelKey: 'nav.org.teams', label: 'Komandalar', icon: 'briefcase', permission: 'teams.view' },
      { to: '/org/groups', key: 'groups', labelKey: 'nav.org.groups', label: 'Qruplar', icon: 'groups', permission: 'groups.view' },
      { to: '/org/trainers', key: 'trainers', labelKey: 'nav.org.trainers', label: 'Müəllimlər / Təlimçilər', icon: 'instructors', permission: 'trainers.view' },
      { to: '/org/exams', key: 'exams', labelKey: 'nav.org.exams', label: 'İmtahanlar', icon: 'exams', permission: 'assessments.view' },
      { to: '/org/assessments', key: 'assessments', labelKey: 'nav.org.assessments', label: 'Qiymətləndirmələr', icon: 'progress', permission: 'assessments.view' },
    ],
  },
  {
    id: 'content',
    titleKey: 'nav.sections.content',
    title: 'MƏZMUN',
    items: [
      { to: '/org/question-bank', key: 'questionBank', labelKey: 'nav.org.questionBank', label: 'Sual bankı', icon: 'tasks', permission: 'content.view' },
      { to: '/org/tests', key: 'tests', labelKey: 'nav.org.tests', label: 'Testlər', icon: 'courses', permission: 'content.view' },
      { to: '/org/templates', key: 'templates', labelKey: 'nav.org.templates', label: 'İmtahan şablonları', icon: 'presentations', permission: 'content.view' },
      { to: '/org/materials', key: 'materials', labelKey: 'nav.org.materials', label: 'Materiallar', icon: 'materials', permission: 'content.view' },
      { to: '/org/library', key: 'library', labelKey: 'nav.org.library', label: 'Kitabxana', icon: 'materials_upload', permission: 'content.view' },
    ],
  },
  {
    id: 'analytics',
    titleKey: 'nav.sections.analytics',
    title: 'ANALİTİKA',
    items: [
      { to: '/org/analytics', key: 'analytics', labelKey: 'nav.org.analytics', label: 'Ümumi analitika', icon: 'analytics', permission: 'reports.view', end: true },
      { to: '/org/analytics/exams', key: 'examResults', labelKey: 'nav.org.examResults', label: 'İmtahan nəticələri', icon: 'exams', permission: 'reports.view' },
      { to: '/org/analytics/participants', key: 'participantPerformance', labelKey: 'nav.org.participantPerformance', label: 'İştirakçı performansı', icon: 'students', permission: 'reports.view' },
      { to: '/org/analytics/teams', key: 'teamResults', labelKey: 'nav.org.teamResults', label: 'Komanda nəticələri', icon: 'briefcase', permission: 'reports.view' },
      { to: '/org/reports', key: 'reports', labelKey: 'nav.org.reports', label: 'Hesabatlar', icon: 'payments', permission: 'reports.view' },
    ],
  },
  {
    id: 'organization',
    titleKey: 'nav.sections.organization',
    title: 'TƏŞKİLAT',
    items: [
      { to: '/org/members', key: 'members', labelKey: 'nav.org.members', label: 'Üzvlər', icon: 'instructors', permission: 'organization.manage' },
      { to: '/org/roles', key: 'roles', labelKey: 'nav.org.roles', label: 'Rollar və icazələr', icon: 'settings', permission: 'roles.manage' },
      { to: '/org/profile', key: 'profile', labelKey: 'nav.org.profile', label: 'Təşkilat profili', icon: 'building', permission: 'organization.manage' },
      { to: '/org/branding', key: 'branding', labelKey: 'nav.org.branding', label: 'Brendinq', icon: 'presentations', permission: 'organization.manage' },
      { to: '/org/integrations', key: 'integrations', labelKey: 'nav.org.integrations', label: 'İnteqrasiyalar', icon: 'live', permission: 'organization.manage' },
    ],
  },
  {
    id: 'system',
    titleKey: 'nav.sections.system',
    title: 'SİSTEM',
    items: [
      { to: '/org/notifications', key: 'notifications', labelKey: 'nav.org.notifications', label: 'Bildirişlər', icon: 'notifications', permission: 'notifications.manage' },
      { to: '/org/audit', key: 'audit', labelKey: 'nav.org.audit', label: 'Audit jurnalı', icon: 'attendance', permission: 'audit.view' },
      { to: '/org/settings', key: 'settings', labelKey: 'nav.org.settings', label: 'Tənzimləmələr', icon: 'settings', permission: 'organization.manage' },
    ],
  },
]

export function filterOrgNav(permissions) {
  const set = new Set(Array.isArray(permissions) ? permissions : [])
  return ORG_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || set.has(item.permission)),
  })).filter((section) => section.items.length > 0)
}
