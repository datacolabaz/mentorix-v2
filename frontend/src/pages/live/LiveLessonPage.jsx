import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LiveLessonCard from '../../components/live/LiveLessonCard'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'

function Notice({ title, text, backTo, backLabel }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-6 text-center sm:p-8">
      <h1 className="font-display text-lg font-bold text-token-textMain">{title}</h1>
      <p className="mt-2 text-sm text-token-textMuted">{text}</p>
      {backTo ? (
        <Link to={backTo} className="mt-5 inline-flex rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-on hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          {backLabel}
        </Link>
      ) : null}
    </div>
  )
}

/** Old and new /live/:roomCode links: shows the lesson (with its Meet/Zoom link) or a friendly fallback. */
export default function LiveLessonPage() {
  const { roomCode } = useParams()
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const listPath = role === 'student' ? '/student/live-lessons' : '/instructor/live-lessons'
  const [state, setState] = useState({ status: 'loading', lesson: null, message: '' })

  useEffect(() => {
    let alive = true
    setState({ status: 'loading', lesson: null, message: '' })
    api
      .get(`/live-lessons/code/${encodeURIComponent(roomCode || '')}`)
      .then((res) => alive && setState({ status: res.lesson?.state === 'legacy' ? 'legacy' : 'ok', lesson: res.lesson, message: '' }))
      .catch((e) => {
        if (!alive) return
        if (e?.status === 404 || e?.status === 403) setState({ status: 'missing', lesson: null, message: '' })
        else setState({ status: 'error', lesson: null, message: e?.message || '' })
      })
    return () => {
      alive = false
    }
  }, [roomCode])

  if (state.status === 'loading') {
    return <div className="mx-auto h-40 max-w-2xl animate-pulse rounded-2xl bg-token-surfaceMain" aria-busy="true" />
  }
  if (state.status === 'legacy') {
    return <Notice title={t('liveLessons.retired.title')} text={t('liveLessons.retired.text')} backTo={listPath} backLabel={t('liveLessons.retired.cta')} />
  }
  if (state.status === 'missing') {
    return <Notice title={t('liveLessons.notFound.title')} text={t('liveLessons.notFound.text')} backTo={listPath} backLabel={t('liveLessons.retired.cta')} />
  }
  if (state.status === 'error') {
    return <Notice title={t('liveLessons.loadFailed')} text={state.message} backTo={listPath} backLabel={t('liveLessons.retired.cta')} />
  }
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Link to={listPath} className="text-sm text-token-textMuted hover:text-token-textMain">
        ← {t('liveLessons.title')}
      </Link>
      <LiveLessonCard lesson={state.lesson} />
    </div>
  )
}
