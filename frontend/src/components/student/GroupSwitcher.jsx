import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useStudentGroups } from '../../contexts/StudentGroupContext'

export default function GroupSwitcher({ className = '' }) {
  const { enrollments, activeEnrollmentId, activeEnrollment, setActiveEnrollmentId, loading } =
    useStudentGroups()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (loading && !enrollments.length) {
    return (
      <div className={`text-xs text-token-textMuted ${className}`}>Qruplar yüklənir...</div>
    )
  }

  if (!enrollments.length) {
    return (
      <Link
        to="/student/join"
        className={`inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline ${className}`}
      >
        + Qrupa qoşul
      </Link>
    )
  }

  const label = activeEnrollment?.group_name || activeEnrollment?.subject_name || 'Qrup seçin'
  const sub = activeEnrollment?.instructor_name

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          'flex items-center gap-2 min-w-0 max-w-full rounded-xl border px-3 py-2 text-left transition-colors',
          'border-[color:var(--border-subtle)] bg-token-surfaceCard/60 hover:border-primary/30',
        ].join(' ')}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: activeEnrollment?.color || '#3b82f6' }}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-token-textMain truncate">{label}</span>
          {sub && (
            <span className="block text-[11px] text-token-textMuted truncate">{sub}</span>
          )}
        </span>
        <span className="text-token-textMuted text-xs shrink-0">▼</span>
      </button>

      {open && (
        <div
          className={[
            'absolute left-0 right-0 sm:right-auto sm:min-w-[280px] z-50 mt-1 rounded-xl border shadow-xl overflow-hidden',
            'border-[color:var(--border-subtle)] bg-token-surfaceCard',
          ].join(' ')}
        >
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-token-textMuted font-semibold border-b border-[color:var(--border-subtle)]">
            Qruplarım
          </div>
          {enrollments.map((g) => {
            const active = String(g.enrollment_id) === String(activeEnrollmentId)
            return (
              <button
                key={g.enrollment_id}
                type="button"
                onClick={() => {
                  setActiveEnrollmentId(g.enrollment_id)
                  setOpen(false)
                }}
                className={[
                  'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
                  active ? 'bg-primary/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/5',
                ].join(' ')}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: g.color || '#3b82f6' }}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-token-textMain truncate">
                    {g.group_name || g.subject_name || 'Qrup'}
                  </span>
                  <span className="block text-xs text-token-textMuted truncate">
                    {g.instructor_name} • {g.subject_name}
                  </span>
                </span>
              </button>
            )
          })}
          <div className="border-t border-[color:var(--border-subtle)] p-2 flex gap-2">
            <Link
              to="/student/groups"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs font-semibold py-2 rounded-lg text-token-textMuted hover:text-token-textMain hover:bg-black/[0.04] dark:hover:bg-white/5"
            >
              Bütün qruplar
            </Link>
            <Link
              to="/student/join"
              onClick={() => setOpen(false)}
              className="flex-1 text-center text-xs font-semibold py-2 rounded-lg text-primary hover:bg-primary/10"
            >
              + Qoşul
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
