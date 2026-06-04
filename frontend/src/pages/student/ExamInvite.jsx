import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'

const RETURN_KEY = 'mx_return_after_login'

export default function ExamInvite() {
  const { examId } = useParams()
  const toast = useToast()
  const { user, setSession } = useAuthStore()
  const id = useMemo(() => String(examId || '').trim(), [examId])

  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestState, setRequestState] = useState(null) // pending | assigned | error

  useEffect(() => {
    if (!id) {
      setInfoLoading(false)
      setInfoError('İmtahan linki düzgün deyil')
      return
    }
    try {
      sessionStorage.setItem(RETURN_KEY, `/exam/${encodeURIComponent(id)}`)
    } catch {
      /* ignore */
    }
    let cancelled = false
    ;(async () => {
      setInfoLoading(true)
      setInfoError('')
      try {
        const d = await api.get(`/public/exam-invite/${encodeURIComponent(id)}`)
        if (!cancelled) setInfo(d)
      } catch (err) {
        if (!cancelled) setInfoError(err?.message || 'İmtahan tapılmadı')
      } finally {
        if (!cancelled) setInfoLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const submitAccessRequest = useCallback(async () => {
    if (!id) return
    setRequestBusy(true)
    try {
      const sub = await api.post(`/exams/${encodeURIComponent(id)}/access-from-link`)
      if (sub?.already_assigned) {
        setRequestState('assigned')
        toast('İmtahan sizə təyin edilib', 'success')
        return
      }
      setRequestState('pending')
      toast(sub?.message || 'Müəllimə sorğu göndərildi', 'success')
    } catch (err) {
      setRequestState('error')
      if (err?.code === 'ALREADY_PENDING' || String(err?.message || '').includes('artıq göndərilib')) {
        setRequestState('pending')
        return
      }
      toast(err?.message || 'Sorğu göndərilmədi', 'error')
    } finally {
      setRequestBusy(false)
    }
  }, [id, toast])

  useEffect(() => {
    if (!user || user.role !== 'student' || !id || infoLoading || infoError) return
    void submitAccessRequest()
  }, [user, id, infoLoading, infoError, submitAccessRequest])

  const handleGoogleCredential = async (credential) => {
    setAuthBusy(true)
    try {
      let r = await api.post('/auth/google/login', { credential })
      if (r?.needs_role) {
        r = await api.post('/auth/google/complete', { credential, role: 'student' })
      }
      if (r?.needs_phone_link) {
        toast('Bu Google hesabı mövcud telefon hesabına bağlanmalıdır — müəllimlə əlaqə saxlayın.', 'error')
        return
      }
      if (!r?.token || !r?.user) {
        toast(r?.message || 'Google girişi tamamlanmadı', 'error')
        return
      }
      if (r.user.role && r.user.role !== 'student') {
        toast('Bu hesab tələbə deyil', 'error')
        return
      }
      setSession(r.token, r.user)
      toast('Daxil oldunuz — müəllimə sorğu göndərilir', 'success')
    } catch (err) {
      toast(err?.message || 'Google girişi uğursuz', 'error')
    } finally {
      setAuthBusy(false)
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(id ? `/exam/${id}` : '/student')}`

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto w-full min-h-[70vh]">
      <h1 className="font-display font-bold text-2xl text-token-textMain">İmtahana qoşul</h1>
      <p className="text-sm text-token-textMuted mt-1 mb-6">
        Müəllimin paylaşdığı link. Google ilə daxil olun — sorğu avtomatik müəllimə gedəcək.
      </p>

      {infoLoading && <p className="text-sm text-token-textMuted">Yüklənir…</p>}
      {infoError && (
        <Card className="p-4 border border-red-500/30 text-red-300 text-sm mb-4">{infoError}</Card>
      )}
      {info?.exam && (
        <Card className="p-4 mb-4 border border-[color:var(--border-subtle)]">
          <p className="text-xs uppercase tracking-wider text-token-textMuted mb-1">İmtahan</p>
          <p className="text-lg font-semibold text-token-textMain">{info.exam.title}</p>
          <p className="text-sm text-token-textMuted mt-1">Müəllim: {info.exam.instructor_name}</p>
        </Card>
      )}

      {user?.role === 'student' ? (
        <Card className="p-4 space-y-3">
          {requestBusy && <p className="text-sm text-token-textMuted">Sorğu göndərilir…</p>}
          {requestState === 'pending' && (
            <p className="text-sm text-amber-200/90">
              Sorğu müəllimə göndərilib. Təsdiqlədikdən sonra{' '}
              <Link to="/student/exams" className="text-primary hover:underline">
                İmtahanlarım
              </Link>{' '}
              bölməsindən imtahana başlaya bilərsiniz.
            </p>
          )}
          {requestState === 'assigned' && (
            <p className="text-sm text-emerald-300/90">
              Sizə təyin edilib.{' '}
              <Link to={`/student/exams?exam=${encodeURIComponent(id)}`} className="text-primary hover:underline">
                İmtahana keç
              </Link>
            </p>
          )}
          {requestState === 'error' && (
            <Button type="button" loading={requestBusy} onClick={() => void submitAccessRequest()}>
              Sorğunu yenidən göndər
            </Button>
          )}
        </Card>
      ) : user ? (
        <Card className="p-4 text-sm text-amber-200/90">Bu hesab tələbə deyil. Tələbə hesabı ilə daxil olun.</Card>
      ) : (
        <Card className="p-4 space-y-4">
          <p className="text-sm text-token-textMuted">
            Davam etmək üçün tələbə kimi Google ilə daxil olun. Sorğu avtomatik müəllimə gedəcək.
          </p>
          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
          <Link
            to={loginHref}
            className="block text-center text-sm text-primary hover:underline font-medium"
          >
            Email ilə giriş
          </Link>
        </Card>
      )}
    </div>
  )
}
