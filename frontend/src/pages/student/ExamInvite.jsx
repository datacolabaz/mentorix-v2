import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'

const RETURN_KEY = 'mx_return_after_login'

export default function ExamInvite() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, setSession } = useAuthStore()
  const id = useMemo(() => String(examId || '').trim(), [examId])
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)

  useEffect(() => {
    if (!id) { setInfoLoading(false); setInfoError('İmtahan linki düzgün deyil'); return }
    try { sessionStorage.setItem(RETURN_KEY, `/exam/${encodeURIComponent(id)}`) } catch { /* ignore */ }
    let cancelled = false
    ;(async () => {
      setInfoLoading(true); setInfoError('')
      try {
        const d = await api.get(`/public/exam-invite/${encodeURIComponent(id)}`)
        if (!cancelled) setInfo(d)
      } catch (err) {
        if (!cancelled) setInfoError(err?.message || 'İmtahan tapılmadı')
      } finally { if (!cancelled) setInfoLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  const acceptInvite = useCallback(async () => {
    if (!id || user?.role !== 'student') return
    setJoinBusy(true)
    try {
      const sub = await api.post(`/exams/${encodeURIComponent(id)}/access-from-link`, {})
      toast(sub?.message || 'İmtahana daxil ola bilərsiniz', 'success')
      navigate(`/student/exams?exam=${encodeURIComponent(id)}`, { replace: true })
    } catch (err) {
      toast(err?.message || 'Qoşulma alınmadı', 'error')
    } finally { setJoinBusy(false) }
  }, [id, user?.role, navigate, toast])

  useEffect(() => {
    if (user?.role === 'student' && id && info?.exam && !infoLoading && !infoError) void acceptInvite()
  }, [user?.role, id, info, infoLoading, infoError, acceptInvite])

  const handleGoogleCredential = async (credential) => {
    setAuthBusy(true)
    try {
      let r = await api.post('/auth/google/login', { credential })
      if (r?.needs_role || r?.needs_phone_link) r = await api.post('/auth/google/complete', { credential, role: 'student' })
      if (r?.needs_phone_link) return toast('Bu Google hesabı başqa telefon hesabına bağlıdır.', 'error')
      if (!r?.token || !r?.user) return toast(r?.message || 'Google girişi tamamlanmadı', 'error')
      if (r.user.role && r.user.role !== 'student') return toast('Bu hesab tələbə deyil', 'error')
      setSession(r.token, { ...r.user, needs_phone_verification: false })
      toast('Daxil oldunuz', 'success')
    } catch (err) { toast(err?.message || 'Google girişi uğursuz', 'error') }
    finally { setAuthBusy(false) }
  }

  const loginHref = `/login?next=${encodeURIComponent(id ? `/exam/${id}` : '/student')}`
  const exam = info?.exam

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto w-full min-h-[70vh]">
      <h1 className="font-display font-bold text-2xl text-token-textMain">İmtahana qoşul</h1>
      <p className="text-sm text-token-textMuted mt-1 mb-6">İmtahana başlamaq üçün Google ilə daxil olun. Telefon tələb olunmur.</p>
      {infoLoading && <p className="text-sm text-token-textMuted">Yüklənir…</p>}
      {infoError && <Card className="p-4 border border-red-500/30 text-red-300 text-sm mb-4">{infoError}</Card>}
      {exam && (
        <Card className="p-4 mb-4 border border-[color:var(--border-subtle)]">
          <p className="text-xs uppercase tracking-wider text-token-textMuted mb-1">İmtahan</p>
          <p className="text-lg font-semibold text-token-textMain">{exam.title}</p>
          <p className="text-sm text-token-textMuted mt-1">Müəllim: {exam.instructor_name}</p>
        </Card>
      )}
      {!infoLoading && !infoError && exam ? (
        <Card className="p-4 space-y-4">
          {user?.role === 'student' ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-emerald-300">Daxil: <span className="font-medium">{user.email || user.full_name}</span></p>
              <Button type="button" loading={joinBusy} onClick={() => void acceptInvite()}>İmtahana başla</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
              <Link to={loginHref} className="block text-center text-sm text-primary hover:underline font-medium">Email ilə giriş</Link>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  )
}
