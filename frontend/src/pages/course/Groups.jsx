import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'

const emptyForm = { name: '', instructor_user_id: '' }

export default function CourseGroups() {
  const toast = useToast()
  const [groups, setGroups] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    return Promise.all([api.get('/course/groups'), api.get('/course/teachers')])
      .then(([gRes, tRes]) => {
        setGroups(Array.isArray(gRes.groups) ? gRes.groups : [])
        setTeachers(Array.isArray(tRes.teachers) ? tRes.teachers : [])
      })
      .catch((err) => {
        setError(err?.message || 'Yüklənmədi')
        setGroups([])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function createGroup(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (!name) {
      toast('Qrup adını daxil edin', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/groups', {
        name,
        instructor_user_id: form.instructor_user_id || null,
      })
      toast('Qrup yaradıldı')
      setModalOpen(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast(err?.message || 'Yaradılmadı', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Qruplar / Siniflər</h1>
          <p className="text-token-textMuted text-sm mt-1 max-w-xl leading-relaxed">
            Kurs üzrə sinif və qruplar. Müəllim təyin edə bilərsiniz — əvvəlcə{' '}
            <strong className="text-white/90">Müəllimlər</strong> bölməsində heyətə əlavə edin.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Qrup yarat</Button>
      </div>

      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      {loading ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <Card className="p-6 border border-white/10">
          <p className="text-sm text-token-textMuted">
            Hələ qrup yoxdur. Məsələn: &quot;İnformatika — A1&quot; adı ilə yeni qrup yaradın.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Card className="p-4 border border-white/10 flex flex-wrap justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">{g.name}</div>
                  <div className="text-xs text-token-textMuted mt-0.5">
                    Müəllim: {g.instructor_name || 'təyin edilməyib'}
                  </div>
                </div>
                <span className="text-xs text-token-textMuted tabular-nums shrink-0">
                  {g.member_count ?? 0} tələbə
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => !busy && setModalOpen(false)} title="Yeni qrup" size="md">
        <form onSubmit={(e) => void createGroup(e)} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs text-token-textMuted uppercase">Qrup adı *</span>
            <input
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="İnformatika — Qrup A1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-token-textMuted uppercase">Müəllim (istəyə bağlı)</span>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.instructor_user_id}
              onChange={(e) => setForm((f) => ({ ...f, instructor_user_id: e.target.value }))}
            >
              <option value="">— Seçilməyib —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
            {teachers.length === 0 ? (
              <p className="text-xs text-amber-300/90 mt-1">Əvvəlcə Müəllimlər bölməsindən heyətə müəllim əlavə edin.</p>
            ) : null}
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setModalOpen(false)}>
              Ləğv
            </Button>
            <Button type="submit" loading={busy}>
              Saxla
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
