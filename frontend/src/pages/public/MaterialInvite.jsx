import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import PhoneInput from '../../components/auth/PhoneInput'
import { canonicalAzPhoneE164 } from '../../lib/azPhone'

const inp =
  'w-full border border-[color:var(--border-subtle)] rounded-xl px-4 py-3 text-token-textMain text-sm outline-none focus:border-primary/40 bg-token-surfaceCard/55'

function splitFullName(full) {
  const t = String(full || '').trim()
  if (!t) return { first_name: '', last_name: '' }
  const i = t.indexOf(' ')
  if (i < 0) return { first_name: t, last_name: '' }
  return { first_name: t.slice(0, i), last_name: t.slice(i + 1).trim() }
}

export default function MaterialInvite() {
  const { materialId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, setSession } = useAuthStore()
  const id = useMemo(() => String(materialId || '').trim(), [materialId])

  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fieldErrors, setFieldErrors] = useState(null)

  useEffect(() => {
    if (!id) {
      setInfoLoading(false)
      setInfoError('Material linki düzgün deyil')
      return
    }
    let cancelled = false
    ;(async () => {
      setInfoLoading(true)
      setInfoError('')
      try {
        const d = await api.get(`/public/material-invite/${encodeURIComponent(id)}`)
        if (!cancelled) setInfo(d)
      } catch (err) {
        if (!cancelled) setInfoError(err?.message || 'Material tapılmadı')
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
    if (!email && user.email) setEmail(user.email)
    if (!phone && user.phone) setPhone(user.phone)
  }, [user, firstName, lastName, email, phone])

  const collectMissing = useCallback(() => {
    const missing = []
    if (!String(firstName).trim()) missing.push('Ad')
    if (!String(lastName).trim()) missing.push('Soyad')
    if (!String(email).trim() || !String(email).includes('@')) missing.push('E-poçt')
    if (!canonicalAzPhoneE164(phone)) {
      missing.push('Mobil telefon (+994 və 9 rəqəm)')
    }
    return missing
  }, [firstName, lastName, email, phone])

  const finishJoin = useCallback(
    (payload) => {
      if (payload?.token && payload?.user) {
        setSession(payload.token, { ...payload.user, needs_phone_verification: false })
      }
      toast(payload?.message || 'Materiala daxil ola bilərsiniz', 'success')
      navigate('/student/materials', { replace: true })
    },
    [navigate, setSession, toast],
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
      const sub = await api.post(`/public/material-invite/${encodeURIComponent(id)}/join`, {
        first_name: String(firstName).trim(),
        last_name: String(lastName).trim(),
        email: String(email).trim(),
        phone: phoneCanon,
      })
      finishJoin(sub)
    } catch (err) {
      toast(err?.message || 'Qoşulma alınmadı', 'error')
    } finally {
      setJoinBusy(false)
    }
  }, [id, firstName, lastName, email, phone, collectMissing, finishJoin, toast])

  const material = info?.material

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 border border-white/10 bg-[#121212]/95 space-y-5">
        <div className="text-center space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Mentorix · Material</p>
          <h1 className="font-display font-bold text-xl">Tədris materialı</h1>
          {infoLoading ? (
            <p className="text-sm text-gray-400">Yüklənir…</p>
          ) : infoError ? (
            <p className="text-sm text-amber-300">{infoError}</p>
          ) : material ? (
            <p className="text-sm text-gray-400">
              <span className="text-white font-medium">{material.instructor_name}</span>
              {material.title ? (
                <>
                  {' · '}
                  <span className="text-white">{material.title}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        {!infoLoading && !infoError && material ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 text-center">
              Materiala baxmaq üçün qısa qeydiyyat keçin. Məlumatlarınız yalnız bu müəllimlə paylaşılır.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs text-gray-500">Ad</span>
                <input className={inp} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-gray-500">Soyad</span>
                <input className={inp} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">E-poçt</span>
              <input
                type="email"
                className={inp}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-gray-500">Mobil telefon</span>
              <PhoneInput value={phone} onChange={setPhone} />
            </label>
            {fieldErrors?.length ? (
              <p className="text-xs text-amber-300">Çatışmayan: {fieldErrors.join(', ')}</p>
            ) : null}
            <Button className="w-full" onClick={submitGuestJoin} loading={joinBusy}>
              Materiala bax
            </Button>
          </div>
        ) : null}

        <p className="text-center text-xs text-gray-500">
          Artıq hesabınız var?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Giriş
          </Link>
        </p>
      </Card>
    </div>
  )
}
