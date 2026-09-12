import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Card from '../../components/common/Card'
import { useToast } from '../../components/common/Toast'
import GoogleSignInButton from '../../components/auth/GoogleSignInButton'
import { setPageSeo } from '../../lib/pageSeo'
import { rememberReturnAfterLogin, consumeReturnAfterLogin } from '../../lib/inviteReturn'
import {
  completeStudentInviteOnboarding,
  ensureStudentInviteSession,
} from '../../lib/ensureStudentInviteSession'

export default function TaskInvite() {
  const { taskId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user, setSession } = useAuthStore()
  const id = useMemo(() => String(taskId || '').trim(), [taskId])
  const [info, setInfo] = useState(null)
  const [infoLoading, setInfoLoading] = useState(Boolean(id))
  const [infoError, setInfoError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [joinBusy, setJoinBusy] = useState(false)
  const joiningRef = useRef(false)
  const onboardingRef = useRef(false)

  useEffect(() => {
    if (!id) {
      setInfoLoading(false)
      setInfoError('Tapşırıq linki düzgün deyil')
      return
    }
    rememberReturnAfterLogin(`/task/${encodeURIComponent(id)}`)
    let cancelled = false
    ;(async () => {
      setInfoLoading(true)
      setInfoError('')
      try {
        const d = await api.get(`/public/task-invite/${encodeURIComponent(id)}`)
        if (!cancelled) setInfo(d)
      } catch (err) {
        if (!cancelled) setInfoError(err?.message || 'Tapşırıq tapılmadı')
      } finally {
        if (!cancelled) setInfoLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    const task = info?.task
    if (!task) return
    const title = String(task.title || '').trim() || 'Tapşırıq'
    const instructor = String(task.instructor_name || '').trim()
    setPageSeo({
      title: `${title} — Tapşırıq | Mentorix`,
      description: instructor
        ? `${instructor} müəllimindən tapşırıq: ${title}. Mentorix ilə daxil olub başla.`
        : `Tapşırıq: ${title}. Mentorix ilə daxil olub başla.`,
      canonicalPath: `/task/${encodeURIComponent(id)}`,
    })
  }, [info?.task, id])

  /** Email/Google return: session exists but role is still null until persona is set. */
  useEffect(() => {
    if (!user?.id || !info?.task) return
    if (user.role === 'student') return
    if (user.role && user.role !== 'student') return
    if (onboardingRef.current) return
    onboardingRef.current = true
    ;(async () => {
      try {
        await completeStudentInviteOnboarding(user, {
          setSession,
          subjectHint: info.task.title || 'Tapşırıq',
        })
      } catch {
        /* acceptInvite / UI will retry after next auth */
      } finally {
        onboardingRef.current = false
      }
    })()
  }, [user, info?.task, setSession])

  const acceptInvite = useCallback(async () => {
    if (!id || user?.role !== 'student') return
    if (joiningRef.current) return
    joiningRef.current = true
    setJoinBusy(true)
    try {
      const sub = await api.post(`/tasks/${encodeURIComponent(id)}/access-from-link`, {})
      consumeReturnAfterLogin()
      toast(sub?.message || 'Tapşırıqa daxil ola bilərsiniz', 'success')
      const openId = sub?.student_assignment_id
      const dest = openId
        ? `/student/assignments?open=${encodeURIComponent(openId)}`
        : `/student/assignments?task=${encodeURIComponent(id)}`
      navigate(dest, { replace: true })
    } catch (err) {
      toast(err?.message || 'Qoşulma alınmadı', 'error')
    } finally {
      joiningRef.current = false
      setJoinBusy(false)
    }
  }, [id, user?.role, navigate, toast])

  useEffect(() => {
    if (user?.role === 'student' && id && info?.task && !infoLoading && !infoError) {
      void acceptInvite()
    }
  }, [user?.role, id, info, infoLoading, infoError, acceptInvite])

  const handleGoogleCredential = async (credential) => {
    setAuthBusy(true)
    try {
      let r = await api.post('/auth/google/login', { credential })
      if (r?.needs_role || r?.needs_onboarding || r?.needs_phone_link) {
        r = await api.post('/auth/google/complete', { credential, role: 'student' })
      }
      const authUser = await ensureStudentInviteSession(r, {
        setSession,
        toast,
        subjectHint: info?.task?.title || 'Tapşırıq',
      })
      if (!authUser) return
      toast('Daxil oldunuz', 'success')
    } catch (err) {
      toast(err?.message || 'Google girişi uğursuz', 'error')
    } finally {
      setAuthBusy(false)
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(id ? `/task/${id}` : '/student')}`
  const task = info?.task
  const blockedAsOtherRole = Boolean(user?.role && user.role !== 'student')
  const isStudentSession = user?.role === 'student'
  const sessionPending = Boolean(user?.id && !user.role)

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto w-full min-h-[70vh]">
      <h1 className="font-display font-bold text-2xl text-token-textMain">Tapşırıqa qoşul</h1>
      <p className="text-sm text-token-textMuted mt-1 mb-6">
        Tapşırıqa başlamaq üçün Google ilə daxil olun. Telefon tələb olunmur.
      </p>
      {infoLoading && <p className="text-sm text-token-textMuted">Yüklənir…</p>}
      {infoError && (
        <Card className="p-4 border border-red-500/30 text-red-300 text-sm mb-4">{infoError}</Card>
      )}
      {task && (
        <Card className="p-4 mb-4 border border-[color:var(--border-subtle)]">
          <p className="text-xs uppercase tracking-wider text-token-textMuted mb-1">Tapşırıq</p>
          <p className="text-lg font-semibold text-token-textMain">{task.title}</p>
          <p className="text-sm text-token-textMuted mt-1">Müəllim: {task.instructor_name}</p>
        </Card>
      )}
      {!infoLoading && !infoError && task ? (
        <Card className="p-4 space-y-4">
          {blockedAsOtherRole ? (
            <p className="text-sm text-amber-300 text-center">
              Bu hesab tələbə deyil — tələbə hesabı ilə daxil olun.
            </p>
          ) : isStudentSession ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-emerald-300">
                Daxil: <span className="font-medium">{user.email || user.full_name}</span>
              </p>
              <Button type="button" loading={joinBusy} onClick={() => void acceptInvite()}>
                Tapşırıqa başla
              </Button>
            </div>
          ) : sessionPending ? (
            <p className="text-sm text-token-textMuted text-center">Sessiya hazırlanır…</p>
          ) : (
            <div className="space-y-3">
              <GoogleSignInButton onCredential={handleGoogleCredential} disabled={authBusy} />
              <Link
                to={loginHref}
                className="block text-center text-sm text-primary hover:underline font-medium"
              >
                Email ilə giriş
              </Link>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  )
}
