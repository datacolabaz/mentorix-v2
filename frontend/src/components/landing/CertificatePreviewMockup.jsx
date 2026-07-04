import { useTranslation } from 'react-i18next'
import CertificateCard from '../certificate/CertificateCard'
import { SAMPLE_CERTIFICATE } from '@shared/certificateLayout.mjs'

/** Landing/kataloq sertifikat mockup — real PDF ilə eyni shared layout. */
export default function CertificatePreviewMockup({ className = '' }) {
  const { i18n } = useTranslation()
  const locale = i18n.language?.startsWith('ru') ? 'ru' : 'az'

  return (
    <div className={`relative ${className}`}>
      <div className="absolute -inset-3 rounded-2xl bg-primary/20 blur-2xl opacity-60" aria-hidden />
      <CertificateCard data={SAMPLE_CERTIFICATE} locale={locale} />
    </div>
  )
}
