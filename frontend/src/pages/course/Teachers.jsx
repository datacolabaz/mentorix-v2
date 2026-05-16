import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import ListSkeleton from '../../components/common/ListSkeleton'

export default function CourseTeachers() {
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get('/course/teachers')
      .then((res) => {
        if (cancelled) return
        setTeachers(Array.isArray(res.teachers) ? res.teachers : [])
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.response?.data?.message || err?.message || 'Siyahı yüklənmədi')
        setTeachers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-4xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">
          Müəllimlər
        </h1>
        <p className="text-token-textMuted text-sm mt-1 leading-relaxed">
          Kursa bağlı müəllim hesabları. Sizin mövcud müəllim profiliniz avtomatik əlaqələnir — ayrıca
          &quot;müəllim yaratmaq&quot; lazım deyil; tələbələriniz bu hesab üzərindən sayılır.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : teachers.length === 0 ? (
        <Card className="p-6 border border-white/10">
          <p className="text-sm text-token-textMuted">
            Hələ heç bir müəllim əlaqələnməyib. Əgər müəllim hesabınız varsa, Kurs panelinə yenidən daxil
            olun — avtomatik əlavə olunacaq.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {teachers.map((t) => (
            <li key={t.id}>
              <Card className="p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{t.full_name || '—'}</div>
                  {t.phone ? (
                    <div className="text-xs text-token-textMuted mt-0.5 tabular-nums">{t.phone}</div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {t.is_owner ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-200">
                      Siz · müəllim hesabı
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full border border-indigo-400/30 bg-indigo-500/10 text-indigo-200">
                      Əlavə müəllim
                    </span>
                  )}
                  <span className="text-xs text-token-textMuted tabular-nums">
                    {t.active_students ?? 0} tələbə
                  </span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="p-4 border border-indigo-500/20 bg-indigo-500/[0.04]">
        <p className="text-xs text-token-textMuted leading-relaxed">
          Tezliklə: başqa müəllimləri telefon/PIN ilə kursa dəvət etmək və onların tələbələrini birləşdirmək.
        </p>
      </Card>
    </div>
  )
}
