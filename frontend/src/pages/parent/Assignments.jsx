import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { assignmentStatusClass, assignmentStatusLabel } from '../../lib/assignmentHelpers'
import { fmtAzBakuField } from '../../lib/azDatetime'

function fmtDate(d) {
  if (!d) return '—'
  return String(d).slice(0, 10)
}

function fmtDt(row, key) {
  if (!row?.[key]) return '—'
  return fmtAzBakuField(row, key) || '—'
}

export default function ParentAssignments() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [items, setItems] = useState([])
  const [children, setChildren] = useState([])
  const [summary, setSummary] = useState(null)
  const [childFilter, setChildFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const q = childFilter ? `?student_id=${encodeURIComponent(childFilter)}` : ''
      const d = await api.get('/tasks/parent' + q)
      setItems(Array.isArray(d.items) ? d.items : [])
      setChildren(Array.isArray(d.children) ? d.children : [])
      setSummary(d.summary || null)
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [childFilter])

  useEffect(() => {
    void load()
  }, [load])

  const grouped = useMemo(() => {
    const m = new Map()
    for (const it of items) {
      const key = it.student_id
      if (!m.has(key)) {
        m.set(key, { student_id: key, student_name: it.student_name, rows: [] })
      }
      m.get(key).rows.push(it)
    }
    return [...m.values()]
  }, [items])

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl">Ev tapşırıqları</h1>
          <p className="text-token-textMuted text-sm mt-1">Uşağınızın tapşırıq statusu, təslim və qiymətləri.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Yenilə
          </Button>
          <Link to="/parent" className="text-sm text-primary hover:underline self-center">
            ← Uşaqlarım
          </Link>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Card className="p-3 text-center">
            <p className="text-xs text-token-textMuted">Təyin olunub</p>
            <p className="text-lg font-bold mt-1">{summary.assigned}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-token-textMuted">Təslim</p>
            <p className="text-lg font-bold mt-1 text-blue-300">{summary.submitted}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-token-textMuted">Yoxlanılıb</p>
            <p className="text-lg font-bold mt-1 text-emerald-300">{summary.reviewed}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-token-textMuted">Gecikmiş</p>
            <p className="text-lg font-bold mt-1 text-amber-300">{summary.overdue}</p>
          </Card>
        </div>
      )}

      {children.length > 1 && (
        <div className="mb-4">
          <label className="block text-xs text-token-textMuted mb-1">Uşaq</label>
          <select
            className="w-full sm:w-64 bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
          >
            <option value="">Hamısı</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">{err}</Card>
      )}

      {loading ? (
        <Card className="p-5 text-sm text-token-textMuted">Yüklənir…</Card>
      ) : !grouped.length ? (
        <Card className="p-5 text-sm text-token-textMuted">Tapşırıq tapılmadı.</Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <div key={g.student_id}>
              <h2 className="font-semibold text-token-textMain mb-2">{g.student_name}</h2>
              <div className="space-y-3">
                {g.rows.map((it) => (
                  <Card key={it.student_assignment_id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-token-textMain break-words">{it.title}</p>
                        <p className="text-xs text-token-textMuted mt-1">
                          Müəllim: {it.instructor_name} · Son tarix: {fmtDate(it.due_date)}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${assignmentStatusClass(it.status, it.display_status)}`}
                      >
                        {assignmentStatusLabel(it.status, it.display_status)}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-token-textMuted">Təslim tarixi</dt>
                        <dd className="text-token-textMain font-mono">{fmtDt(it, 'submitted_at')}</dd>
                      </div>
                      <div>
                        <dt className="text-token-textMuted">Yoxlama tarixi</dt>
                        <dd className="text-token-textMain font-mono">{fmtDt(it, 'reviewed_at')}</dd>
                      </div>
                      {it.score != null && (
                        <div>
                          <dt className="text-token-textMuted">Bal</dt>
                          <dd className="text-emerald-300 font-semibold">
                            {it.score}
                            {it.max_score != null ? ` / ${it.max_score}` : ''}
                          </dd>
                        </div>
                      )}
                    </dl>
                    {it.feedback ? (
                      <div className="mt-3 text-sm rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-gray-200">
                        <span className="text-[10px] font-semibold uppercase text-emerald-300/90">Müəllim rəyi</span>
                        <p className="mt-1 whitespace-pre-wrap">{it.feedback}</p>
                      </div>
                    ) : null}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
