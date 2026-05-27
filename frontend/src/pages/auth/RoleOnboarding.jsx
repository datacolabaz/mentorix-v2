import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

const ROLE_CHOICES = [
  { key: 'instructor', label: 'Müəllim' },
  { key: 'student', label: 'Tələbə' },
  { key: 'course', label: 'Kurs' },
]

export default function RoleOnboarding() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user, token, setSession, logout } = useAuthStore()
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-surface-2 border border-white/10 rounded-2xl p-6 text-center">
          <div className="text-white font-display font-bold text-xl">Rol seçimi</div>
          <div className="mt-2 text-sm text-gray-400">Davam etmək üçün əvvəlcə daxil olun.</div>
          <Button className="w-full justify-center mt-4" onClick={() => navigate('/login')}>
            Login
          </Button>
        </div>
      </div>
    )
  }

  const submit = async () => {
    if (!picked) return toast('Rol seçin', 'error')
    setBusy(true)
    try {
      const r = await api.post('/auth/onboarding/role', { role: picked })
      if (!r?.token || !r?.user) throw new Error(r?.message || 'Server cavabı etibarsızdır')
      setSession(r.token, r.user)
      navigate(`/${r.user.role}`, { replace: true })
    } catch (e) {
      const msg = e?.message || e?.response?.data?.message || 'Rol seçimi alınmadı'
      toast(msg, 'error')
      // If backend rejected token (e.g. 401/403), clear session.
      const st = e?.status ?? e?.response?.status
      if (st === 401 || st === 403) {
        logout()
        navigate('/login', { replace: true })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface-2 border border-white/10 rounded-2xl p-6">
        <div className="text-white font-display font-bold text-xl text-center">Rol seçin</div>
        <div className="mt-2 text-sm text-gray-400 text-center">
          {user?.email ? (
            <>
              <span className="text-gray-200 font-semibold">{user.email}</span> üçün hansı panelə daxil olmaq istəyirsiniz?
            </>
          ) : (
            'Hansı panelə daxil olmaq istəyirsiniz?'
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3">
          {ROLE_CHOICES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setPicked(r.key)}
              className={[
                'w-full px-4 py-4 rounded-xl border text-left transition-colors',
                picked === r.key
                  ? 'border-primary/60 bg-primary/10 text-white'
                  : 'border-white/10 bg-surface-1 text-gray-200 hover:bg-white/5',
              ].join(' ')}
            >
              <div className="font-semibold">{r.label}</div>
              <div className="text-xs text-gray-400 mt-1">
                {r.key === 'instructor'
                  ? 'Müəllim paneli'
                  : r.key === 'student'
                    ? 'Tələbə paneli'
                    : 'Kurs paneli'}
              </div>
            </button>
          ))}
        </div>

        <Button className="w-full justify-center mt-5" loading={busy} onClick={submit}>
          Davam et
        </Button>
      </div>
    </div>
  )
}

