import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../../components/common/Button'
import LiveLessonCard from '../../components/live/LiveLessonCard'
import LiveLessonFormModal from '../../components/live/LiveLessonFormModal'
import LiveLessonCancelModal from '../../components/live/LiveLessonCancelModal'
import LiveLessonAttendanceModal from '../../components/live/LiveLessonAttendanceModal'
import ConnectedMeetingAccounts from '../../components/live/ConnectedMeetingAccounts'
import LegacyRecordings from '../../components/live/LegacyRecordings'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'

const SCOPES = ['upcoming', 'past']

/** Live lessons on the teacher's Google Meet / Zoom / other link — instructor and student view. */
export default function LiveLessons() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const isInstructor = user?.role === 'instructor'
  const [params, setParams] = useSearchParams()
  const scope = SCOPES.includes(params.get('scope')) ? params.get('scope') : 'upcoming'
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [attendanceFor, setAttendanceFor] = useState(null)
  const initialGroupId = params.get('group') || ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/live-lessons', { params: { scope } })
      setLessons(Array.isArray(res.lessons) ? res.lessons : [])
    } catch (e) {
      setError(e?.message || t('liveLessons.loadFailed'))
      setLessons([])
    } finally {
      setLoading(false)
    }
  }, [scope, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (isInstructor && params.get('new') === '1') setFormOpen(true)
  }, [isInstructor, params])

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
    if (params.get('new') || params.get('group')) {
      const next = new URLSearchParams(params)
      next.delete('new')
      next.delete('group')
      setParams(next, { replace: true })
    }
  }

  const setScope = (s) => {
    const next = new URLSearchParams(params)
    next.set('scope', s)
    setParams(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-token-textMain sm:text-2xl">{t('liveLessons.title')}</h1>
          <p className="mt-1 text-sm text-token-textMuted">{isInstructor ? t('liveLessons.subtitleInstructor') : t('liveLessons.subtitleStudent')}</p>
        </div>
        {isInstructor ? (
          <Button type="button" className="shrink-0 whitespace-nowrap" onClick={() => setFormOpen(true)}>
            {t('liveLessons.new')}
          </Button>
        ) : null}
      </header>

      <div className="flex gap-2" role="tablist" aria-label={t('liveLessons.title')}>
        {SCOPES.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={scope === s}
            onClick={() => setScope(s)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
              scope === s ? 'bg-brand-subtle text-fg' : 'text-token-textMuted hover:text-token-textMain'
            }`}
          >
            {t(`liveLessons.scopeTabs.${s}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-token-surfaceMain" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-error/30 bg-error-subtle p-4 text-sm text-error">
          {error}{' '}
          <button type="button" onClick={() => void load()} className="underline">
            {t('liveLessons.retry')}
          </button>
        </div>
      ) : !lessons.length ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-subtle)] p-8 text-center">
          <p className="text-sm font-medium text-token-textMain">
            {scope === 'past' ? t('liveLessons.emptyPast') : t('liveLessons.emptyUpcoming')}
          </p>
          <p className="mt-1 text-xs text-token-textMuted">{isInstructor ? t('liveLessons.emptyHintInstructor') : t('liveLessons.emptyHintStudent')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((l) => (
            <LiveLessonCard
              key={l.id}
              lesson={l}
              onEdit={(x) => {
                setEditing(x)
                setFormOpen(true)
              }}
              onCancel={setCancelling}
              onAttendance={setAttendanceFor}
            />
          ))}
        </div>
      )}

      {isInstructor ? (
        <>
          <ConnectedMeetingAccounts />
          <LegacyRecordings />
          <LiveLessonFormModal open={formOpen} lesson={editing} initialGroupId={initialGroupId} onClose={closeForm} onSaved={() => void load()} />
          <LiveLessonCancelModal open={Boolean(cancelling)} lesson={cancelling} onClose={() => setCancelling(null)} onCancelled={() => void load()} />
          <LiveLessonAttendanceModal open={Boolean(attendanceFor)} lesson={attendanceFor} onClose={() => setAttendanceFor(null)} />
        </>
      ) : null}
    </div>
  )
}
