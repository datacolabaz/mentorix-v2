import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import { useStudentGroupsOptional } from '../../contexts/StudentGroupContext'

const inputClass =
  'w-full border border-[color:var(--border-subtle)] rounded-xl px-4 py-4 text-token-textMain text-lg outline-none focus:border-primary/40 text-center tracking-widest bg-token-surfaceCard/55'

export default function JoinClass() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const ctx = useStudentGroupsOptional()
  const enrollments = ctx?.enrollments ?? []
  const refreshEnrollments = ctx?.refreshEnrollments ?? (async () => [])
  const setActiveEnrollmentId = ctx?.setActiveEnrollmentId ?? (() => {})
  const params = useParams()
  const [searchParams] = useSearchParams()

  const initialCode = useMemo(() => {
    const c = String(params.code || searchParams.get('code') || '').trim()
    return c
  }, [params.code, searchParams])

  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e?.preventDefault?.()
    const v = String(code || '').trim().toUpperCase().replace(/\s+/g, '')
    if (!v) return toast('Kodu daxil edin', 'error')
    setBusy(true)
    try {
      const r = await api.post('/students/my/join', { code: v })
      toast(
        r?.message || 'Qrupa qoşuldunuz. Müəlliminiz qeydiyyatı tamamlayacaq.',
        'success',
      )
      if (r?.enrollment_id) setActiveEnrollmentId(r.enrollment_id)
      await refreshEnrollments()
      navigate('/student/groups', { replace: true })
    } catch (err) {
      const st = err?.status ?? err?.response?.status
      const msg = err?.response?.data?.message || err?.message || 'Xəta baş verdi'
      if (st === 401 || st === 403) {
        toast('Daxil olun', 'error')
        navigate('/login', { replace: true })
        return
      }
      toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <p className="text-token-textMuted text-sm">Davam etmək üçün daxil olun.</p>
        <Button className="mt-4 justify-center w-full" onClick={() => navigate('/login')}>
          Login
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto w-full">
      <h1 className="font-display font-bold text-2xl text-token-textMain pl-14 sm:pl-0">Qrupa qoşul</h1>
      <p className="text-sm text-token-textMuted mt-1 mb-6 pl-14 sm:pl-0">
        Müəllimin verdiyi join kodunu daxil edin. Bir neçə qrupa qoşula bilərsiniz.
      </p>

      {enrollments.length > 0 && (
        <Card className="p-4 mb-4 border border-[color:var(--border-subtle)]">
          <div className="text-xs font-semibold uppercase tracking-wider text-token-textMuted mb-3">
            Mövcud qruplarınız ({enrollments.length})
          </div>
          <ul className="space-y-2">
            {enrollments.map((g) => (
              <li
                key={g.enrollment_id}
                className="flex items-center gap-3 p-2 rounded-lg bg-black/[0.03] dark:bg-white/5"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: g.color }}
                />
                <span className="text-sm text-token-textMain min-w-0 truncate">
                  <strong>{g.group_name}</strong>
                  <span className="text-token-textMuted"> — {g.instructor_name}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5 border border-[color:var(--border-subtle)]">
        <form className="space-y-3" onSubmit={submit}>
          <input
            className={inputClass}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MX-97762"
            autoCapitalize="characters"
          />
          <Button className="w-full justify-center" loading={busy} type="submit">
            Qoşul
          </Button>
        </form>
      </Card>
    </div>
  )
}
