import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { fmtAzBakuYmdHm } from '../../lib/azDatetime'

/** Parent: own children's exam and assignment results only (API scopes by the parent link). */
export default function ParentResults() {
  const [children, setChildren] = useState([])
  const [childId, setChildId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.get('/parent/children')
        if (cancelled) return
        const list = Array.isArray(d?.children) ? d.children : []
        setChildren(list)
        setChildId((prev) => prev || list[0]?.id || '')
        if (!list.length) setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Yüklənmədi')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    if (!childId) return
    setLoading(true)
    setError('')
    try {
      setData(await api.get(`/parent/children/${encodeURIComponent(childId)}/results`))
    } catch (e) {
      setError(e?.message || 'Nəticələr yüklənmədi')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [childId])

  useEffect(() => {
    void load()
  }, [load])

  const exams = data?.exams || []
  const assignments = data?.assignments || []

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl">Nəticələr</h1>
          <p className="text-token-textMuted text-sm mt-1">
            Yalnız sizin hesabınıza bağlı övladınızın imtahan və tapşırıq nəticələri. Müəllim nəticəni açana qədər bal gizli qalır.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {children.length > 1 ? (
            <select
              aria-label="Övlad"
              className="rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          ) : null}
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading || !childId}>
            Yenilə
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {!loading && !children.length && !error ? (
        <Card className="p-6 text-sm text-token-textMuted text-center">
          Hesabınıza bağlı övlad yoxdur. Müəllimdən sizi övladınızın profilinə valideyn kimi əlavə etməsini xahiş edin.
        </Card>
      ) : null}

      {children.length ? (
        <>
          <Card className="p-0 overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 font-semibold">İmtahanlar</h2>
            {loading ? (
              <div className="p-4 h-16 animate-pulse bg-black/5 dark:bg-white/5" role="status" />
            ) : exams.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-token-textMuted">Hələ təhvil verilmiş imtahan yoxdur.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--border-subtle)]">
                {exams.map((e) => (
                  <li key={e.exam_id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.title}</p>
                      <p className="text-xs text-token-textMuted">
                        {e.instructor_name || '—'} · {fmtAzBakuYmdHm(e.submitted_at)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {e.released && e.score != null
                        ? `${e.score}`
                        : e.release_at
                          ? `Açılacaq: ${fmtAzBakuYmdHm(e.release_at)}`
                          : 'Yoxlanılır'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-0 overflow-hidden">
            <h2 className="px-4 pt-4 pb-2 font-semibold">Tapşırıqlar</h2>
            {loading ? (
              <div className="p-4 h-16 animate-pulse bg-black/5 dark:bg-white/5" role="status" />
            ) : assignments.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-token-textMuted">Tapşırıq yoxdur.</p>
            ) : (
              <ul className="divide-y divide-[color:var(--border-subtle)]">
                {assignments.map((a) => (
                  <li key={a.assignment_id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.title}</p>
                      <p className="text-xs text-token-textMuted">
                        {a.instructor_name || '—'}
                        {a.submitted_at ? ` · təhvil: ${fmtAzBakuYmdHm(a.submitted_at)}` : ' · təhvil verilməyib'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {a.score != null ? `${a.score}${a.max_score != null ? ` / ${a.max_score}` : ''}` : a.reviewed_at ? '—' : 'Gözləyir'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  )
}
