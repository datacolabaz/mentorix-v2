import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import PhoneInput from '../../components/auth/PhoneInput'
import Button from '../../components/common/Button'
import Brand from '../../components/common/Brand'
import { useToast } from '../../components/common/Toast'

const ROLE_HINTS = {
  instructor:
    'Ödəniş xatırlatmaları və SMS bildirişləri üçün telefon təsdiqi lazımdır. Əvvəl mobil ilə qeydiyyatdan keçmisinizsə, eyni nömrəni daxil edin — hesablar birləşəcək.',
  student:
    'Ödəniş xatırlatmaları və qrup kodu SMS-ləri üçün telefon təsdiqi lazımdır. Müəllimin sizi əlavə etdiyi nömrəni daxil edin.',
  course: 'SMS bildirişləri və hesab təhlükəsizliyi üçün telefon təsdiqi lazımdır.',
}

export default function VerifyPhone() {
  const { user, confirmMyPhoneVerifyOtp, sendMyPhoneVerifyOtp } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [phone, setPhone] = useState(user?.phone || '')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('phone')
  const [busy, setBusy] = useState(false)
  const [willLink, setWillLink] = useState(false)

  useEffect(() => {
    setPhone(user?.phone || '')
  }, [user?.phone])

  const roleHint = useMemo(() => ROLE_HINTS[user?.role] || ROLE_HINTS.instructor, [user?.role])

  if (!user) return <Navigate to="/login" replace />
  if (!user.role) return <Navigate to="/onboarding/role" replace />
  if (user.phone_verified) return <Navigate to={`/${user.role}`} replace />

  const goDashboard = () => navigate(`/${user.role}`, { replace: true })

  const sendOtp = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await sendMyPhoneVerifyOtp(phone)
      setWillLink(Boolean(r?.will_link_existing))
      setStep('code')
      setCode('')
      toast(r?.will_link_existing ? 'OTP göndərildi — mövcud hesab tapıldı' : 'OTP göndərildi', 'success')
    } catch (err) {
      toast(err?.message || 'OTP göndərilmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmOtp = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const r = await confirmMyPhoneVerifyOtp(phone, code)
      if (r?.merged) {
        toast('Köhnə hesabınız Google ilə birləşdirildi', 'success')
      } else {
        toast('Telefon təsdiqləndi', 'success')
      }
      goDashboard()
    } catch (err) {
      toast(err?.message || 'Kod yanlışdır', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-1 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface-2 p-6 sm:p-8">
        <div className="flex justify-center mb-6">
          <Brand size="login" />
        </div>
        <h1 className="text-xl font-semibold text-white text-center">Telefon təsdiqi</h1>
        <p className="text-sm text-gray-400 text-center mt-2 leading-relaxed">{roleHint}</p>
        {willLink && step === 'code' ? (
          <p className="text-xs text-amber-200/90 text-center mt-3 leading-relaxed">
            Bu nömrə artıq sistemdə qeydiyyatdadır. OTP təsdiqindən sonra Google hesabınız həmin profilə bağlanacaq.
          </p>
        ) : null}

        {step === 'phone' ? (
          <form onSubmit={sendOtp} className="space-y-4 mt-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Mobil nömrə
              </label>
              <PhoneInput value={phone} onChange={setPhone} required />
            </div>
            <Button type="submit" loading={busy} className="w-full justify-center py-3">
              OTP göndər
            </Button>
          </form>
        ) : (
          <form onSubmit={confirmOtp} className="space-y-4 mt-6">
            <p className="text-xs text-gray-400 text-center">
              <strong className="text-gray-200">{phone}</strong> nömrəsinə gələn 6 rəqəmli kodu daxil edin.
            </p>
            <input
              className="w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-4 text-white text-2xl font-bold text-center tracking-widest outline-none focus:border-primary/40"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
            <Button type="submit" loading={busy} className="w-full justify-center py-3">
              Təsdiqlə və davam et
            </Button>
            <button
              type="button"
              disabled={busy}
              className="w-full text-center text-xs text-gray-500 hover:text-white disabled:opacity-50"
              onClick={async () => {
                setBusy(true)
                try {
                  await sendMyPhoneVerifyOtp(phone)
                  toast('OTP yenidən göndərildi', 'success')
                } catch (err) {
                  toast(err?.message || 'OTP göndərilmədi', 'error')
                } finally {
                  setBusy(false)
                }
              }}
            >
              OTP yenidən göndər
            </button>
            <button
              type="button"
              className="w-full text-center text-xs text-gray-500 hover:text-white"
              onClick={() => {
                setStep('phone')
                setCode('')
              }}
            >
              ← Nömrəni dəyiş
            </button>
          </form>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            className="w-full text-center text-xs text-gray-500 hover:text-white"
            onClick={goDashboard}
          >
            Panelə qayıt
          </button>
        </div>

        <p className="text-[11px] text-gray-500 text-center mt-4 leading-relaxed">
          Köhnə mobil hesabınız varsa eyni nömrəni daxil edin — məlumatlarınız birləşəcək. Giriş Gmail / email ilə qalır.
        </p>
      </div>
    </div>
  )
}
