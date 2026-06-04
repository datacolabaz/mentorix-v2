import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  const toast = useToast()
  const { user, setSession, updateUser } = useAuthStore()
  const id = useMemo(() => String(examId || '').trim(), [examId])

  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestState, setRequestState] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState(null)

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

  const submitAccessRequest = useCallback(async () => {
    if (!id || !user) return
    const missing = collectMissing()
    if (missing.length) {
      setFieldErrors(missing)
      return
    }
    setFieldErrors(null)
    const phoneCanon = canonicalAzPhoneE164(phone)
    setRequestBusy(true)
    try {
      const prof = await api.patch('/students/my/contact-profile', {
        first_name: String(firstName).trim(),
        last_name: String(lastName).trim(),
        phone: phoneCanon,
      })
      if (prof?.user) updateUser(prof.user)

      const sub = await api.post(`/exams/${encodeURIComponent(id)}/access-from-link`, {
        phone: phoneCanon,
      })
      if (sub?.already_assigned) {
        setRequestState('assigned')
        toast('İmtahan sizə təyin edilib', 'success')
        return
      }
      setRequestState('pending')
      toast(sub?.message || 'Müraciət müəllimə göndərildi', 'success')
    } catch (err) {
      setRequestState('error')
      if (err?.code === 'ALREADY_PENDING' || String(err?.message || '').includes('artıq göndərilib')) {
        setRequestState('pending')
        return
      }
      if (err?.code === 'PROFILE_INCOMPLETE' || err?.code === 'PHONE_REQUIRED') {
        setFieldErrors(collectMissing())
        return
      }
      toast(err?.message || 'Sorğu göndərilmədi', 'error')
    } finally {
      setRequestBusy(false)
    }
  }, [id, user, firstName, lastName, phone, collectMissing, toast, updateUser])

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
      const n = splitFullName(r.user.full_name)
      if (n.first_name) setFirstName(n.first_name)
      if (n.last_name) setLastName(n.last_name)
      if (r.user.phone) setPhone(r.user.phone)
      toast('İndi ad, soyad və telefonu doldurub müraciət göndərin', 'success')
    } catch (err) {
      toast(err?.message || 'Google girişi uğursuz', 'error')
    } finally {
      setAuthBusy(false)
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(id ? `/exam/${id}` : '/student')}`
  const showProfileForm =
    user?.role === 'student' && requestState !== 'pending' && requestState !== 'assigned'

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto w-full min-h-[70vh]">
      <h1 className="font-display font-bold text-2xl text-token-textMain">İmtahana qoşul</h1>
      <p className="text-sm text-token-textMuted mt-1 mb-6">
        Müəllimin paylaşdığı link. Google ilə daxil olun, məlumatlarınızı tam doldurun — sonra müraciət müəllimə
        gedəcək.
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
        <p className="text-sm text-center text-zinc-300 mb-3 leading-relaxed">
          Müraciət müəllimə yalnız bu məlumatlar doldurulduqdan sonra gedəcək:
        </p>
        <ul className="text-sm text-amber-200/95 space-y-1.5 list-disc pl-5">
          {fieldErrors?.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </Modal>

      {user?.role === 'student' ? (
        <Card className="p-4 space-y-4">
          {showProfileForm && (
            <>
              <p className="text-sm text-token-textMuted leading-relaxed">
                Bütün sahələri doldurun. Boş və ya natamam müraciət müəllimə <strong>göndərilmir</strong>.
              </p>
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
              <Button type="button" loading={requestBusy} onClick={() => void submitAccessRequest()}>
                Müraciəti müəllimə göndər
              </Button>
            </>
          )}
          {requestState === 'pending' && (
            <p className="text-sm text-amber-200/90">
              Müraciət müəllimə göndərilib. Təsdiqdən sonra bildiriş <strong>Gmail</strong> ünvanınıza gedəcək.{' '}
              <Link to="/student/exams" className="text-primary hover:underline">
                İmtahanlarım
              </Link>
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
              Yenidən cəhd et
            </Button>
          )}
        </Card>
      ) : user ? (
        <Card className="p-4 text-sm text-amber-200/90">Bu hesab tələbə deyil. Tələbə hesabı ilə daxil olun.</Card>
      ) : (
        <Card className="p-4 space-y-4">
          <p className="text-sm text-token-textMuted">
            Əvvəlcə tələbə kimi Google ilə daxil olun. Sonra ad, soyad və telefonu doldurub müraciət göndərin.
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
