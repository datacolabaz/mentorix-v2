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
  const [panelStudentCount, setPanelStudentCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)

  function load() {
    setLoading(true)
    api
      .get('/courses')
      .then((res) => {
        setCourses(res.courses || [])
        setPanelStudentCount(Number(res.panel_enrollment_student_count ?? 0) || 0)
      })
      .catch(() => {
        setCourses([])
        setPanelStudentCount(0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const assignedToAnyCourse = courses.reduce((sum, c) => sum + (Number(c.student_count) || 0), 0)

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">
            Fənn kataloqu
          </h1>
          <p className="text-token-textMuted text-sm mt-2 max-w-2xl leading-relaxed">
            Bu bölmə <strong className="text-token-textMain">əlavə fənn kartları</strong> üçündür (məs. «Riyaziyyat»,
            «İngilis dili») — gəlir və ödənişləri fənn üzrə qruplaşdırmaq üçün. Əsas işiniz{' '}
            <Link to="/instructor/students" className="text-primary font-semibold hover:underline">
              Tələbələrim
            </Link>{' '}
            və{' '}
            <Link to="/instructor/teaching-groups" className="text-primary font-semibold hover:underline">
              Kurslar və qruplar
            </Link>{' '}
            (dəvət linki, paket) orada aparılır.
          </p>
          <p className="text-xs text-token-textMuted mt-2">
            Paneldə cəmi:{' '}
            <span className="text-token-textMain font-semibold tabular-nums">{panelStudentCount}</span> tələbə
            {assignedToAnyCourse > 0 ? (
              <>
                {' '}
                · fənn kataloqunda təyin olunub:{' '}
                <span className="text-token-textMain font-semibold tabular-nums">{assignedToAnyCourse}</span>
              </>
            ) : null}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>+ Yeni fənn kartı</Button>
      </div>

      <Card className="p-4 border border-amber-500/25 bg-amber-500/10 text-sm text-token-textMain leading-relaxed">
        <strong className="text-amber-200/95">Niyə kartda «0 tələbə» görünür?</strong> Kartdakı rəqəm yalnız həmin
        fənnə <em>əlavə etdiyiniz</em> tələbələri sayır. Tələbələrimdəki {panelStudentCount} nəfər avtomatik buraya
        düşmür — kurs yaradıb «Tələbə əlavə et» ilə seçməlisiniz (və ya kurs yaradarkən tələbə seçin).
      </Card>

      {loading ? (
        <ListSkeleton />
      ) : courses.length === 0 ? (
        <Card className="p-8 border border-white/10 text-center space-y-3">
          <p className="text-token-textMuted text-sm">
            Hələ fənn kartı yoxdur. Əsas tələbələriniz ({panelStudentCount} nəfər) artıq «Tələbələrim»dədir; bu
            kataloq istəyə bağlıdır.
          </p>
          <Button onClick={() => setCreateOpen(true)}>İlk fənn kartını yarat</Button>
          <p className="text-xs text-token-textMuted">
            Tədris Mərkəzi (çox müəllimli məktəb) ayrı hesab tipidir — <code className="text-primary/90">/course</code>
            , fərdi müəllim paneli deyil.
          </p>
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
                <p className="text-xs text-token-textMuted mt-1">Bu fənnə təyin olunmuş tələbələr</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-token-textMuted text-xs uppercase tracking-wide">Tələbə (bu fənn)</div>
                    <div className="font-semibold text-white tabular-nums">{c.student_count ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-token-textMuted text-xs uppercase tracking-wide">Aylıq</div>
                    <div className="font-semibold text-emerald-300/95 tabular-nums">
                      {c.monthly_fee != null ? formatAzn(c.monthly_fee) : '—'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-token-textMuted text-xs uppercase tracking-wide">Bu ay gəlir (bu fənn)</div>
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
