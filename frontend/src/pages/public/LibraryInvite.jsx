import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'

export default function LibraryInvite() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, setSession } = useAuthStore()
  const id = useMemo(() => String(groupId || '').trim(), [groupId])
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)

  useEffect(() => {
    if (!id) { setInfoLoading(false); setInfoError('Kitabxana linki düzgün deyil'); return }
    let cancelled = false
    ;(async () => {
      setInfoLoading(true); setInfoError('')
      try {
        const d = await api.get(`/public/library-invite/${encodeURIComponent(id)}`)
        if (!cancelled) setInfo(d)
      } catch (err) {
        if (!cancelled) setInfoError(err?.message || 'Qrup tapılmadı')
      } finally { if (!cancelled) setInfoLoading(false) }
    })()
    return () => { cancelled = true }
  }, [id])

  const acceptInvite = useCallback(async () => {
    if (!id || user?.role !== 'student') return
    setJoinBusy(true)
    try {
      const sub = await api.post(`/materials/library/${encodeURIComponent(id)}/access-from-link`, {})
      toast(sub?.message || 'Kitabxanaya daxil ola bilərsiniz', 'success')
      navigate('/student/materials', { replace: true })
    } catch (err) {
      toast(err?.message || 'Qoşulma alınmadı', 'error')
    } finally { setJoinBusy(false) }
  }, [id, user?.role, navigate, toast])

  useEffect(() => {
    if (user?.role === 'student' && id && info?.group && !infoLoading && !infoError) void acceptInvite()
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

  const loginHref = `/login?next=${encodeURIComponent(id ? `/library/${id}` : '/student/materials')}`
  const group = info?.group

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 border border-white/10 bg-[#121212]/95 space-y-5">
        <div className="text-center space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Mentorix · Materiallar</p>
          <h1 className="font-display font-bold text-xl">Tədris materialları kitabxanası</h1>
          {infoLoading ? <p className="text-sm text-gray-400">Yüklənir…</p> : infoError ? <p className="text-sm text-amber-300">{infoError}</p> : group ? (
            <p className="text-sm text-gray-400"><span className="text-white font-medium">{group.instructor_name}</span> · {group.subject_name} — {group.name}</p>
          ) : null}
        </div>
        {!infoLoading && !infoError && group ? (
          <div className="space-y-4">
            <p className="text-xs text-gray-400 text-center">Materiallara baxmaq üçün Google ilə daxil olun. Telefon tələb olunmur.</p>
            {user?.role === 'student' ? (
              <div className="space-y-3 text-center">
                <p className="text-sm text-emerald-300">Daxil: <span className="font-medium">{user.email || user.full_name}</span></p>
                <Button className="w-full" onClick={() => void acceptInvite()} loading={joinBusy}>Kitabxanaya daxil ol</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
                <p className="text-center text-xs text-gray-500">və ya <Link to={loginHref} className="text-primary hover:underline">email ilə giriş</Link></p>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
