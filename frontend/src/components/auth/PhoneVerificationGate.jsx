import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Modal from '../common/Modal'
import Button from '../common/Button'
import PhoneInput from './PhoneInput'
import { useToast } from '../common/Toast'

const VERIFY_ROLES = new Set(['instructor', 'student', 'course'])

/**
 * Google hesabı: panel / sorğu / SMS ilk cəhdi — bir dəfə OTP telefon təsdiqi.
 */
export default function PhoneVerificationGate() {
  const toast = useToast()
  const { user, updateUser, setSession } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')

  const resetForm = useCallback(() => {
    setStep('phone')
    setCode('')
    setHint('')
  }, [])

  useEffect(() => {
    const onRequired = (ev) => {
      if (!VERIFY_ROLES.has(user?.role)) return
      if (user?.phone_verified) return
      setHint(ev?.detail?.message || '')
      resetForm()
      if (user?.phone) setPhone(user.phone)
      setOpen(true)
    }
    window.addEventListener('mx:phone-verification-required', onRequired)
    return () => window.removeEventListener('mx:phone-verification-required', onRequired)
  }, [user?.role, user?.phone_verified, user?.phone, resetForm])

  const sendOtp = async () => {
    setBusy(true)
    try {
      const r = await api.post('/auth/phone/send-otp', { phone })
      toast(r?.message || 'OTP göndərildi', 'success')
      setStep('otp')
    } catch (err) {
      toast(err?.message || 'OTP göndərilmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  const verifyOtp = async () => {
    setBusy(true)
    try {
      const r = await api.post('/auth/phone/verify-otp', { phone, code })
      const patched = {
        ...r.user,
        needs_phone_verification: false,
        needs_instructor_phone: false,
        phone_verified: true,
      }
      if (r?.token && r?.user) {
        setSession(r.token, patched)
      } else if (r?.user) {
        updateUser(patched)
      }
      toast(r?.merged ? 'Hesablar birləşdirildi' : 'Mobil nömrə təsdiqləndi', 'success')
      setOpen(false)
      resetForm()
    } catch (err) {
      toast(err?.message || 'Kod yanlışdır', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!VERIFY_ROLES.has(user?.role)) return null

  const roleHint =
    user?.role === 'instructor'
      ? 'SMS göndərmək və ya panel funksiyalarından istifadə üçün'
      : 'Sorğu göndərmək və ya profil əməliyyatları üçün'

  return (
    <Modal
      open={open}
      onClose={() => {}}
      title={step === 'phone' ? 'Mobil nömrə təsdiqi' : 'OTP kodu'}
      size="sm"
      zIndex={10300}
      footer={
        step === 'phone' ? (
          <Button type="button" className="w-full justify-center" loading={busy} onClick={() => void sendOtp()}>
            OTP göndər
          </Button>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <Button type="button" className="w-full justify-center" loading={busy} onClick={() => void verifyOtp()}>
              Təsdiqlə
            </Button>
            <button
              type="button"
              className="text-xs text-zinc-500 hover:text-white text-center"
              disabled={busy}
              onClick={() => setStep('phone')}
            >
              Nömrəni dəyiş
            </button>
          </div>
        )
      }
    >
      {hint ? (
        <p className="text-sm text-amber-200/90 mb-3 leading-relaxed">{hint}</p>
      ) : null}
      {step === 'phone' ? (
        <>
          <p className="text-sm text-zinc-300 leading-relaxed mb-4">
            {roleHint} mobil nömrənizi <strong className="text-white">bir dəfə</strong> OTP ilə təsdiqləyin. Nömrə
            Google hesabınıza bağlanır; eyni nömrə ilə ikinci hesab açıla bilməz.
          </p>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Mobil telefon *
          </label>
          <PhoneInput value={phone} onChange={setPhone} persistLoginDefaults={false} />
        </>
      ) : (
        <>
          <p className="text-sm text-zinc-300 mb-3">
            <strong className="text-white">{phone}</strong> nömrəsinə göndərilən 6 rəqəmli kodu daxil edin.
          </p>
          <input
            className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl font-bold tracking-[0.35em] outline-none focus:border-primary/40"
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
        </>
      )}
    </Modal>
  )
}
