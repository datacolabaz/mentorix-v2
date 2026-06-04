import { useEffect, useState } from 'react'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Modal from '../common/Modal'
import Button from '../common/Button'
import PhoneInput from '../auth/PhoneInput'
import { useToast } from '../common/Toast'

/**
 * Müəllim Google ilə daxil olandan sonra mütləq unikal mobil nömrə (anti-fraud).
 */
export default function InstructorPhoneGate() {
  const toast = useToast()
  const { user, updateUser } = useAuthStore()
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user?.role !== 'instructor') {
      setOpen(false)
      return
    }
    const needs =
      user?.needs_instructor_phone === true ||
      !user?.phone ||
      !user?.phone_verified
    setOpen(needs)
    if (user?.phone && !phone) setPhone(user.phone)
  }, [user, phone])

  useEffect(() => {
    if (user?.role !== 'instructor' || !open) return
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.get('/auth/instructor/phone-status')
        if (!cancelled && d?.needs_instructor_phone) setOpen(true)
        if (!cancelled && !d?.needs_instructor_phone) setOpen(false)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user?.role, open])

  const submit = async () => {
    setBusy(true)
    try {
      const r = await api.post('/auth/instructor/bind-phone', { phone })
      if (r?.user) updateUser(r.user)
      toast(r?.message || 'Mobil nömrə qeydə alındı', 'success')
      setOpen(false)
    } catch (err) {
      toast(err?.message || 'Nömrə saxlanılmadı', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (user?.role !== 'instructor') return null

  return (
    <Modal
      open={open}
      onClose={() => {}}
      title="Mobil nömrənizi daxil edin"
      size="sm"
      zIndex={10300}
      footer={
        <Button type="button" className="w-full justify-center" loading={busy} onClick={() => void submit()}>
          Təsdiqlə və davam et
        </Button>
      }
    >
      <p className="text-sm text-zinc-300 leading-relaxed mb-4">
        Mentorix-də hər müəllim hesabı yalnız <strong className="text-white">bir unikal mobil nömrə</strong> ilə
        bağlana bilər. Bu, eyni şəxsin bir neçə Gmail ilə pulsuz limiti almasının qarşısını alır.
      </p>
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
        Mobil telefon *
      </label>
      <PhoneInput value={phone} onChange={setPhone} persistLoginDefaults={false} />
      <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
        Bu nömrə artıq başqa müəllim hesabında qeydiyyatdadırsa, sistem xəbərdarlıq edəcək — ikinci hesab açıla
        bilməz.
      </p>
    </Modal>
  )
}
