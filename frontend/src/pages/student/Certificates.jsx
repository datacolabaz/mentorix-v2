import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { normalizeApiBaseUrl } from '../../lib/apiBase'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import UserSkillProgressPanel from '../../components/student/UserSkillProgressPanel'

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

function pendingMessage(item) {
  if (item.reason === 'disabled') {
    if (item.eligible || (item.score_pct != null && item.pass_pct != null && item.score_pct >= item.pass_pct)) {
      return 'Keçdiniz, amma müəllim bu imtahanda sertifikatı aktiv etməyib.'
    }
    return 'Bu imtahan sertifikatlı deyil.'
  }
  if (item.reason === 'instructor_plan') {
    return 'Müəllimin planı sertifikat vermir (Pro lazımdır).'
  }
  if (item.reason === 'below_pass') {
    return `Keçid balı ${Math.round(Number(item.pass_pct || 0))}% — sizin nəticə ${Math.round(Number(item.score_pct || 0))}%.`
  }
  if (item.reason === 'grading_pending') {
    return 'Açıq sualların qiymətləndirilməsi gözlənilir — müəllim təsdiqlədikdən sonra sertifikat yaradıla bilər.'
  }
  if (item.reason === 'issue_failed') {
    return 'Sertifikat yaradılarkən xəta baş verdi.'
  }
  if (item.eligible) {
    return 'Sertifikat hazırlanır — «Yarat» düyməsinə basın.'
  }
  return 'Sertifikat mövcud deyil.'
}

export default function StudentCertificates() {
  const { t } = useTranslation()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState(null)
  const [emailingId, setEmailingId] = useState(null)
  const [refreshingId, setRefreshingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [certs, pend] = await Promise.all([
        api.get('/certificates/my'),
        api.get('/certificates/my/pending'),
      ])
      setRows(Array.isArray(certs?.certificates) ? certs.certificates : [])
      setPending(Array.isArray(pend?.pending) ? pend.pending : [])
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

  const claim = async (examId) => {
    setClaimingId(examId)
    try {
      const r = await api.post(`/certificates/my/claim/${encodeURIComponent(examId)}`)
      if (r?.certificate) {
        toast('🎓 Sertifikat yaradıldı!', 'success')
        await load()
      } else {
        toast(r?.message || 'Sertifikat yaradıla bilmədi', 'error')
        await load()
      }
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setClaimingId(null)
    }
  }

  const emailCertificate = async (id) => {
    setEmailingId(id)
    try {
      const r = await api.post(`/certificates/my/${encodeURIComponent(id)}/email`)
      toast(r?.message || 'Sertifikat email ünvanınıza göndərildi', 'success')
    } catch (e) {
      toast(e?.message || 'Email göndərilmədi', 'error')
    } finally {
      setEmailingId(null)
    }
  }

  const refreshPdf = async (id, certNo) => {
    setRefreshingId(id)
    try {
      const r = await api.post(`/certificates/my/${encodeURIComponent(id)}/refresh`)
      toast(r?.message || 'PDF yeniləndi', 'success')
      // Immediately re-download the updated PDF for convenience.
      await download(id, certNo)
    } catch (e) {
      toast(e?.message || 'PDF yenilənmədi', 'error')
    } finally {
      setRefreshingId(null)
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

      <div className="mb-8">
        <UserSkillProgressPanel />
      </div>

      {loading ? (
        <p className="text-token-textMuted text-sm">{t('common.loading', 'Yüklənir…')}</p>
      ) : (
        <>
          {rows.length === 0 && pending.length === 0 ? (
            <Card className="p-6 text-sm text-token-textMuted">
              {t('certificates.empty', 'Hələ sertifikat yoxdur. İmtahanı keçid balı ilə tamamlayın.')}
            </Card>
          ) : null}

          {pending.length > 0 ? (
            <div className="mb-6 space-y-3">
              <h2 className="text-sm font-semibold text-token-textMain">Gözləyən / yoxlanılmalı</h2>
              {pending.map((p) => (
                <Card key={p.exam_id} className="p-4 border-amber-500/25">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-token-textMain">{p.title}</p>
                      <p className="text-xs text-token-textMuted mt-1">
                        {p.score_pct != null ? `${Math.round(Number(p.score_pct))}%` : '—'}
                        {p.pass_pct != null ? ` · keçid ${Math.round(Number(p.pass_pct))}%` : ''}
                      </p>
                      <p className="text-sm text-amber-200/90 mt-2">{pendingMessage(p)}</p>
                    </div>
                    {(p.eligible || p.reason === 'issue_failed' || (p.score_pct >= p.pass_pct && p.reason === 'disabled')) ? (
                      <Button
                        size="sm"
                        loading={claimingId === p.exam_id}
                        onClick={() => void claim(p.exam_id)}
                      >
                        {p.reason === 'disabled' ? 'Sertifikatı yoxla' : 'Sertifikat yarat'}
                      </Button>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          ) : null}

          {rows.length > 0 ? (
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
                          <span className="text-token-textMain font-medium">
                            {Number(c.score_pct || 0).toFixed(0)}%
                          </span>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              loading={refreshingId === c.id}
                              onClick={() => void refreshPdf(c.id, c.certificate_no)}
                            >
                              {t('certificates.refreshPdf', 'PDF-i yenilə')}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={emailingId === c.id}
                              onClick={() => void emailCertificate(c.id)}
                            >
                              {t('certificates.email', 'Emailə göndər')}
                            </Button>
                            <a
                              href={linkedInShareUrl({
                                courseTitle: c.title,
                                verifyUrl,
                                certNo: c.certificate_no,
                              })}
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
          ) : null}
        </>
      )}
    </div>
  )
}
