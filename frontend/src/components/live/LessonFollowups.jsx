import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Button from '../common/Button'
import { useToast } from '../common/Toast'

export const FOLLOWUP_KINDS = [
  { id: 'material', label: 'Material', list: '/materials', key: 'materials' },
  { id: 'task', label: 'Tapşırıq', list: '/tasks', key: 'tasks' },
  { id: 'exam', label: 'İmtahan', list: '/exams', key: 'exams' },
]

const KIND_LABEL = { material: 'Material', task: 'Tapşırıq', exam: 'İmtahan' }

export function followupHref(kind, isOwner) {
  if (isOwner) return { material: '/instructor/materials', task: '/instructor/tasks', exam: '/instructor/exams' }[kind]
  return { material: '/student/materials', task: '/student/assignments', exam: '/student/exams' }[kind]
}

function itemTitle(kind, item) {
  if (kind === 'material') return item.title || item.original_filename || 'Material'
  return item.title || '—'
}

/**
 * After the lesson: the teacher attaches their own material / task / exam; students see materials and the
 * tasks/exams actually assigned to them (the API filters — this component renders what it receives).
 */
export default function LessonFollowups({ lesson, onChange }) {
  const toast = useToast()
  const isOwner = Boolean(lesson?.is_owner)
  const [items, setItems] = useState(lesson?.followups || [])
  const [kind, setKind] = useState('material')
  const [options, setOptions] = useState([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [refId, setRefId] = useState('')
  const [assign, setAssign] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setItems(lesson?.followups || [])
  }, [lesson?.followups])

  useEffect(() => {
    if (!isOwner) return undefined
    let alive = true
    const def = FOLLOWUP_KINDS.find((k) => k.id === kind)
    setOptionsLoading(true)
    setRefId('')
    api
      .get(def.list)
      .then((d) => {
        if (!alive) return
        const list = Array.isArray(d?.[def.key]) ? d[def.key] : []
        setOptions(list.filter((x) => x?.id && !x.is_deleted))
      })
      .catch(() => alive && setOptions([]))
      .finally(() => alive && setOptionsLoading(false))
    return () => {
      alive = false
    }
  }, [kind, isOwner])

  if (!isOwner && !items.length) return null
  if (lesson?.state === 'legacy') return null

  const add = async (e) => {
    e?.preventDefault?.()
    if (!refId) {
      toast('Siyahıdan seçin', 'error')
      return
    }
    setBusy(true)
    try {
      const d = await api.post(`/live-lessons/${lesson.id}/followups`, { kind, ref_id: refId, assign })
      setItems(d?.followups || [])
      onChange?.(d?.followups || [])
      toast(
        d?.added
          ? d?.assigned
            ? `Əlavə olundu və ${d.assigned} tələbəyə təyin edildi`
            : 'Əlavə olundu, tələbələrə bildiriş göndərildi'
          : 'Bu artıq dərsə əlavə olunub',
        'success',
      )
      setRefId('')
    } catch (err) {
      toast(err?.message || 'Əlavə olunmadı', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (f) => {
    setBusy(true)
    try {
      const d = await api.delete(`/live-lessons/${lesson.id}/followups/${f.id}`)
      setItems(d?.followups || [])
      onChange?.(d?.followups || [])
    } catch (err) {
      toast(err?.message || 'Silinmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-4 sm:p-5 space-y-3"
      data-testid="lesson-followups"
    >
      <div>
        <h2 className="font-semibold text-token-textMain">Dərsdən sonra</h2>
        <p className="text-xs text-token-textMuted">
          {isOwner
            ? 'Öz materialınızı, tapşırığınızı və ya imtahanınızı bu dərsə əlavə edin. Tələbələr bildiriş alır.'
            : 'Müəllimin bu dərsə əlavə etdikləri.'}
        </p>
      </div>

      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 text-sm">
              <Link to={followupHref(f.kind, isOwner)} className="min-w-0 truncate text-token-textMain hover:underline">
                <span className="text-token-textMuted">{KIND_LABEL[f.kind] || f.kind}:</span> {f.title}
              </Link>
              {isOwner ? (
                <button
                  type="button"
                  className="text-xs text-error hover:underline shrink-0"
                  disabled={busy}
                  onClick={() => void remove(f)}
                >
                  Çıxar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : isOwner ? (
        <p className="text-sm text-token-textMuted">Hələ heç nə əlavə olunmayıb.</p>
      ) : null}

      {isOwner && lesson.state !== 'cancelled' ? (
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <label className="text-sm">
            <span className="block text-xs text-token-textMuted mb-1">Növ</span>
            <select
              aria-label="Növ"
              className="w-full rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {FOLLOWUP_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm flex-1 min-w-0">
            <span className="block text-xs text-token-textMuted mb-1">Seçin</span>
            <select
              aria-label="Element"
              className="w-full rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
              value={refId}
              disabled={optionsLoading}
              onChange={(e) => setRefId(e.target.value)}
            >
              <option value="">{optionsLoading ? 'Yüklənir…' : options.length ? '— seçin —' : 'Siyahı boşdur'}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {itemTitle(kind, o)}
                </option>
              ))}
            </select>
          </label>
          {kind !== 'material' ? (
            <label className="text-xs flex items-center gap-2 text-token-textMuted sm:pb-2.5">
              <input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} />
              Dərsin tələbələrinə təyin et
            </label>
          ) : null}
          <Button type="submit" size="sm" loading={busy}>
            Əlavə et
          </Button>
        </form>
      ) : null}
    </section>
  )
}
