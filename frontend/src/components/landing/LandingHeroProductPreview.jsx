import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function Chevron({ open }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Hero — yüngül dashboard çərçivəsi (qrafik və əlavə detallar demo paneldədir). */
export default function LandingHeroProductPreview({ onOpenDemo }) {
  const { t } = useTranslation()
  const [openId, setOpenId] = useState('students')

  const sections = [
    {
      id: 'students',
      title: t('landing.preview.tabs.students'),
      kicker: t('landing.preview.groupLabel'),
      summary: t('landing.preview.groupName'),
      detail: t('landing.preview.studentCount'),
    },
    {
      id: 'exams',
      title: t('landing.preview.tabs.exams'),
      kicker: t('landing.preview.examLabel'),
      summary: t('landing.preview.examName'),
      detail: t('landing.preview.examStatus'),
      detailTone: 'ok',
    },
    {
      id: 'payments',
      title: t('landing.preview.tabs.payments'),
      kicker: t('landing.preview.paymentLabel'),
      summary: t('landing.preview.paymentsHint'),
      detail: t('landing.preview.openPanel'),
    },
  ]

  const toggle = (id) => setOpenId((prev) => (prev === id ? '' : id))

  return (
    <div
      id="mx-hero-preview"
      className="relative w-full min-w-0 h-full"
      aria-label={t('landing.preview.ariaLabel')}
    >
      <div className="h-full rounded-2xl border border-slate-200/80 bg-[#f4f7fa] text-slate-900 shadow-[0_24px_50px_-28px_rgba(255,255,255,0.35)] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-slate-200/80 bg-white">
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

        <div className="sm:hidden px-3 pt-3 grid grid-cols-1 gap-2">
          <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 space-y-0.5">
            <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('landing.preview.groupLabel')}</p>
            <p className="text-xs font-semibold text-slate-900 leading-snug">{t('landing.preview.groupName')}</p>
            <p className="text-[11px] text-slate-500">{t('landing.preview.studentCount')}</p>
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{t('landing.preview.examLabel')}</p>
              <p className="text-xs font-semibold text-slate-900 truncate">{t('landing.preview.examName')}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              {t('landing.preview.examStatus')}
            </span>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[10.5rem_minmax(0,1fr)] min-h-0">
          <nav className="sm:border-r sm:border-slate-200/80 bg-white/70 px-2 py-2 space-y-1" aria-label={t('landing.preview.appTitle')}>
            {sections.map((section) => {
              const open = openId === section.id
              return (
                <div key={section.id} className="rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(section.id)}
                    aria-expanded={open}
                    className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-semibold transition-colors ${
                      open
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/80'
                        : 'text-slate-600 border border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{section.title}</span>
                    <Chevron open={open} />
                  </button>
                  {open ? (
                    <div className="sm:hidden px-2.5 pb-2.5 pt-1 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{section.kicker}</p>
                      <p className="text-xs font-semibold text-slate-800 leading-snug">{section.summary}</p>
                      <p
                        className={`text-[11px] font-semibold ${
                          section.detailTone === 'ok' ? 'text-emerald-600' : 'text-slate-500'
                        }`}
                      >
                        {section.detail}
                      </p>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </nav>

          <div className="hidden sm:flex flex-col gap-4 p-4 bg-[#f4f7fa]">
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 space-y-1">
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

        <div className="sm:hidden px-3 pb-3">
          <button
            type="button"
            onClick={onOpenDemo}
            className="w-full inline-flex justify-center items-center rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            {t('landing.preview.openPanel')}
          </button>
        </div>

        <p className="text-[10px] text-slate-400 text-center px-3 py-2 border-t border-slate-200/80 bg-white">
          {t('landing.preview.sampleNote')}
        </p>
      </div>
    </div>
  )
}
