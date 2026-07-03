import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import useAuthStore from '../../hooks/useAuth'
import api from '../../lib/api'
import { useToast } from '../common/Toast'
import GoogleSignInButton from '../auth/GoogleSignInButton'

const RETURN_KEY = 'mx_return_after_login'

export default function CertifiedExamAuthGate({ open, exam, onClose }) {
  const { user, setSession } = useAuthStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [authBusy, setAuthBusy] = useState(false)

  useEffect(() => {
    if (!open || !exam?.id) return
    try {
      sessionStorage.setItem(RETURN_KEY, `/exam/${encodeURIComponent(exam.id)}`)
    } catch {
      /* ignore */
    }
  }, [open, exam?.id])

  useEffect(() => {
    if (!open || !user?.role) return
    if (user.role === 'student') {
      onClose?.()
      navigate(`/exam/${encodeURIComponent(exam.id)}`, { replace: true })
    }
  }, [open, user, exam?.id, navigate, onClose])

  const handleGoogleCredential = useCallback(
    async (credential) => {
      setAuthBusy(true)
      try {
        let r = await api.post('/auth/google/login', { credential })
        if (r?.needs_role || r?.needs_phone_link) {
          r = await api.post('/auth/google/complete', { credential, role: 'student' })
        }
        if (r?.needs_phone_link) {
          toast('Bu Google hesabı başqa telefon hesabına bağlıdır.', 'error')
          return
        }
        if (!r?.token || !r?.user) {
          toast(r?.message || 'Google girişi tamamlanmadı', 'error')
          return
        }
        if (r.user.role && r.user.role !== 'student') {
          toast('Bu hesab tələbə deyil. Tələbə hesabı ilə daxil olun.', 'error')
          return
        }
        setSession(r.token, { ...r.user, needs_phone_verification: false })
        toast('Daxil oldunuz', 'success')
        onClose?.()
        navigate(`/exam/${encodeURIComponent(exam.id)}`, { replace: true })
      } catch (err) {
        toast(err?.message || 'Google girişi uğursuz', 'error')
      } finally {
        setAuthBusy(false)
      }
    },
    [exam?.id, navigate, onClose, setSession, toast],
  )

  if (!open || !exam) return null

  const loginHref = `/login?next=${encodeURIComponent(`/exam/${exam.id}`)}`
  const registerHref = `/register?next=${encodeURIComponent(`/exam/${exam.id}`)}`

  const node = (
    <div
      className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Qeydiyyat tələb olunur"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-indigo-500/25 bg-[#13112e] p-5 sm:p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-primary font-semibold">🎓 Sertifikatlı imtahan</p>
            <h2 className="text-lg font-semibold text-white mt-1">Sertifikatını qazanmağa bir addım qalıb</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-400 hover:text-white px-2 py-1 rounded-lg"
            aria-label="Bağla"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-white font-medium">{exam.title}</span> üçün qeydiyyatdan keç, imtahana başla —
          keçəndə sertifikatın avtomatik yaranacaq.
        </p>
        <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs text-gray-400 space-y-1">
          <p>
            {exam.question_count} sual · {exam.duration_minutes} dəq · Keçid {exam.pass_pct}%
          </p>
          <p>Müəllim: {exam.instructor_name}</p>
        </div>
        <div className="space-y-3">
          <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
          <Link
            to={registerHref}
            className="block w-full text-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-[#041018] hover:brightness-95"
          >
            Telefon / email ilə qeydiyyat
          </Link>
          <Link to={loginHref} className="block text-center text-sm text-primary hover:underline font-medium">
            Artıq hesabım var — daxil ol
          </Link>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(node, document.body) : node
}
