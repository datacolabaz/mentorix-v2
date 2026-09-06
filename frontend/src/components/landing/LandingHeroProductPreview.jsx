import { useTranslation } from 'react-i18next'
import LandingDemoActivityChart from './LandingDemoActivityChart'

/** Hero sağ sütun — nümunə müəllim paneli (real statistikaya bənzədilməyib). */
export default function LandingHeroProductPreview({ onOpenDemo }) {
  const { t } = useTranslation()

  const rows = [
    { label: t('landing.preview.groupLabel'), value: t('landing.preview.groupName'), meta: t('landing.preview.studentCount') },
    { label: t('landing.preview.examLabel'), value: t('landing.preview.examName'), meta: t('landing.preview.examStatus') },
    { label: t('landing.preview.paymentLabel'), value: t('landing.preview.paymentStatus'), meta: t('landing.preview.assignmentStatus') },
  ]

  return (
    <div
      id="mx-hero-preview"
      className="relative w-full max-w-md mx-auto lg:max-w-none lg:w-full shrink-0"
    >
      <button
        type="button"
        onClick={onOpenDemo}
        className="group w-full text-left rounded-2xl border border-white/10 bg-[#101010] shadow-[0_20px_60px_-28px_rgba(0,229,176,0.35)] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label={t('landing.preview.ariaLabel')}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#161616]">
          <span className="flex gap-1 shrink-0" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
            <span className="h-2 w-2 rounded-full bg-white/15" />
          </span>
          <span className="text-[11px] font-semibold text-gray-300 truncate">{t('landing.preview.appTitle')}</span>
          <span className="ml-auto shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-400">
            {t('landing.preview.badge')}
          </span>
        </div>

        <div className="flex gap-1 px-2 pt-2 overflow-x-auto">
          {[t('landing.preview.tabs.students'), t('landing.preview.tabs.exams'), t('landing.preview.tabs.payments')].map(
            (tab, i) => (
              <span
                key={tab}
                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold whitespace-nowrap ${
                  i === 0
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'text-gray-500 border border-transparent'
                }`}
              >
                {tab}
              </span>
            ),
          )}
        </div>

        <div className="p-3 space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#151515] px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-gray-500">{row.label}</div>
                <div className="text-xs font-semibold text-gray-100 truncate">{row.value}</div>
              </div>
              <div className="shrink-0 text-[10px] font-semibold text-primary/90">{row.meta}</div>
            </div>
          ))}
          <LandingDemoActivityChart compact />
          <p className="text-[10px] text-gray-500 text-center pt-0.5">{t('landing.preview.sampleNote')}</p>
        </div>
      </button>
    </div>
  )
}
