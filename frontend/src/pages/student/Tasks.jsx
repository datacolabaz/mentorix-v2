import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function fmtDue(d) {
  if (!d) return ''
  const s = String(d).slice(0, 10)
  return s
}

export default function StudentTasks() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [err, setErr] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get('/tasks/my')
      setTasks(Array.isArray(d.tasks) ? d.tasks : [])
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markDone = async (assignmentId) => {
    setBusyId(assignmentId)
    try {
      await api.patch('/tasks/assignments/' + encodeURIComponent(assignmentId) + '/done', {})
      toast('Tapşırıq tamamlandı', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Tapşırıqlar</h1>
          <p className="text-gray-500 text-sm mt-1">Müəllimin göndərdiyi tapşırıqlar.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          Yenilə
        </Button>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">
          {err}
        </Card>
      )}

      {loading ? (
        <Card className="p-5 text-sm text-gray-500">Yüklənir…</Card>
      ) : tasks.length === 0 ? (
        <Card className="p-5 text-sm text-gray-500">Hələ tapşırıq yoxdur.</Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const done = t.status === 'done'
            return (
              <Card key={t.assignment_id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold break-words">{t.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Müəllim: <span className="text-gray-300">{t.instructor_name}</span>
                      {t.due_date ? (
                        <>
                          {' '}
                          · Son tarix: <span className="text-gray-300 font-mono">{fmtDue(t.due_date)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={[
                        'text-xs font-bold px-2.5 py-1 rounded-lg border',
                        done
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                          : 'bg-indigo-500/15 border-indigo-400/35 text-indigo-200',
                      ].join(' ')}
                    >
                      {done ? 'Tamamlandı' : 'Gözləyir'}
                    </span>
                    {!done && (
                      <Button
                        size="sm"
                        onClick={() => void markDone(t.assignment_id)}
                        loading={busyId === t.assignment_id}
                      >
                        Tamamla
                      </Button>
                    )}
                  </div>
                </div>
                {t.description ? (
                  <div className="mt-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {t.description}
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

