import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import useAuthStore from '../../hooks/useAuth'

export default function ParentDashboard() {
  const { user } = useAuthStore()
  const [children, setChildren] = useState([])
  const [hwSummary, setHwSummary] = useState(null)

  useEffect(() => {
    api.get('/students').then((d) => {
      const mine = (d.students || []).filter((s) => s.parent_id === user.id)
      setChildren(mine)
    })
    api
      .get('/tasks/parent')
      .then((d) => setHwSummary(d.summary || null))
      .catch(() => setHwSummary(null))
  }, [user.id])

  const BILLING = { '8_lessons': '8 Dərs', '12_lessons': '12 Dərs' }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl">Valideyn Portalı</h1>
          <p className="text-gray-400 text-sm mt-1">Uşaqlarınızın proqresi</p>
        </div>
        <Link
          to="/parent/assignments"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Ev tapşırıqları →
        </Link>
      </div>

      {hwSummary && hwSummary.assigned > 0 && (
        <Card className="p-4 mb-6 border border-indigo-500/20">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Ev tapşırıqları (ümumi)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
            <div>
              <div className="font-bold text-lg">{hwSummary.assigned}</div>
              <div className="text-gray-500 text-xs">Təyin</div>
            </div>
            <div>
              <div className="font-bold text-lg text-blue-400">{hwSummary.submitted}</div>
              <div className="text-gray-500 text-xs">Təslim</div>
            </div>
            <div>
              <div className="font-bold text-lg text-emerald-400">{hwSummary.reviewed}</div>
              <div className="text-gray-500 text-xs">Yoxlanılıb</div>
            </div>
            <div>
              <div className="font-bold text-lg text-amber-400">{hwSummary.overdue}</div>
              <div className="text-gray-500 text-xs">Gecikmiş</div>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {children.map(child => {
          const limit = child.billing_type === '8_lessons' ? 8 : child.billing_type === '12_lessons' ? 12 : null
          const isAlert = limit && child.lesson_count >= limit - 2
          return (
            <Card key={child.id} className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center text-xl font-bold">
                  {child.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <h2 className="font-display font-bold text-xl">{child.full_name}</h2>
                  <p className="text-gray-400 text-sm">{child.instructor_name} • {BILLING[child.billing_type]}</p>
                </div>
                {isAlert && (
                  <div className="ml-auto px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm font-semibold">
                    ⚠️ Ödəniş vaxtı!
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[#13112e] rounded-xl p-4 text-center">
                  <div className="font-display font-extrabold text-2xl text-blue-400">
                    {child.lesson_count}{limit ? `/${limit}` : ''}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Dərs</div>
                </div>
                <div className="bg-[#13112e] rounded-xl p-4 text-center">
                  <div className="font-display font-extrabold text-2xl text-emerald-400">
                    {child.avg_score || 0}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Orta Bal</div>
                </div>
                <div className="bg-[#13112e] rounded-xl p-4 text-center">
                  <div className="font-display font-extrabold text-2xl text-yellow-400">
                    {child.enrollment_status === 'active' ? '✓' : '—'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Status</div>
                </div>
              </div>

              {limit && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Proqres</span>
                    <span>{Math.round((child.lesson_count / limit) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-[#13112e] rounded-full">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, (child.lesson_count / limit) * 100)}%` }} />
                  </div>
                </div>
              )}
            </Card>
          )
        })}
        {!children.length && (
          <div className="text-center py-16 text-gray-500">Qeydiyyatlı uşaq tapılmadı</div>
        )}
      </div>
    </div>
  )
}
