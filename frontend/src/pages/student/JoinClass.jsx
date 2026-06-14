import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import PhoneInput from '../../components/auth/PhoneInput'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import { useStudentGroupsOptional } from '../../contexts/StudentGroupContext'
import { formatAzn } from '../../lib/groupPaymentTerms'
import { canonicalAzPhoneE164 } from '../../lib/azPhone'
import JoinGroupTermsOverview from '../../components/student/JoinGroupTermsOverview'
import { parseJoinInviteInput } from '../../lib/joinInvite'

const inp =
  'w-full border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-token-textMain text-sm outline-none focus:border-primary/40 bg-token-surfaceCard/55'

function splitFullName(full) {
  const t = String(full || '').trim()
  if (!t) return { first_name: '', last_name: '' }
  const i = t.indexOf(' ')
  if (i < 0) return { first_name: t, last_name: '' }
  return { first_name: t.slice(0, i), last_name: t.slice(i + 1).trim() }
}

export default function JoinClass() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user, setSession } = useAuthStore()
  const ctx = useStudentGroupsOptional()
  const refreshEnrollments = ctx?.refreshEnrollments ?? (async () => {})
  const params = useParams()
  const [searchParams] = useSearchParams()

  const initialCode = useMemo(() => {
    return parseJoinInviteInput(
      params.code ||
        searchParams.get('code') ||
        searchParams.get('link') ||
        searchParams.get('url') ||
        '',
    )
  }, [params.code, searchParams])

  const backHref = user?.role === 'student' ? '/student/groups' : '/login'

  const [joinInfo, setJoinInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(initialCode))
  const [infoError, setInfoError] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [referralSourceId, setReferralSourceId] = useState('')
  const [referralNotes, setReferralNotes] = useState('')

  useEffect(() => {
    if (!initialCode) {
      setJoinInfo(null)
      setInfoLoading(false)
      setInfoError('Dəvət linki düzgün deyil. Müəllimin göndərdiyi linkə birbaşa toxunun.')
      return
    }
    let cancelled = false
    ;(async () => {
      setInfoLoading(true)
      setInfoError('')
      try {
        const d = await api.get(`/public/join/${encodeURIComponent(initialCode)}`)
        if (!cancelled) setJoinInfo(d)
      } catch (err) {
        if (!cancelled) setInfoError(err?.message || 'Dəvət linki tapılmadı')
      } finally {
        if (!cancelled) setInfoLoading(false)
      }
   })()
    return () => {
      cancelled = true
    }
  }, [initialCode])

  useEffect(() => {
    if (!user) return
    const n = splitFullName(user.full_name)
    if (!firstName && n.first_name) setFirstName(n.first_name)
    if (!lastName && n.last_name) setLastName(n.last_name)
    if (!phone && user.phone) setPhone(user.phone)
  }, [user, firstName, lastName, phone])

  const persistAuth = useCallback(
    (token, authUser) => {
      setSession(token, authUser)
    },
    [setSession],
  )

  const handleGoogleCredential = async (credential) => {
    setAuthBusy(true)
    try {
      let r = await api.post('/auth/google/login', { credential })
      if (r?.needs_role || r?.needs_phone_link) {
        r = await api.post('/auth/google/complete', { credential, role: 'student' })
      }
      if (r?.needs_phone_link) {
        toast('Bu Google hesabı mövcud telefon hesabına bağlanmalıdır — dəstək ilə əlaqə saxlayın.', 'error')
        return
      }
      if (!r?.token || !r?.user) {
        toast(r?.message || 'Google girişi tamamlanmadı', 'error')
        return
      }
      if (r.user.role && r.user.role !== 'student') {
        toast('Bu hesab tələbə deyil — müəllim panelinə daxil olun.', 'error')
        return
      }
      const u = { ...r.user, needs_phone_verification: false }
      persistAuth(r.token, u)
      try {
        if (initialCode) {
          sessionStorage.setItem('mx_return_after_login', `/join/${encodeURIComponent(initialCode)}`)
        }
      } catch {
        /* ignore */
      }
      toast('Daxil oldunuz', 'success')
    } catch (err) {
      toast(err?.message || 'Google girişi uğursuz', 'error')
    } finally {
      setAuthBusy(false)
    }
  }

  const submitRequest = async (e) => {
    e?.preventDefault?.()
    if (!initialCode) return toast('Dəvət linki düzgün deyil', 'error')
    if (!user) return toast('Əvvəlcə Google ilə daxil olun', 'error')
    const fn = String(firstName).trim()
    const ln = String(lastName).trim()
    if (!fn || !ln) return toast('Ad və soyad tələb olunur', 'error')
    const phoneCanon = canonicalAzPhoneE164(phone)
    if (!phoneCanon) {
      return toast('Telefon düzgün deyil: +994 və 9 rəqəm (məs. 50 123 45 67)', 'error')
    }
    if (!joinInfo?.package_offer) {
      return toast('Qrup paketi hələ hazır deyil — müəllimlə əlaqə saxlayın', 'error')
    }
    if (!termsAccepted) return toast('Ödəniş şərtləri ilə razılaşın', 'error')
    setBusy(true)
    try {
      const r = await api.post('/students/my/join', {
        code: initialCode,
        first_name: fn,
        last_name: ln,
        phone_number: phoneCanon,
        parent_name: parentName || undefined,
        parent_phone: parentPhone ? canonicalAzPhoneE164(parentPhone) || undefined : undefined,
        payment_terms_accepted: true,
        referral_source_id: referralSourceId || undefined,
        referral_notes: referralNotes.trim() || undefined,
      })
      toast(r?.message || 'Sorğunuz göndərildi', 'success')
      setSubmitted(true)
      await refreshEnrollments()
    } catch (err) {
      const msg =
        err?.code === 'INSTRUCTOR_STUDENT_LIMIT'
          ? err?.message || 'Bu müəllimin pulsuz tələbə limiti dolub.'
          : err?.message || 'Xəta'
      toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(initialCode ? `/join/${initialCode}` : '/student/groups')}`

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto w-full">
      <div className="mb-4">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-token-textMuted hover:text-token-textMain transition-colors"
        >
          ← Geri
        </Link>
      </div>

      <h1 className="font-display font-bold text-2xl text-token-textMain">Qrupa qoşul</h1>
      {initialCode && joinInfo ? (
        <p className="text-sm text-token-textMuted mt-1 mb-4">
          {joinInfo.group_name} · {joinInfo.instructor_name}
        </p>
      ) : (
        <p className="text-sm text-token-textMuted mt-1 mb-4">
          Müəllimin WhatsApp-dan göndərdiyi linkə toxunun — birbaşa bu səhifə açılır.
        </p>
      )}

      {infoLoading && <p className="text-sm text-token-textMuted mb-4">Qrup məlumatları yüklənir…</p>}

      {infoError && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-sm mb-4 space-y-3">
          <p className="text-red-200">{infoError}</p>
          <Button variant="secondary" size="sm" onClick={() => navigate(backHref)}>
            Geri qayıt
          </Button>
        </Card>
      )}

      {joinInfo && !submitted && <JoinGroupTermsOverview joinInfo={joinInfo} />}

      {submitted ? (
        <Card className="p-5 border border-emerald-500/25 bg-emerald-500/10">
          <p className="text-token-textMain font-semibold">Sorğunuz göndərildi</p>
          <p className="text-sm text-token-textMuted mt-2">
            Müəllim təsdiqlədikdən sonra qrupa əlavə olunacaqsınız. Bildiriş gözləyin.
          </p>
          <Button className="w-full justify-center mt-4" onClick={() => navigate('/student/groups')}>
            Qruplarıma get
          </Button>
        </Card>
      ) : initialCode && joinInfo && !infoError ? (
        <>
          {!user ? (
            <Card className="p-5 mb-4 border border-[color:var(--border-subtle)] space-y-4">
              <p className="text-sm text-token-textMuted">Qoşulma sorğusu göndərmək üçün Gmail ilə daxil olun.</p>
              <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
              <p className="text-center text-xs text-token-textMuted">
                və ya{' '}
                <a href={loginHref} className="text-primary font-semibold hover:underline">
                  email ilə daxil ol
                </a>
              </p>
            </Card>
          ) : (
            <p className="text-xs text-emerald-300/90 mb-3">
              Daxil: <span className="font-medium">{user.email || user.full_name}</span>
            </p>
          )}

          <Card className="p-5 border border-[color:var(--border-subtle)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-token-textMuted mb-3">
              Şəxsi məlumatlar
            </p>
            <form className="space-y-3" onSubmit={submitRequest}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-token-textMuted uppercase mb-1.5">Ad *</label>
                  <input className={inp} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-token-textMuted uppercase mb-1.5">Soyad *</label>
                  <input className={inp} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-token-textMuted uppercase mb-1.5">Telefon *</label>
                <PhoneInput value={phone} onChange={setPhone} required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-token-textMuted uppercase mb-1.5">
                  Valideyn adı (ixtiyari)
                </label>
                <input
                  className={inp}
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="Valideynin adı"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-token-textMuted uppercase mb-1.5">
                  Valideyn telefonu (ixtiyari)
                </label>
                <PhoneInput value={parentPhone} onChange={setParentPhone} />
              </div>
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Kim yönləndirdi?</p>
                {(joinInfo?.referral_sources || []).length > 0 ? (
                  <div>
                    <label className="block text-xs text-token-textMuted mb-1.5">Mənbə (ixtiyari)</label>
                    <select
                      className={inp}
                      value={referralSourceId}
                      onChange={(e) => setReferralSourceId(e.target.value)}
                    >
                      <option value="">— Seçin —</option>
                      {(joinInfo.referral_sources || []).map((rs) => (
                        <option key={rs.id} value={rs.id}>
                          {rs.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div>
                  <label className="block text-xs text-token-textMuted mb-1.5">
                    Ətraflı (məs. hansı müəllim tövsiyə etdi)
                  </label>
                  <input
                    className={inp}
                    value={referralNotes}
                    onChange={(e) => setReferralNotes(e.target.value)}
                    placeholder="Məs: Rəşad müəllim, Instagram, dost..."
                    maxLength={500}
                  />
                </div>
              </div>
              {joinInfo?.package_offer ? (
                <label className="flex items-start gap-3 text-sm cursor-pointer rounded-xl border border-white/10 p-3 bg-white/[0.03]">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-white/20"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                  />
                  <span className="text-token-textMuted leading-relaxed">
                    Paket qiyməti ({formatAzn(joinInfo.package_offer.final_price)}), ödəniş vaxtı (
                    <strong className="text-token-textMain">{joinInfo.package_offer.payment_timing_short}</strong>
                    ) və cədvəllə razıyam.
                  </span>
                </label>
              ) : null}
              <Button
                className="w-full justify-center"
                loading={busy}
                type="submit"
                disabled={!user || !joinInfo?.package_offer || !termsAccepted}
              >
                Qoşul
              </Button>
            </form>
          </Card>
        </>
      ) : null}
    </div>
  )
}
