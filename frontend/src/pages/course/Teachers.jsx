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
        setError(err?.message || 'Siyahı yüklənmədi')
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
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Müəllimlər</h1>
        <p className="text-token-textMuted text-sm mt-1 leading-relaxed">
          Kurs heyəti — yalnız buraya <strong className="text-white/90">əlavə etdiyiniz</strong> müəllimlər. Fərdi
          müəllim profiliniz avtomatik buraya daxil edilmir.
        </p>
      </div>

      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      {loading ? (
        <ListSkeleton />
      ) : teachers.length === 0 ? (
        <Card className="p-6 border border-white/10">
          <p className="text-sm text-token-textMuted">
            Hələ kurs müəllimi yoxdur. Tezliklə: telefon/PIN ilə işə götürmə və payroll qaydaları.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {teachers.map((t) => (
            <li key={t.id}>
              <Card className="p-4 border border-white/10 flex justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{t.full_name}</div>
                  {t.phone ? <div className="text-xs text-token-textMuted mt-0.5">{t.phone}</div> : null}
                </div>
                <span className="text-xs text-token-textMuted tabular-nums">
                  {t.course_students_count ?? 0} kurs tələbəsi
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
