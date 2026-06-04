import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import { postAuthNavigate, userNeedsPhoneVerificationPage } from '../../lib/postAuth'
import Brand from '../../components/common/Brand'
import Button from '../../components/common/Button'
import PhoneInput from '../../components/auth/PhoneInput'
import { useToast } from '../../components/common/Toast'

/**
 * Google Login → Phone Verification (OTP) → Dashboard
 */
export default function VerifyPhone() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user, setSession, logout } = useAuthStore()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState(user?.phone || '')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    if (user.role !== 'instructor') {
      postAuthNavigate(user, navigate)
      return
    }
    void (async () => {
      try {
        const data = await api.get('/auth/me')
        if (data?.user) {
          setSession(localStorage.getItem('mx_token'), data.user)
          if (!userNeedsPhoneVerificationPage(data.user)) {
            postAuthNavigate(data.user, navigate)
          }
        }
      } catch {
        /* ignore */
      }
    })()
  }, [user, navigate, setSession])

  const sendOtp = async () => {
    setBusy(true)
    try {
      const r = await api.post('/auth/phone/send-otp', { phone })
      toast(r?.message || 'OTP göndərildi', 'success')
      setStep('otp')
    } catch (err) {
      if (err?.code === 'PHONE_ALREADY_VERIFIED') {
        try {
          const data = await api.get('/auth/me')
          if (data?.user) {
            setSession(localStorage.getItem('mx_token'), data.user)
            postAuthNavigate(data.user, navigate)
            return
          }
        } catch {
          /* fall through */
        }
      }
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
      }
      toast(r?.merged ? 'Hesablar birləşdirildi' : 'Mobil nömrə təsdiqləndi', 'success')
      postAuthNavigate(patched, navigate)
    } catch (err) {
      toast(err?.message || 'Kod yanlışdır', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#041018] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Brand />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-display font-bold text-white">Mobil nömrə təsdiqi</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Google hesabınız təsdiqləndi. Müəllim panelinə keçmək üçün mobil nömrənizi bir dəfə OTP ilə təsdiqləyin.
            </p>
          </div>

          {step === 'phone' ? (
            <>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Mobil telefon *
              </label>
              <PhoneInput value={phone} onChange={setPhone} persistLoginDefaults={false} />
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Bu mobil nömrə başqa müəllim hesabında qeydiyyatdadırsa, sistem xəbərdarlıq edəcək. Təsdiqdən sonra
                yenidən soruşulmayacaq.
              </p>
              <Button type="button" className="w-full justify-center" loading={busy} onClick={() => void sendOtp()}>
                OTP göndər
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-300 text-center">
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
              <Button type="button" className="w-full justify-center" loading={busy} onClick={() => void verifyOtp()}>
                Təsdiqlə və davam et
              </Button>
              <button
                type="button"
                className="w-full text-xs text-zinc-500 hover:text-white"
                disabled={busy}
                onClick={() => setStep('phone')}
              >
                Nömrəni dəyiş
              </button>
            </>
          )}

          <button
            type="button"
            className="w-full text-xs text-zinc-500 hover:text-white text-center pt-2"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            Başqa hesabla daxil ol
          </button>
        </div>
      </div>
    </div>
  )
}
