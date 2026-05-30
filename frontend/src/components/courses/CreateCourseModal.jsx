import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { WEEKDAYS } from '../../pages/instructor/Schedule'

const emptyForm = {
  name: '',
  monthly_fee: '',
  lesson_weekdays: [],
  lesson_times: {},
  student_ids: [],
}

export default function CreateCourseModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm)
  const [students, setStudents] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setForm(emptyForm)
    setError(null)
    api
      .get('/courses/assignable-students')
      .then((res) => setStudents(res.students || []))
      .catch(() => setStudents([]))
  }, [open])

  function toggleDay(v) {
    setForm((f) => {
      const set = new Set(f.lesson_weekdays)
      if (set.has(v)) set.delete(v)
      else set.add(v)
      return { ...f, lesson_weekdays: [...set].sort((a, b) => a - b) }
    })
  }

  function setTimeForDay(v, time) {
    setForm((f) => ({
      ...f,
      lesson_times: { ...f.lesson_times, [String(v)]: time },
    }))
  }

  function toggleStudent(id) {
    const key = String(id)
    setForm((f) => {
      const set = new Set(f.student_ids.map(String))
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return { ...f, student_ids: [...set] }
    })
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/courses', {
        name: form.name.trim(),
        monthly_fee: form.monthly_fee === '' ? null : Number(form.monthly_fee),
        lesson_weekdays: form.lesson_weekdays,
        lesson_times: form.lesson_times,
        student_ids: form.student_ids,
      })
      onCreated?.(res.course)
      onClose()
    } catch (err) {
      setError(err?.message || 'Kurs yaradılmadı')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Yeni fənn kartı" size="lg">
      <form onSubmit={submit} className="space-y-5">
        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-token-textMuted uppercase">Kurs adı</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Məs: Riyaziyyat 9-cu sinif"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-token-textMuted uppercase">Aylıq ödəniş (₼)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monthly_fee}
            onChange={(e) => setForm((f) => ({ ...f, monthly_fee: e.target.value }))}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="150"
          />
        </label>

        <div>
          <span className="text-xs font-semibold text-token-textMuted uppercase">Cədvəl — günlər</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {WEEKDAYS.map((d) => {
              const on = form.lesson_weekdays.includes(d.v)
              return (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleDay(d.v)}
                  className={[
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    on
                      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/10 bg-white/5 text-token-textMuted',
                  ].join(' ')}
                >
                  {d.short}
                </button>
              )
            })}
          </div>
        </div>

        {form.lesson_weekdays.length > 0 ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-token-textMuted uppercase">Saatlar</span>
            {form.lesson_weekdays.map((v) => {
              const d = WEEKDAYS.find((x) => x.v === v)
              return (
                <label key={v} className="flex items-center gap-3 text-sm">
                  <span className="w-12 text-token-textMuted">{d?.short}</span>
                  <input
                    type="time"
                    value={form.lesson_times[String(v)] || ''}
                    onChange={(e) => setTimeForDay(v, e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white"
                  />
                </label>
              )
            })}
          </div>
        ) : null}

        <div>
          <span className="text-xs font-semibold text-token-textMuted uppercase">Tələbələr</span>
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-xl border border-white/10 p-2">
            {students.length === 0 ? (
              <p className="text-xs text-token-textMuted p-2">Aktiv tələbə yoxdur</p>
            ) : (
              students.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.student_ids.map(String).includes(String(s.id))}
                    onChange={() => toggleStudent(s.id)}
                  />
                  <span className="text-white">{s.full_name}</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Ləğv
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Yaradılır…' : 'Fənn kartını yarat'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
