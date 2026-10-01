import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import PlatformIcon, { ExternalLinkIcon } from './PlatformIcon'
import { formatDateTime } from '../../lib/formatDateTime'
import { safeExternalHref } from '../../lib/meetingUrl'
import { bakuParts, downloadLessonIcs } from '../../lib/liveLessons'

const STATE_TONE = {
  live: 'bg-emerald-500/15 text-emerald-600',
  upcoming: 'bg-sky-500/15 text-sky-600',
  ended: 'bg-slate-500/15 text-token-textMuted',
  cancelled: 'bg-red-500/15 text-red-500',
  legacy: 'bg-slate-500/15 text-token-textMuted',
}

export default function LiveLessonCard({ lesson, onEdit, onCancel, onAttendance }) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [icsLoading, setIcsLoading] = useState(false)
  const joinHref = lesson.can_join ? safeExternalHref(lesson.join_url) : null
  const startHref = lesson.is_owner && lesson.can_join ? safeExternalHref(lesson.start_url) : null
  const endTime = lesson.ends_at ? bakuParts(lesson.ends_at).time : ''
  const target = lesson.group_name || lesson.student_name
  const canCalendar = lesson.state === 'upcoming' || lesson.state === 'live'
  const canManage = lesson.is_owner && lesson.state !== 'cancelled' && lesson.state !== 'legacy'

  const addToCalendar = async () => {
    setIcsLoading(true)
    try {
      await downloadLessonIcs(lesson)
    } catch (e) {
      toast(e?.message || t('liveLessons.icsFailed'), 'error')
    } finally {
      setIcsLoading(false)
    }
  }

  return (
    <article className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-4 sm:p-5" aria-labelledby={`ll-${lesson.id}-title`}>
      <div className="flex items-start gap-3">
        <PlatformIcon platform={lesson.platform} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id={`ll-${lesson.id}-title`} className="min-w-0 truncate text-base font-semibold text-token-textMain">
              {lesson.title}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATE_TONE[lesson.state] || STATE_TONE.ended}`}>
              {t(`liveLessons.state.${lesson.state}`)}
            </span>
            {lesson.series_id ? <span className="text-[11px] text-token-textMuted">{t('liveLessons.recurring')}</span> : null}
          </div>
          <p className="text-sm text-token-textMuted">
            <time dateTime={lesson.starts_at}>{formatDateTime(lesson.starts_at, i18n.language)}</time>
            {endTime ? ` – ${endTime}` : ''}
            {' · '}
            {lesson.platform_name}
          </p>
          <p className="text-sm text-token-textMuted">
            {target ? <span>{target}</span> : null}
            {!lesson.is_owner && lesson.instructor_name ? <span>{target ? ' · ' : ''}{lesson.instructor_name}</span> : null}
          </p>
          {lesson.state === 'cancelled' && lesson.cancel_reason ? (
            <p className="text-sm text-red-500">{t('liveLessons.cancelReason', { reason: lesson.cancel_reason })}</p>
          ) : null}
          {lesson.my_attendance?.status ? (
            <p className="text-xs text-token-textMuted">
              {t('liveLessons.myAttendance')}: {t(`liveLessons.attendance.${lesson.my_attendance.status}`)}
            </p>
          ) : null}
        </div>
      </div>

      {lesson.description ? <p className="mt-3 whitespace-pre-line text-sm text-token-textMain">{lesson.description}</p> : null}

      {lesson.materials?.length ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.materials')}</p>
          <ul className="mt-1 space-y-1">
            {lesson.materials.map((m, i) => {
              const href = m.type === 'link' ? safeExternalHref(m.url) : null
              return (
                <li key={`${m.id || m.url}-${i}`} className="text-sm">
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      {m.title || href}
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="text-token-textMain">{m.title || t('liveLessons.material')}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {joinHref ? (
          <a
            href={startHref || joinHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-[#041018] hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {t('liveLessons.join')}
            <ExternalLinkIcon />
            <span className="sr-only">({t('liveLessons.opensNewTab')})</span>
          </a>
        ) : null}
        {canCalendar ? (
          <Button type="button" variant="secondary" size="md" loading={icsLoading} onClick={() => void addToCalendar()}>
            {t('liveLessons.addToCalendar')}
          </Button>
        ) : null}
        {canManage && lesson.state !== 'ended' ? (
          <Button type="button" variant="ghost" onClick={() => onEdit?.(lesson)}>
            {t('liveLessons.edit')}
          </Button>
        ) : null}
        {canManage && lesson.state !== 'upcoming' ? (
          <Button type="button" variant="ghost" onClick={() => onAttendance?.(lesson)}>
            {t('liveLessons.attendanceCta')}
          </Button>
        ) : null}
        {canManage && lesson.state !== 'ended' ? (
          <Button type="button" variant="ghost" className="text-red-500" onClick={() => onCancel?.(lesson)}>
            {t('liveLessons.cancel')}
          </Button>
        ) : null}
      </div>
      {joinHref ? <p className="mt-2 text-[11px] text-token-textMuted">{t('liveLessons.externalNote', { platform: lesson.platform_name })}</p> : null}
    </article>
  )
}
