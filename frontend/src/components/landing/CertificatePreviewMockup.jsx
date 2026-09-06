import { useTranslation } from 'react-i18next'
import CertificateCard from '../certificate/CertificateCard'
import { SAMPLE_CERTIFICATE } from '@shared/certificateLayout.mjs'
import { resolveUiLocale } from '../../lib/uiLocale'

/** Landing/kataloq sertifikat mockup — real PDF ilə eyni shared layout. */
export default function CertificatePreviewMockup({ className = '' }) {
  const { t, i18n } = useTranslation()
  const locale = resolveUiLocale(i18n.language)
  const data = {
    ...SAMPLE_CERTIFICATE,
    studentName: t('landing.certificate.studentName'),
    instructorName: t('landing.certificate.instructorName'),
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-3 rounded-2xl bg-primary/20 blur-2xl opacity-60" aria-hidden />
      <div className="relative">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {t('landing.certificate.sampleLabel')}
        </p>
        <CertificateCard data={data} locale={locale} />
      </div>
    </div>
  )
}
