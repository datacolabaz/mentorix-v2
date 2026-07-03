import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import PublicPageTopBar from '../../components/public/PublicPageTopBar'

function statusBadge(cert, t) {
  if (cert?.valid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1 text-sm font-semibold">
        ✓ {t('certificates.verify.valid', 'Valid')}
      </span>
    )
  }
  if (cert?.status === 'superseded') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-200 px-3 py-1 text-sm font-semibold">
        {t('certificates.verify.superseded', 'Yenilənib')}
      </span>
    )
  }
  if (cert?.status === 'revoked') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-300 px-3 py-1 text-sm font-semibold">
        {t('certificates.verify.revoked', 'Ləğv edilib')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/15 text-gray-300 px-3 py-1 text-sm font-semibold">
      {t('certificates.verify.invalid', 'Etibarsız')}
    </span>
  )
}

export default function CertificateVerify() {
  const { token } = useParams()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [cert, setCert] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const r = await api.get(`/certificates/verify/${encodeURIComponent(token || '')}`)
        if (!cancelled) setCert(r?.certificate || null)
      } catch (e) {
        if (!cancelled) setError(e?.message || t('certificates.verify.notFound', 'Sertifikat tapılmadı'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, t])

  return (
    <div className="min-h-screen bg-[#07051a] text-white">
      <PublicPageTopBar />
      <div className="max-w-xl mx-auto px-4 py-10">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 mb-6">
            <h1 className="text-xl font-bold">{t('certificates.verify.title', 'Sertifikat doğrulama')}</h1>
            {!loading && cert ? statusBadge(cert, t) : null}
          </div>

          {loading ? (
            <p className="text-gray-400 text-sm">{t('common.loading', 'Yüklənir…')}</p>
          ) : error ? (
            <p className="text-red-300 text-sm">{error}</p>
          ) : cert ? (
            <div className="space-y-4 text-sm">
              <p className="text-gray-400 text-xs uppercase tracking-wider">
                {t('certificates.verify.issuedBy', 'Issued by Mentorix')}
              </p>
              <div>
                <p className="text-gray-500 text-xs">{t('certificates.verify.student', 'Tələbə')}</p>
                <p className="font-semibold text-white">{cert.student_name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{t('certificates.verify.instructor', 'Müəllim')}</p>
                <p className="font-semibold text-white">{cert.instructor_name}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{t('certificates.verify.course', 'Kurs / İmtahan')}</p>
                <p className="font-semibold text-white">{cert.course_title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-500 text-xs">{t('certificates.verify.score', 'Bal')}</p>
                  <p className="font-semibold text-white">{Number(cert.score_pct || 0).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">{t('certificates.verify.date', 'Tarix')}</p>
                  <p className="font-semibold text-white">
                    {cert.issued_at
                      ? new Date(cert.issued_at).toLocaleDateString('az-AZ', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs">{t('certificates.verify.certId', 'Sertifikat ID')}</p>
                <p className="font-mono text-blue-200 break-all">{cert.certificate_no}</p>
              </div>
              {cert.superseded ? (
                <p className="text-amber-200/90 text-xs rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                  {t(
                    'certificates.verify.supersededHint',
                    'Bu sertifikat yenilənib. Ən son versiya üçün müəllim və ya tələbə ilə əlaqə saxlayın.',
                  )}
                </p>
              ) : null}
              <p className="text-[11px] text-gray-500 pt-2 border-t border-white/10">
                {t('certificates.verify.disclaimer', 'Bu rəsmi dövlət akkreditasiyası deyil.')}
              </p>
            </div>
          ) : null}

          <div className="mt-8">
            <Link to="/">
              <Button variant="secondary">{t('certificates.verify.backHome', 'Ana səhifə')}</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
