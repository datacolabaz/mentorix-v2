import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import api from '../../lib/api'
import { ATTENDANCE_STATUSES } from '../../lib/liveLessons'

/** Manual attendance: Mentorix cannot see who joined a Meet/Zoom call, so the teacher marks it. */
export default function LiveLessonAttendanceModal({ open, lesson, onClose }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !lesson) return
    let alive = true
    setLoading(true)
    setError('')
    api
      .get(`/live-lessons/${encodeURIComponent(lesson.id)}/attendance`)
      .then((res) => alive && setRows(Array.isArray(res.attendance) ? res.attendance : []))
      .catch((e) => alive && setError(e?.message || t('liveLessons.loadFailed')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [open, lesson, t])

  const update = (studentId, patch) => setRows((list) => list.map((r) => (r.student_id === studentId ? { ...r, ...patch } : r)))
  const markAll = (status) => setRows((list) => list.map((r) => (r.in_roster ? { ...r, status } : r)))

  const save = async () => {
    setSaving(true)
    try {
      const records = rows.filter((r) => r.in_roster).map((r) => ({ student_id: r.student_id, status: r.status || null, note: r.note || '' }))
      const res = await api.put(`/live-lessons/${encodeURIComponent(lesson.id)}/attendance`, { records })
      setRows(Array.isArray(res.attendance) ? res.attendance : rows)
      toast(t('liveLessons.attendanceSaved'))
      onClose?.()
    } catch (e) {
      toast(e?.message || t('liveLessons.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose?.()}
      title={t('liveLessons.attendanceTitle', { title: lesson?.title || '' })}
      size="lg"
      scrollBody
      closeLabel={t('common.close')}
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => markAll('attended')} disabled={!rows.length || saving}>
            {t('liveLessons.markAllAttended')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="button" loading={saving} disabled={!rows.length} onClick={() => void save()}>
              {t('liveLessons.save')}
            </Button>
          </div>
        </div>
      }
    >
      <p className="mb-3 text-xs text-token-textMuted">{t('liveLessons.attendanceHint')}</p>
      {loading ? (
        <p className="py-6 text-center text-sm text-token-textMuted">{t('liveLessons.loading')}</p>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-sm text-error">{error}</p>
      ) : !rows.length ? (
        <p className="py-6 text-center text-sm text-token-textMuted">{t('liveLessons.noStudents')}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border-subtle)]">
          {rows.map((r) => (
            <li key={r.student_id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
              <span className="min-w-0 flex-1 truncate text-sm text-token-textMain">{r.full_name || t('liveLessons.student')}</span>
              <select
                value={r.status || ''}
                disabled={!r.in_roster}
                onChange={(e) => update(r.student_id, { status: e.target.value || null })}
                aria-label={t('liveLessons.attendanceFor', { name: r.full_name || '' })}
                className="rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceMain px-2 py-1.5 text-sm text-token-textMain"
              >
                <option value="">{t('liveLessons.attendance.unmarked')}</option>
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`liveLessons.attendance.${s}`)}
                  </option>
                ))}
              </select>
              <input
                value={r.note || ''}
                disabled={!r.in_roster}
                onChange={(e) => update(r.student_id, { note: e.target.value })}
                maxLength={500}
                placeholder={t('liveLessons.note')}
                className="rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceMain px-2 py-1.5 text-sm text-token-textMain sm:w-48"
              />
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
