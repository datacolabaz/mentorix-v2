import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { normalizeApiBaseUrl } from '../../lib/apiBase'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function linkedInShareUrl({ courseTitle, verifyUrl, certNo }) {
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: courseTitle || 'Course',
    organizationName: 'Mentorix',
    certUrl: verifyUrl,
    certId: certNo || '',
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

export default function StudentCertificates() {
  const { t } = useTranslation()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/certificates/my')
      setRows(Array.isArray(r?.certificates) ? r.certificates : [])
    } catch (e) {
      toast(e?.message || t('certificates.loadFailed', 'Yüklənmədi'), 'error')
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  useEffect(() => {
    void load()
  }, [load])

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://mentorix.az'

  const download = async (id, certNo) => {
    try {
      const token = localStorage.getItem('mx_token')
      const apiBase = normalizeApiBaseUrl(import.meta.env.VITE_API_URL)
      const res = await fetch(`${apiBase}/certificates/my/${id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error(t('certificates.downloadFailed', 'PDF yüklənmədi'))
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${certNo || 'certificate'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast(e?.message || t('certificates.downloadFailed', 'PDF yüklənmədi'), 'error')
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-token-textMain">{t('certificates.title', 'Sertifikatlarım')}</h1>
        <p className="text-sm text-token-textMuted mt-1">
          {t('certificates.subtitle', 'Keçdiyiniz imtahanlar üçün rəsmi tamamlama sertifikatları.')}
        </p>
      </div>

      {loading ? (
        <p className="text-token-textMuted text-sm">{t('common.loading', 'Yüklənir…')}</p>
      ) : rows.length === 0 ? (
        <Card className="p-6 text-sm text-token-textMuted">
          {t('certificates.empty', 'Hələ sertifikat yoxdur. İmtahanı keçid balı ilə tamamlayın.')}
        </Card>
      ) : (
        <div className="grid gap-4">
          {rows.map((c) => {
            const verifyUrl = `${base}/c/${c.verification_token}`
            const active = c.status === 'issued'
            return (
              <Card key={c.id} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-token-textMain">{c.title}</p>
                    {c.subject ? <p className="text-xs text-token-textMuted mt-0.5">{c.subject}</p> : null}
                    <p className="text-sm text-token-textMuted mt-2">
                      {t('certificates.score', 'Bal')}:{' '}
                      <span className="text-token-textMain font-medium">{Number(c.score_pct || 0).toFixed(0)}%</span>
                      {' · '}
                      {c.issued_at
                        ? new Date(c.issued_at).toLocaleDateString('az-AZ', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : ''}
                    </p>
                    <p className="text-[11px] font-mono text-token-textMuted mt-1">{c.certificate_no}</p>
                    {!active ? (
                      <p className="text-xs text-amber-600 dark:text-amber-300 mt-2">
                        {t('certificates.superseded', 'Köhnə versiya — yenisi buraxılıb')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {active ? (
                      <>
                        <Button size="sm" onClick={() => void download(c.id, c.certificate_no)}>
                          {t('certificates.download', 'PDF yüklə')}
                        </Button>
                        <a
                          href={linkedInShareUrl({ courseTitle: c.title, verifyUrl, certNo: c.certificate_no })}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-lg border border-[#0a66c2]/40 bg-[#0a66c2]/10 px-3 py-1.5 text-xs font-semibold text-[#6eb6ff] hover:bg-[#0a66c2]/20"
                        >
                          LinkedIn
                        </a>
                      </>
                    ) : null}
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg border border-indigo-500/30 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/10"
                    >
                      {t('certificates.verifyLink', 'Doğrula')}
                    </a>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
