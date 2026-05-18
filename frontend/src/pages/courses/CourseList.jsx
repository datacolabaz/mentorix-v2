import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import CreateCourseModal from '../../components/courses/CreateCourseModal'

function formatAzn(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '0 ₼'
  return `${v.toLocaleString('az-AZ', { maximumFractionDigits: 0 })} ₼`
}

export default function CourseList() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  function load() {
    setLoading(true)
    api
      .get('/courses')
      .then((res) => setCourses(res.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">
            Kurslar
          </h1>
          <p className="text-token-textMuted text-sm mt-1 max-w-xl leading-relaxed">
            Fənn/kurs kataloqu — istəsəniz burada ayrı kurslar yaradın. Mövcud 28 tələbəniz{' '}
            <strong className="text-white/85">Müəllim → Tələbələr</strong> bölməsində qalır; Tədris Mərkəzi (
            <strong className="text-white/85">/course</strong>) isə ayrı paneldir.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Yeni kurs</Button>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : courses.length === 0 ? (
        <Card className="p-8 border border-white/10 text-center">
          <p className="text-token-textMuted text-sm mb-4">Hələ kurs yoxdur. İlk kursunuzu yaradın.</p>
          <Button onClick={() => setCreateOpen(true)}>Kurs yarat</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((c) => (
            <Link key={c.id} to={`/courses/${c.id}`} className="block group">
              <Card
                hover
                className="p-5 border border-white/10 group-hover:border-emerald-400/35 h-full transition-colors"
              >
                <h2 className="font-display font-bold text-lg text-white group-hover:text-emerald-200 transition-colors">
                  {c.name}
                </h2>
                <p className="text-xs text-token-textMuted mt-1">{c.instructor_name || 'Müəllim'}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-token-textMuted text-xs uppercase tracking-wide">Tələbə</div>
                    <div className="font-semibold text-white tabular-nums">{c.student_count ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-token-textMuted text-xs uppercase tracking-wide">Aylıq</div>
                    <div className="font-semibold text-emerald-300/95 tabular-nums">
                      {c.monthly_fee != null ? formatAzn(c.monthly_fee) : '—'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-token-textMuted text-xs uppercase tracking-wide">Bu ay gəlir</div>
                    <div className="font-semibold text-white tabular-nums">
                      {formatAzn(c.income_this_month)}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateCourseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => load()}
      />
    </div>
  )
}
