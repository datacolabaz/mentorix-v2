import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'

function fmtDate(d) {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

export default function AssignmentAnalytics() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [analytics, setAnalytics] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get('/tasks/analytics')
      setAnalytics(d.analytics || null)
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const a = analytics

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl">Tapşırıq analitikası</h1>
          <p className="text-token-textMuted text-sm mt-1">Təslim nisbəti, orta bal və ən yaxşı tələbələr.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Yenilə
          </Button>
          <Link to="/instructor/tasks" className="text-sm text-primary hover:underline self-center">
            ← Tapşırıqlar
          </Link>
        </div>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">{err}</Card>
      )}

      {loading ? (
        <Card className="p-5 text-sm text-token-textMuted">Yüklənir…</Card>
      ) : !a ? (
        <Card className="p-5 text-sm text-token-textMuted">Məlumat yoxdur.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="p-4">
              <p className="text-xs text-token-textMuted">Təslim nisbəti</p>
              <p className="text-2xl font-bold mt-1">{a.submission_rate}%</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-token-textMuted">Orta bal</p>
              <p className="text-2xl font-bold mt-1">{a.average_score != null ? a.average_score : '—'}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-token-textMuted">Gecikmiş təslim</p>
              <p className="text-2xl font-bold mt-1 text-amber-300">{a.late_submissions}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-token-textMuted">Təslim / təyin</p>
              <p className="text-2xl font-bold mt-1">
                {a.total_submissions ?? 0} / {a.total_student_slots ?? 0}
              </p>
            </Card>
          </div>

          <Card className="p-4 mb-6">
            <h2 className="text-sm font-semibold text-token-textMain mb-3">Ən yüksək bal (top 5)</h2>
            {!a.top_students?.length ? (
              <p className="text-sm text-token-textMuted">Hələ qiymətləndirilmiş tapşırıq yoxdur.</p>
            ) : (
              <ul className="space-y-2">
                {a.top_students.map((s, i) => (
                  <li key={s.full_name + i} className="flex justify-between text-sm">
                    <span className="text-token-textMain">
                      {i + 1}. {s.full_name}
                    </span>
                    <span className="text-emerald-300 font-semibold tabular-nums">
                      {s.average_score != null ? s.average_score : '—'} ({s.reviewed_count} tap.)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4 overflow-x-auto">
            <h2 className="text-sm font-semibold text-token-textMain mb-3">Tapşırıqlar üzrə</h2>
            {!a.by_assignment?.length ? (
              <p className="text-sm text-token-textMuted">Tapşırıq yoxdur.</p>
            ) : (
              <table className="w-full text-sm text-left min-w-[520px]">
                <thead>
                  <tr className="text-token-textMuted text-xs border-b border-[color:var(--border-subtle)]">
                    <th className="py-2 pr-3">Başlıq</th>
                    <th className="py-2 pr-3">Qrup</th>
                    <th className="py-2 pr-3">Təyin</th>
                    <th className="py-2 pr-3">Təslim</th>
                    <th className="py-2 pr-3">Gözləyir</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2">Orta bal</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_assignment.map((row) => (
                    <tr key={row.id} className="border-b border-[color:var(--border-subtle)]/50">
                      <td className="py-2 pr-3 text-token-textMain max-w-[180px] truncate" title={row.title}>
                        {row.title}
                        <span className="block text-[10px] text-token-textMuted font-mono">{fmtDate(row.due_date)}</span>
                      </td>
                      <td className="py-2 pr-3 text-token-textMuted">{row.group_name || '—'}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.assigned_count}</td>
                      <td className="py-2 pr-3 tabular-nums text-blue-300">{row.submitted_count}</td>
                      <td className="py-2 pr-3 tabular-nums">{row.pending_count}</td>
                      <td className="py-2 pr-3 tabular-nums font-semibold">{row.submission_rate}%</td>
                      <td className="py-2 tabular-nums">{row.average_score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="text-xs text-token-textMuted mt-4">
            Gələcək AI modulları (avtomatik rəy, plagiat yoxlaması) bu analitika ilə inteqrasiya olunacaq.
          </p>
        </>
      )}
    </div>
  )
}
