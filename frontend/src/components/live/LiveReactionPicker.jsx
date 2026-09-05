import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LIVE_REACTION_EMOJIS } from '../../lib/liveRoomSignals'

export default function LiveReactionPicker({ onSend }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('live.reactionsAria')}
        title={t('live.reactions')}
        onClick={() => setOpen((v) => !v)}
        className="h-10 min-w-[2.5rem] px-3 rounded-xl border border-white/15 bg-[#1a1a1a] text-lg hover:bg-white/10"
      >
        😊
      </button>
      {open ? (
        <div
          id={panelId}
          role="listbox"
          aria-label={t('live.reactions')}
          className="absolute bottom-12 left-1/2 z-40 -translate-x-1/2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-white/15 bg-[#161616] p-2 shadow-xl"
        >
          <div className="grid grid-cols-6 gap-1">
            {LIVE_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="option"
                className="h-10 rounded-xl text-xl hover:bg-white/10"
                onClick={() => {
                  void onSend?.(emoji)
                  setOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
