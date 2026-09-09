import { useTranslation } from 'react-i18next'
import CourseBrandingForm from './CourseBrandingForm'

export default function CourseSetupModal({ open, onComplete }) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl border border-emerald-500/25 bg-token-surfaceCard shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-setup-title"
      >
        <h2 id="course-setup-title" className="font-display font-bold text-lg text-white mb-1">
          {t('org.setup.title')}
        </h2>
        <p className="text-sm text-token-textMuted mb-5">{t('org.setup.desc')}</p>
        <CourseBrandingForm showHint={false} submitLabel={t('org.branding.continue')} onSaved={() => onComplete?.()} />
      </div>
    </div>
  )
}
