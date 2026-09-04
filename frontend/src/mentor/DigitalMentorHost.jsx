import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import useUiStore from '../hooks/useUi'
import { loc } from './knowledge'
import { useDigitalMentor } from './DigitalMentorProvider'

function IconSparkles({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 3.5 13.4 8.6 18.5 10 13.4 11.4 12 16.5 10.6 11.4 5.5 10 10.6 8.6 12 3.5Zm6.5 9.5 0.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3ZM5.5 14.5l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconX({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconChat({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Spotlight({ targetId, active }) {
  const [box, setBox] = useState(null)

  useEffect(() => {
    if (!active || !targetId) {
      setBox(null)
      return undefined
    }
    const escapeId = (id) => {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id)
      return String(id).replace(/"/g, '')
    }
    const measure = () => {
      const el = document.querySelector(`[data-mentor-id="${escapeId(targetId)}"]`)
      if (!el) {
        setBox(null)
        return
      }
      const r = el.getBoundingClientRect()
      setBox({
        top: r.top - 6,
        left: r.left - 6,
        width: r.width + 12,
        height: r.height + 12,
      })
    }
    measure()
    const el = document.querySelector(`[data-mentor-id="${escapeId(targetId)}"]`)
    if (el) {
      try {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    const t = window.setInterval(measure, 400)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      window.clearInterval(t)
    }
  }, [targetId, active])

  if (!active || !box) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[1150]" aria-hidden>
      <div
        className="absolute rounded-2xl"
        style={{
          top: box.top,
          left: box.left,
          width: box.width,
          height: box.height,
          boxShadow:
            '0 0 0 9999px rgba(6, 8, 12, 0.5), 0 0 0 2px #00E676, 0 0 24px rgba(0, 230, 118, 0.35)',
        }}
      />
    </div>
  )
}

export default function DigitalMentorHost() {
  const m = useDigitalMentor()
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const [askText, setAskText] = useState('')
  if (!m?.eligible) return null

  const {
    progress,
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
    sendAsk,
    locale,
    overlayLock,
  } = m

  if (overlayLock) return null

  const status = progress?.status
  const showTour = open && mode === 'tour' && currentStep && status === 'in_progress'
  const showAsk = open && mode === 'ask'
  const lastStep = stepIndex >= 0 && stepIndex === totalSteps - 1
  const dark = theme !== 'light'
  const panelCls = dark
    ? 'border-white/10 bg-[#0c1016]/95 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)]'
    : 'border-black/10 bg-white/95 text-slate-900 shadow-[0_12px_40px_rgba(15,23,42,0.12)]'
  const muted = dark ? 'text-white/45' : 'text-slate-500'
  const bodyText = dark ? 'text-white/70' : 'text-slate-600'
  const ghostBtn = dark
    ? 'border-white/15 text-white/80 hover:bg-white/5'
    : 'border-black/10 text-slate-700 hover:bg-slate-50'

  const panel =
    open && (showTour || showAsk || status === 'completed' || status === 'skipped') ? (
      <div className={`fixed bottom-20 right-4 z-[1160] w-[min(100vw-2rem,22rem)] rounded-2xl border p-3 backdrop-blur-md ${panelCls}`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#00E676]/15 text-[#00E676]">
              <IconSparkles className="h-3.5 w-3.5" />
            </span>
            {t('mentor.title')}
          </div>
          <button
            type="button"
            className={`rounded-lg p-1 ${muted} hover:opacity-80`}
            onClick={() => {
              if (status === 'in_progress') pause()
              else setOpen(false)
            }}
            aria-label={t('common.close')}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {showTour ? (
          <>
            <div className={`mb-2 text-[11px] ${muted}`}>
              {t('mentor.stepOf', { current: stepIndex + 1, total: totalSteps })}
            </div>
            <p className="text-sm font-medium">{loc(currentStep.title, locale)}</p>
            <p className={`mt-1 text-xs leading-relaxed ${bodyText}`}>{loc(currentStep.body, locale)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                className="rounded-lg bg-[#00E676] px-3 py-1.5 text-xs font-semibold text-black"
                onClick={lastStep ? finish : completeCurrent}
              >
                {lastStep ? t('mentor.finish') : t('mentor.next')}
              </button>
              {!lastStep ? (
                <button type="button" className={`rounded-lg border px-3 py-1.5 text-xs ${ghostBtn}`} onClick={skipStep}>
                  {t('mentor.skip')}
                </button>
              ) : null}
              <button type="button" className={`rounded-lg border px-3 py-1.5 text-xs ${ghostBtn}`} onClick={() => setMode('ask')}>
                {t('mentor.askAi')}
              </button>
              <button type="button" className={`rounded-lg px-2 py-1.5 text-xs ${muted} hover:opacity-80`} onClick={finish}>
                {t('mentor.finish')}
              </button>
            </div>
          </>
        ) : null}

        {showAsk ? (
          <div className="flex max-h-72 flex-col">
            <div className="mb-2 max-h-40 space-y-2 overflow-y-auto text-xs">
              {messages.length === 0 ? (
                <p className={muted}>{t('mentor.askHint')}</p>
              ) : (
                messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`rounded-xl px-2.5 py-2 ${
                      msg.role === 'user'
                        ? dark
                          ? 'ml-6 bg-white/10'
                          : 'ml-6 bg-slate-100'
                        : 'mr-4 bg-[#00E676]/10'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))
              )}
            </div>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                sendAsk(askText)
                setAskText('')
              }}
            >
              <input
                value={askText}
                onChange={(e) => setAskText(e.target.value)}
                className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none ${
                  dark
                    ? 'border-white/10 bg-black/30 text-white focus:border-[#00E676]/50'
                    : 'border-black/10 bg-white text-slate-900 focus:border-[#00E676]/50'
                }`}
                placeholder={t('mentor.askPlaceholder')}
              />
              <button
                type="submit"
                disabled={askBusy}
                className="rounded-lg bg-[#00E676] px-2.5 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
              >
                {t('mentor.send')}
              </button>
            </form>
            <button
              type="button"
              className={`mt-2 text-left text-[11px] ${muted} hover:opacity-80`}
              onClick={() => setMode('tour')}
            >
              {t('mentor.backToTour')}
            </button>
          </div>
        ) : null}

        {!showTour && !showAsk ? (
          <div className={`text-xs ${bodyText}`}>
            {t('mentor.ready')}
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                className="rounded-lg bg-[#00E676] px-3 py-1.5 text-xs font-semibold text-black"
                onClick={() => {
                  setMode('ask')
                  setOpen(true)
                }}
              >
                {t('mentor.askAi')}
              </button>
              <button type="button" className={`rounded-lg border px-3 py-1.5 text-xs ${ghostBtn}`} onClick={() => setOpen(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    ) : null

  return createPortal(
    <>
      <Spotlight targetId={currentStep?.target} active={Boolean(showTour && currentStep?.target && !overlayLock)} />
      {panel}
      <button
        type="button"
        className={`fixed bottom-4 right-4 z-[1160] flex h-12 w-12 items-center justify-center rounded-full border border-[#00E676]/30 text-[#00E676] shadow-[0_8px_24px_rgba(0,0,0,0.28)] ${
          dark ? 'bg-[#0c1016] hover:bg-[#12161e]' : 'bg-white hover:bg-slate-50'
        }`}
        aria-label={t('mentor.title')}
        title={t('mentor.title')}
        onClick={() => {
          if (open) {
            if (status === 'in_progress') pause()
            else setOpen(false)
            return
          }
          if (status === 'not_started' || !status) start()
          else if (status === 'paused' || status === 'in_progress') resume()
          else {
            setMode('ask')
            setOpen(true)
          }
        }}
      >
        {open ? (
          <IconX className="h-5 w-5" />
        ) : status === 'completed' || status === 'skipped' ? (
          <IconChat className="h-5 w-5" />
        ) : (
          <IconSparkles className="h-5 w-5" />
        )}
      </button>
    </>,
    document.body,
  )
}
