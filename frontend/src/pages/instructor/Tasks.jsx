import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'

function fmtDue(d) {
  if (!d) return ''
  return String(d).slice(0, 10)
}

export default function InstructorTasks() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [err, setErr] = useState(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get('/tasks')
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

  const stats = useMemo(() => {
    const total = tasks.reduce((s, t) => s + (t.assigned_count || 0), 0)
    const done = tasks.reduce((s, t) => s + (t.done_count || 0), 0)
    return { total, done }
  }, [tasks])

  const submit = async () => {
    const title = String(form.title || '').trim()
    if (!title) {
      toast('Başlıq tələb olunur', 'error')
      return
    }
    setSaving(true)
    try {
      const d = await api.post('/tasks', {
        title,
        description: form.description,
        due_date: form.due_date || null,
      })
      toast(`Tapşırıq əlavə olundu (${d.assignedCount || 0} tələbəyə)`, 'success')
      setOpen(false)
      setForm({ title: '', description: '', due_date: '' })
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Tapşırıqlar</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tapşırıq əlavə etdikdə bütün aktiv tələbələrinizin profilində görünəcək.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Yenilə
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            + Tapşırıq əlavə et
          </Button>
        </div>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">
          {err}
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Card className="p-4">
          <p className="text-xs text-gray-500">Tapşırıqlar</p>
          <p className="text-lg font-bold text-white mt-1">{tasks.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Təyinatlar (cəmi)</p>
          <p className="text-lg font-bold text-white mt-1">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">Tamamlanan</p>
          <p className="text-lg font-bold text-white mt-1">{stats.done}</p>
        </Card>
      </div>

      {loading ? (
        <Card className="p-5 text-sm text-gray-500">Yüklənir…</Card>
      ) : tasks.length === 0 ? (
        <Card className="p-5 text-sm text-gray-500">Hələ tapşırıq yoxdur.</Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold break-words">{t.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {t.due_date ? (
                      <>
                        Son tarix: <span className="text-gray-300 font-mono">{fmtDue(t.due_date)}</span> ·{' '}
                      </>
                    ) : null}
                    {t.assigned_count || 0} tələbəyə · {t.done_count || 0} tamamlandı
                  </p>
                </div>
              </div>
              {t.description ? (
                <div className="mt-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {t.description}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => (saving ? null : setOpen(false))} title="Tapşırıq əlavə et">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Başlıq *</label>
            <input
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Məsələn: Dairə - 20 məsələ"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mətn</label>
            <textarea
              rows={5}
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500 resize-none"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Tapşırığın izahı…"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Son tarix (opsional)</label>
            <input
              type="date"
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Ləğv et
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              Yadda saxla
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

