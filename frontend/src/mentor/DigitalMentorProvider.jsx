import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../hooks/useAuth'
import useUiStore from '../hooks/useUi'
import { buildMentorContext, loc } from './knowledge'
import { flowForRole } from './flows'
import { fetchOnboarding, saveOnboarding, askMentor } from './mentorApi'

const DigitalMentorContext = createContext(null)

const HIDE_PATHS = new Set(['/login', '/register', '/', '/onboarding/role', '/verify-phone', '/verify-email', '/reset-password'])

function shouldHidePath(pathname) {
  if (HIDE_PATHS.has(pathname)) return true
  if (pathname.startsWith('/live')) return true
  return false
}

function emptyProgress(role, firstStepId) {
  return {
    status: 'not_started',
    role,
    current_step_id: firstStepId || null,
    completed_step_ids: [],
  }
}

export function DigitalMentorProvider({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const overlayLock = useUiStore((s) => s.overlayLock)
  const locale = useUiStore((s) => s.locale) || 'az'
  const flow = useMemo(() => flowForRole(user?.role), [user?.role])
  const eligible = Boolean(user && flow && ['instructor', 'student', 'admin'].includes(user.role))

  const [progress, setProgress] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('tour')
  const [messages, setMessages] = useState([])
  const [askBusy, setAskBusy] = useState(false)
  const autostartTried = useRef(false)
  const completingRef = useRef(false)

  const currentStep = useMemo(() => {
    if (!flow || !progress) return null
    if (progress.status === 'completed' || progress.status === 'skipped') return null
    if (!progress.current_step_id) return flow.steps[0]
    return flow.steps.find((s) => s.id === progress.current_step_id) || flow.steps[0]
  }, [flow, progress])

  const stepIndex = currentStep && flow ? flow.steps.findIndex((s) => s.id === currentStep.id) : -1
  const totalSteps = flow?.steps.length || 0

  const persist = useCallback(
    async (next) => {
      if (!eligible) return next
      setProgress(next)
      try {
        const saved = await saveOnboarding(next)
        const body = saved?.status ? saved : saved?.progress || next
        setProgress(body)
        return body
      } catch {
        return next
      }
    },
    [eligible],
  )

  useEffect(() => {
    autostartTried.current = false
    setLoaded(false)
    setProgress(null)
    setOpen(false)
    setMessages([])
    if (!eligible) {
      setLoaded(true)
      return undefined
    }
    let cancelled = false
    fetchOnboarding()
      .then((p) => {
        if (cancelled) return
        const body = p?.status ? p : p?.progress
        setProgress(body || emptyProgress(user.role, flow.steps[0].id))
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) {
          setProgress(emptyProgress(user.role, flow.steps[0].id))
          setLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [eligible, user?.id, user?.role, flow])

  const start = useCallback(async () => {
    if (!flow) return
    const next = {
      status: 'in_progress',
      role: user.role,
      current_step_id: flow.steps[0].id,
      completed_step_ids: [],
    }
    await persist(next)
    setMode('tour')
    setOpen(true)
    if (location.pathname !== flow.steps[0].route) {
      navigate(flow.steps[0].route)
    }
  }, [flow, user?.role, persist, location.pathname, navigate])

  const resume = useCallback(async () => {
    if (!flow || !progress) return
    const step = currentStep || flow.steps[0]
    const next = {
      ...progress,
      status: 'in_progress',
      current_step_id: step.id,
    }
    await persist(next)
    setMode('tour')
    setOpen(true)
    if (step.route && location.pathname !== step.route) {
      navigate(step.route)
    }
  }, [flow, progress, currentStep, persist, location.pathname, navigate])

  const completeCurrent = useCallback(async () => {
    if (!flow || !progress || !currentStep || completingRef.current) return
    completingRef.current = true
    try {
      const completed = Array.from(new Set([...(progress.completed_step_ids || []), currentStep.id]))
      const nextIdx = stepIndex + 1
      if (nextIdx >= flow.steps.length) {
        await persist({
          ...progress,
          status: 'completed',
          current_step_id: currentStep.id,
          completed_step_ids: completed,
        })
        setOpen(false)
        return
      }
      const nextStep = flow.steps[nextIdx]
      await persist({
        ...progress,
        status: 'in_progress',
        current_step_id: nextStep.id,
        completed_step_ids: completed,
      })
      if (nextStep.route && location.pathname !== nextStep.route) {
        navigate(nextStep.route)
      }
    } finally {
      window.setTimeout(() => {
        completingRef.current = false
      }, 400)
    }
  }, [flow, progress, currentStep, stepIndex, persist, location.pathname, navigate])

  const skipStep = useCallback(async () => {
    await completeCurrent()
  }, [completeCurrent])

  const pause = useCallback(async () => {
    if (!progress) return
    await persist({ ...progress, status: 'paused' })
    setOpen(false)
  }, [progress, persist])

  const finish = useCallback(async () => {
    if (!progress || !flow) return
    await persist({
      ...progress,
      status: 'completed',
      current_step_id: flow.steps[flow.steps.length - 1].id,
      completed_step_ids: flow.steps.map((s) => s.id),
    })
    setOpen(false)
  }, [progress, flow, persist])

  const skipAll = useCallback(async () => {
    if (!progress) return
    await persist({ ...progress, status: 'skipped' })
    setOpen(false)
  }, [progress, persist])

  useEffect(() => {
    if (!loaded || !eligible || autostartTried.current || !progress) return
    if (shouldHidePath(location.pathname)) return
    autostartTried.current = true
    if (progress.status === 'not_started' || !progress.status) {
      void start()
    } else if (progress.status === 'in_progress') {
      void resume()
    }
  }, [loaded, eligible, progress, start, resume, location.pathname])

  useEffect(() => {
    const navHighlight = Boolean(open && currentStep?.waitForClick && String(currentStep.target || '').startsWith('nav:'))
    if (navHighlight) document.body.dataset.mentorTour = '1'
    else delete document.body.dataset.mentorTour
    return () => {
      delete document.body.dataset.mentorTour
    }
  }, [open, currentStep])

  useEffect(() => {
    if (!open || overlayLock) return undefined
    if (!currentStep?.waitForClick || !currentStep.target) return undefined
    if (currentStep.target.startsWith('nav:')) {
      window.dispatchEvent(new CustomEvent('mx:mentor-open-nav'))
    }
    const selector = `[data-mentor-id="${String(currentStep.target).replace(/"/g, '')}"]`
    const onClick = (e) => {
      const hit = e.target.closest?.(selector)
      if (hit) void completeCurrent()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [open, overlayLock, currentStep, completeCurrent])

  const sendAsk = useCallback(
    async (text) => {
      const q = String(text || '').trim()
      if (!q) return
      setMessages((m) => [...m, { role: 'user', text: q }])
      setAskBusy(true)
      const context = buildMentorContext({
        userRole: user?.role,
        currentRoute: location.pathname,
        onboardingStep: currentStep?.id || null,
        completedSteps: progress?.completed_step_ids || [],
        locale,
      })
      try {
        const res = await askMentor({
          question: q,
          currentRoute: location.pathname,
          onboardingStep: currentStep?.id || null,
          completedSteps: progress?.completed_step_ids || [],
          context,
        })
        setMessages((m) => [...m, { role: 'assistant', text: res.answer || loc({ az: 'Cavab yoxdur', ru: 'Нет ответа' }, locale) }])
      } catch {
        setMessages((m) => [
          ...m,
          {
            role: 'assistant',
            text:
              locale === 'ru'
                ? 'Сейчас не удалось ответить. Откройте Помощь в меню или напишите в поддержку.'
                : 'Hazırda cavab verilə bilmədi. Menyuda Kömək bölməsinə baxın və ya dəstəyə yazın.',
          },
        ])
      } finally {
        setAskBusy(false)
      }
    },
    [location.pathname, currentStep?.id, locale, user?.role, progress?.completed_step_ids],
  )

  const hideForAuthScreens = shouldHidePath(location.pathname)

  const value = {
    eligible: eligible && !hideForAuthScreens,
    loaded,
    progress,
    flow,
    currentStep,
    stepIndex,
    totalSteps,
    open,
    setOpen,
    mode,
    setMode,
    messages,
    askBusy,
    start,
    resume,
    completeCurrent,
    skipStep,
    pause,
    finish,
    skipAll,
    sendAsk,
    locale,
    overlayLock,
  }

  return <DigitalMentorContext.Provider value={value}>{children}</DigitalMentorContext.Provider>
}

export function useDigitalMentor() {
  return useContext(DigitalMentorContext)
}
