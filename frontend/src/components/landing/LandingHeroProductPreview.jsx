import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildInstructorNavSections } from '../../constants/instructorNav'
import { localizeInstructorNavSections } from '../../lib/localizeNav'

function Chevron({ open }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const DEFAULT_OPEN = new Set(['management'])

/** Landing nümunəsində göstərilən real müəllim menyusu — Sertifikatlar istisna. */
const PREVIEW_SECTION_ORDER = ['management', 'analytics', 'system', 'materials']
const PREVIEW_ITEM_ORDER = {
  management: [
    'dashboard',
    'teaching_groups',
    'students',
    'join_requests',
    'inquiries',
    'schedule',
    'attendance',
    'exams',
    'tasks',
    'live_history',
    'ai_generator',
  ],
  analytics: ['analytics', 'payments'],
  system: ['notifications', 'settings'],
  materials: ['presentations', 'materials_library'],
}

function buildPreviewNavSections(t) {
  const localized = localizeInstructorNavSections(buildInstructorNavSections(), t)
  const byId = Object.fromEntries(localized.map((section) => [section.id, section]))

  return PREVIEW_SECTION_ORDER.map((id) => {
    const section = byId[id]
    if (!section) return null
    const itemsByKey = Object.fromEntries((section.items || []).map((item) => [item.key, item]))
    const items = (PREVIEW_ITEM_ORDER[id] || []).map((key) => itemsByKey[key]).filter(Boolean)
    return items.length ? { ...section, items } : null
  }).filter(Boolean)
}

function extraNoteFor(activeKey, t) {
  if (activeKey === 'payments') return t('landing.preview.paymentsHint')
  if (activeKey === 'analytics') return t('landing.preview.avgScore')
  if (activeKey === 'join_requests' || activeKey === 'inquiries') return t('landing.preview.joinHint')
  if (activeKey === 'schedule' || activeKey === 'attendance') return t('landing.preview.lessonsThisWeek')
  if (activeKey === 'presentations' || activeKey === 'materials_library') return t('landing.preview.materialsHint')
  return null
}

/** Hero nümunə paneli — real müəllim menyusu, adsız və məbləğsiz. */
export default function LandingHeroProductPreview({ onOpenDemo }) {
  const { t, i18n } = useTranslation()
  const [openSections, setOpenSections] = useState(DEFAULT_OPEN)
  const [activeKey, setActiveKey] = useState('dashboard')

  const sections = useMemo(() => buildPreviewNavSections(t), [t, i18n.language])

  const greetingHour = new Date().getHours()
  const greeting =
    greetingHour < 12
      ? t('dashboard.greetingMorning')
      : greetingHour < 18
        ? t('dashboard.greetingAfternoon')
        : t('dashboard.greetingEvening')

  const toggleSection = (id) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const extraNote = extraNoteFor(activeKey, t)

  const quickLinks = [
    t('personaHome.teacher.createExam'),
    t('personaHome.teacher.tests'),
    t('personaHome.teacher.students'),
    t('personaHome.teacher.groups'),
    t('personaHome.teacher.results'),
  ]

  return (
    <div
      id="mx-hero-preview"
      className="relative w-full min-w-0 h-full"
      aria-label={t('landing.preview.ariaLabel')}
    >
      <div className="h-full max-h-[36rem] sm:max-h-[38rem] rounded-2xl border border-slate-200/80 bg-[#f4f7fa] text-slate-900 shadow-[0_24px_50px_-28px_rgba(255,255,255,0.35)] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-200/80 bg-white shrink-0">
          <span className="flex gap-1 shrink-0" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <span className="h-2 w-2 rounded-full bg-slate-300" />
            <span className="h-2 w-2 rounded-full bg-slate-300" />
          </span>
          <span className="text-[11px] font-semibold text-slate-700 truncate">{t('landing.preview.appTitle')}</span>
          <span className="ml-auto shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
            {t('landing.preview.badge')}
          </span>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[14.5rem_minmax(0,1fr)] min-h-0">
          <nav
            className="sm:border-r sm:border-slate-200/80 bg-white px-2 py-2 overflow-y-auto min-h-0 max-h-[12rem] sm:max-h-none"
            aria-label={t('landing.preview.appTitle')}
          >
            <div className="space-y-3">
              {sections.map((section) => {
                const open = openSections.has(section.id)
                return (
                  <div key={section.id || section.title}>
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={open}
                      className="w-full flex items-center justify-between gap-1 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600"
                    >
                      <span className="truncate">{section.title}</span>
                      <Chevron open={open} />
                    </button>
                    {open ? (
                      <div className="mt-1 space-y-0.5">
                        {(section.items || []).map((item) => {
                          const active = item.key === activeKey
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => setActiveKey(item.key)}
                              title={item.label}
                              className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                                active
                                  ? 'bg-emerald-50 text-emerald-900'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span className="shrink-0 text-current opacity-80 [&>svg]:h-3.5 [&>svg]:w-3.5">
                                {item.icon}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </nav>

          <div className="flex flex-col gap-3 p-3 sm:p-4 overflow-y-auto min-h-0 bg-[#f4f7fa]">
            <p className="text-sm font-semibold text-slate-900 leading-snug px-0.5">{greeting}</p>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 truncate">
                  {t('dashboard.kpiStudents')}
                </p>
                <p className="text-lg font-semibold tabular-nums text-slate-900 leading-tight">
                  {t('landing.preview.kpiStudentsValue')}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{t('dashboard.kpiStudentsSecondary')}</p>
              </div>
              <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 truncate">
                  {t('dashboard.kpiExamAvg')}
                </p>
                <p className="text-lg font-semibold tabular-nums text-slate-900 leading-tight">
                  {t('landing.preview.kpiAvgValue')}
                </p>
                <p className="text-[10px] text-slate-500 truncate">{t('dashboard.kpiExamAvgSecondary')}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('landing.preview.groupLabel')}</p>
              <p className="text-sm font-semibold text-slate-900 leading-snug">{t('landing.preview.groupName')}</p>
              <p className="text-[11px] text-slate-500">{t('landing.preview.studentCount')}</p>
            </div>
            <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('landing.preview.examLabel')}</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{t('landing.preview.examName')}</p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                {t('landing.preview.examStatus')}
              </span>
            </div>
            {extraNote ? (
              <p className="text-[11px] text-slate-500 leading-snug px-0.5">{extraNote}</p>
            ) : null}

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {t('personaHome.title')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickLinks.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onOpenDemo}
                    className="rounded-lg border border-emerald-200/80 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenDemo}
              className="mt-auto inline-flex justify-center items-center rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {t('landing.preview.openPanel')}
            </button>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 text-center px-3 py-2 border-t border-slate-200/80 bg-white shrink-0">
          {t('landing.preview.sampleNote')}
        </p>
      </div>
    </div>
  )
}
