import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import PhoneInput from '../../components/auth/PhoneInput'
import { canonicalAzPhoneE164 } from '../../lib/azPhone'

const RETURN_KEY = 'mx_return_after_login'
const inp =
  'w-full border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-token-textMain text-sm outline-none focus:border-primary/40 bg-token-surfaceCard/55'

function splitFullName(full) {
  const t = String(full || '').trim()
  if (!t) return { first_name: '', last_name: '' }
  const i = t.indexOf(' ')
  if (i < 0) return { first_name: t, last_name: '' }
  return { first_name: t.slice(0, i), last_name: t.slice(i + 1).trim() }
}

export default function ExamInvite() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, setSession, updateUser } = useAuthStore()
  const id = useMemo(() => String(examId || '').trim(), [examId])

  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState(null)
  const [showLoginOptions, setShowLoginOptions] = useState(false)

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

  useEffect(() => {
    if (!user) return
    const n = splitFullName(user.full_name)
    if (!firstName && n.first_name) setFirstName(n.first_name)
    if (!lastName && n.last_name) setLastName(n.last_name)
    if (!phone && user.phone) setPhone(user.phone)
  }, [user, firstName, lastName, phone])

  const collectMissing = useCallback(() => {
    const missing = []
    if (!String(firstName).trim()) missing.push('Ad')
    if (!String(lastName).trim()) missing.push('Soyad')
    if (!canonicalAzPhoneE164(phone)) {
      missing.push('Mobil telefon (+994 və 9 rəqəm, məs. 50 123 45 67)')
    }
    return missing
  }, [firstName, lastName, phone])

  const finishJoin = useCallback(
    (payload) => {
      if (payload?.token && payload?.user) {
        setSession(payload.token, { ...payload.user, needs_phone_verification: false })
      }
      toast(payload?.message || 'İmtahana daxil ola bilərsiniz', 'success')
      navigate(`/student/exams?exam=${encodeURIComponent(id)}`, { replace: true })
    },
    [id, navigate, setSession, toast],
  )

  const submitGuestJoin = useCallback(async () => {
    if (!id) return
    const missing = collectMissing()
    if (missing.length) {
      setFieldErrors(missing)
      return
    }
    setFieldErrors(null)
    const phoneCanon = canonicalAzPhoneE164(phone)
    setJoinBusy(true)
    try {
      if (user?.role === 'student') {
        const prof = await api.patch('/students/my/contact-profile', {
          first_name: String(firstName).trim(),
          last_name: String(lastName).trim(),
          phone: phoneCanon,
        })
        if (prof?.user) updateUser(prof.user)
        const sub = await api.post(`/exams/${encodeURIComponent(id)}/access-from-link`, {
          phone: phoneCanon,
        })
        finishJoin(sub)
        return
      }

      const sub = await api.post(`/public/exam-invite/${encodeURIComponent(id)}/join`, {
        first_name: String(firstName).trim(),
        last_name: String(lastName).trim(),
        phone: phoneCanon,
      })
      finishJoin(sub)
    } catch (err) {
      toast(err?.message || 'Qoşulma alınmadı', 'error')
    } finally {
      setJoinBusy(false)
    }
  }, [id, user, firstName, lastName, phone, collectMissing, finishJoin, toast, updateUser])

  const handleGoogleCredential = async (credential) => {
    setAuthBusy(true)
    try {
      let r = await api.post('/auth/google/login', { credential })
      if (r?.needs_role || r?.needs_phone_link) {
        r = await api.post('/auth/google/complete', { credential, role: 'student' })
      }
      if (r?.needs_phone_link) {
        toast('Bu Google hesabı mövcud telefon hesabına bağlanmalıdır.', 'error')
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
      const u = { ...r.user, needs_phone_verification: false }
      setSession(r.token, u)
      const n = splitFullName(u.full_name)
      if (n.first_name) setFirstName(n.first_name)
      if (n.last_name) setLastName(n.last_name)
      if (u.phone) setPhone(u.phone)
      toast('Ad və telefonu yoxlayıb «İmtahana başla» düyməsinə basın', 'success')
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
        Mentorix-də qeydiyyat olmaq <strong className="text-token-textMain">məcburi deyil</strong>. Ad, soyad və
        mobil nömrənizi daxil edib birbaşa imtahana başlayın.
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

      <Modal
        open={Boolean(fieldErrors?.length)}
        onClose={() => setFieldErrors(null)}
        title="Tələb olunan sahələr"
        size="sm"
        zIndex={10200}
        footer={
          <div className="flex justify-center">
            <Button type="button" className="min-w-[120px] justify-center" onClick={() => setFieldErrors(null)}>
              Tamam
            </Button>
          </div>
        }
      >
        <ul className="text-sm text-amber-200/95 space-y-1.5 list-disc pl-5">
          {fieldErrors?.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </Modal>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-token-textMuted mb-1.5">
              Ad *
            </label>
            <input className={inp} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-token-textMuted mb-1.5">
              Soyad *
            </label>
            <input className={inp} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-token-textMuted mb-1.5">
            Mobil telefon *
          </label>
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
        <Button type="button" loading={joinBusy} onClick={() => void submitGuestJoin()}>
          İmtahana başla
        </Button>
        <p className="text-xs text-token-textMuted leading-relaxed">
          CRM-də olmayan qonaq iştirakçı kimi qeydə alınacaqsınız. Müəllim sizə ayrıca qeydiyyat tələb etmir.
        </p>
      </Card>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setShowLoginOptions((v) => !v)}
          className="text-sm text-primary hover:underline font-medium"
        >
          {showLoginOptions ? 'Giriş seçimlərini gizlət' : 'Artıq Mentorix hesabım var'}
        </button>
        {showLoginOptions ? (
          <Card className="p-4 space-y-3 mt-3">
            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
            <Link to={loginHref} className="block text-center text-sm text-primary hover:underline font-medium">
              Email ilə giriş
            </Link>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
