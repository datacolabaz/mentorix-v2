import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import PresenceDot from '../../components/common/PresenceDot'

const inputClass =
  'w-full border border-[color:var(--border-subtle)] rounded-xl px-4 py-2.5 text-token-textMain text-sm outline-none focus:border-primary/40 bg-token-surfaceCard/60'

export default function AdminStudents() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const toast = useToast()

  const filters = {
    q: searchParams.get('q') || '',
    instructor: searchParams.get('instructor') || '',
    className: searchParams.get('class') || '',
    status: searchParams.get('status') || '',
    unassigned: searchParams.get('unassigned') || '',
  }

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (!value) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.q) params.set('q', filters.q)
      if (filters.instructor) params.set('instructor', filters.instructor)
      if (filters.className) params.set('class', filters.className)
      if (filters.status) params.set('status', filters.status)
      if (filters.unassigned) params.set('unassigned', filters.unassigned)
      const qs = params.toString()
      const d = await api.get(`/admin/students${qs ? `?${qs}` : ''}`)
      setStudents(d.students || [])
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally {
      setLoading(false)
    }
  }, [filters.q, filters.instructor, filters.className, filters.status, filters.unassigned, toast])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (id) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const d = await api.get(`/admin/students/${id}`)
      setDetail(d)
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleStudent = async (student) => {
    try {
      await api.patch(`/admin/students/${student.id}/toggle`, {
        is_active: !student.is_active,
      })
      toast(student.is_active ? 'Deaktiv edildi' : 'Aktiv edildi')
      load()
      if (detail?.student?.id === student.id) {
        openDetail(student.id)
      }
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    }
  }

  const deleteStudent = async (student) => {
    if (!student?.id) return
    const name = student.full_name || 'Tələbə'
    if (!window.confirm(`${name} silinsin? Bu əməliyyat geri qaytarılmır.`)) return
    setDeleteBusy(true)
    try {
      await api.delete(`/admin/students/${student.id}`)
      toast('Silindi')
      setDetailOpen(false)
      setDetail(null)
      load()
    } catch (err) {
      toast(err.message || 'Xəta', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const unassignedCount = students.filter((s) => s.is_unassigned).length

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-token-textMain">Tələbələr</h1>
          <p className="text-token-textMuted text-sm mt-1">
            Qeydiyyatdan keçən bütün tələbələr • müəllim və qrup bağlantısı
          </p>
        </div>
        <Button
          variant={filters.unassigned === 'true' ? 'primary' : 'secondary'}
          onClick={() =>
            setFilter('unassigned', filters.unassigned === 'true' ? '' : 'true')
          }
        >
          Təyin olunmamış
          {filters.unassigned !== 'true' && unassignedCount > 0 ? ` (${unassignedCount})` : ''}
        </Button>
      </div>

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className={inputClass}
            placeholder="Ad, email, telefon..."
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Müəllim"
            value={filters.instructor}
            onChange={(e) => setFilter('instructor', e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Qrup / kurs"
            value={filters.className}
            onChange={(e) => setFilter('class', e.target.value)}
          />
          <select
            className={inputClass}
            value={filters.status}
            onChange={(e) => setFilter('status', e.target.value)}
          >
            <option value="">Bütün statuslar</option>
            <option value="active">Aktiv hesab</option>
            <option value="inactive">Deaktiv hesab</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" variant="ghost" onClick={() => setSearchParams({}, { replace: true })}>
            Filtrləri təmizlə
          </Button>
          {filters.unassigned === 'true' && (
            <span className="text-xs text-amber-700 dark:text-amber-400 self-center px-2">
              Yalnız müəllimə/qrupla bağlanmamış tələbələr
            </span>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm text-token-textMain">
          <thead>
            <tr className="border-b border-[color:var(--border-subtle)] text-token-textMuted text-xs uppercase">
              {['Ad', 'Telefon', 'Müəllim', 'Qrup', 'Status', 'Əməliyyat'].map((h) => (
                <th key={h} className="py-3 px-4 text-left font-semibold tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr
                key={s.id}
                className={`border-b border-[color:var(--border-subtle)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                  s.is_unassigned ? 'bg-amber-500/10' : ''
                }`}
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-token-textMain flex items-center gap-2">
                    <PresenceDot user={s} />
                    {s.full_name}
                  </div>
                  <div className="text-xs text-token-textMuted">{s.email || '—'}</div>
                  {s.is_unassigned && (
                    <span className="inline-block mt-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold">
                      Təyin olunmamış
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-token-textMuted text-xs">{s.phone || '—'}</td>
                <td className="py-3 px-4 text-token-textMain">{s.instructor_name || '—'}</td>
                <td className="py-3 px-4 text-token-textMain">{s.group_name || '—'}</td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                      s.is_active
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {s.is_active ? 'Aktiv' : 'Deaktiv'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openDetail(s.id)}>
                      Profil
                    </Button>
                    <Button
                      size="sm"
                      variant={s.is_active ? 'danger' : 'ghost'}
                      onClick={() => toggleStudent(s)}
                    >
                      {s.is_active ? 'Deaktiv' : 'Aktiv'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deleteBusy}
                      onClick={() => deleteStudent(s)}
                    >
                      Sil
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="text-center py-8 text-token-textMuted">Yüklənir...</div>}
        {!loading && !students.length && (
          <div className="text-center py-12 text-token-textMuted">Tələbə tapılmadı</div>
        )}
      </Card>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail?.student?.full_name || 'Tələbə profili'}
      >
        {detailLoading && <div className="text-token-textMuted text-sm py-6 text-center">Yüklənir...</div>}
        {!detailLoading && detail?.student && (
          <div className="space-y-4 text-sm text-token-textMain">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-token-textMuted uppercase">Telefon</div>
                <div className="text-token-textMain">{detail.student.phone || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-token-textMuted uppercase">Email</div>
                <div className="text-token-textMain">{detail.student.email || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-token-textMuted uppercase">Qeydiyyat</div>
                <div className="text-token-textMain">
                  {detail.student.created_at
                    ? new Date(detail.student.created_at).toLocaleString('az-AZ')
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-token-textMuted uppercase">Email təsdiqi</div>
                <div className="text-token-textMain">{detail.student.is_verified ? 'Bəli' : 'Xeyr'}</div>
              </div>
            </div>

            {detail.is_unassigned ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2 text-sm">
                <p>Bu tələbə yalnız Google/email ilə qeydiyyatdan keçib — heç bir müəllimə/qrupla bağlı deyil.</p>
                <p className="text-amber-800/90 dark:text-amber-100/80 text-xs">
                  Müəllim onu görmür. Həll: tələbə qrup dəvət linkində formu tamamlasın və ya imtahan linkində «Sorğu
                  göndər» etsin; müəllim də «Tələbələrim» → email ilə əlavə edə bilər.
                </p>
              </div>
            ) : detail.link ? (
              <div className="p-3 rounded-xl bg-primary/5 border border-[color:var(--border-subtle)] space-y-2">
                <div className="text-xs text-token-textMuted uppercase">
                  {String(detail.link.status || '').toLowerCase() === 'active'
                    ? 'Aktiv bağlantı'
                    : 'Gözləyən bağlantı'}
                </div>
                <div>
                  <span className="text-token-textMuted">Müəllim: </span>
                  <span className="text-token-textMain font-medium">{detail.link.instructor_name}</span>
                </div>
                <div>
                  <span className="text-token-textMuted">Qrup: </span>
                  <span className="text-token-textMain font-medium">{detail.link.group_name || '—'}</span>
                </div>
                {detail.link.join_code && (
                  <div>
                    <span className="text-token-textMuted">Join kod: </span>
                    <span className="text-primary font-mono">{detail.link.join_code}</span>
                  </div>
                )}
                {detail.link.status &&
                String(detail.link.status).toLowerCase() !== 'active' ? (
                  <div className="text-xs text-amber-700 dark:text-amber-200/90">
                    Status: {detail.link.status} — müəllim quraşdırmanı tamamlamalıdır.
                  </div>
                ) : null}
              </div>
            ) : null}

            {detail.enrollments?.length > 0 && (
              <div>
                <div className="text-xs text-token-textMuted uppercase mb-2">Qeydiyyat tarixçəsi</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {detail.enrollments.map((e) => (
                    <div
                      key={e.id}
                      className="p-2 rounded-lg bg-token-surfaceCard/60 border border-[color:var(--border-subtle)] text-xs"
                    >
                      <div className="text-token-textMain">{e.instructor_name || '—'} → {e.group_name || 'Qrupsuz'}</div>
                      <div className="text-token-textMuted mt-0.5">
                        {e.status}
                        {e.enrollment_start_date
                          ? ` • ${new Date(e.enrollment_start_date).toLocaleDateString('az-AZ')}`
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              variant={detail.student.is_active ? 'danger' : 'primary'}
              className="w-full justify-center"
              onClick={() => toggleStudent(detail.student)}
            >
              {detail.student.is_active ? 'Hesabı deaktiv et' : 'Hesabı aktiv et'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
