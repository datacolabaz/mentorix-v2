import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function LiveInCallChat({ open, onClose, messages, onSend }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, open])

  if (!open) return null

  const submit = async (e) => {
    e?.preventDefault()
    const ok = await onSend?.(text)
    if (ok) setText('')
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-30 flex w-[min(20rem,100%)] flex-col border-l border-white/10 bg-[#111]/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <h2 className="text-sm font-semibold">{t('live.chatTitle')}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-white/10 hover:text-white"
        >
          {t('common.close')}
        </button>
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {messages.length === 0 ? (
          <p className="text-xs text-gray-500">{t('live.chatEmpty')}</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={msg.local ? 'text-right' : 'text-left'}>
              <p className="text-[10px] font-semibold text-gray-400">
                {msg.local ? t('live.chatYou') : msg.name || t('live.guestLabel')}
              </p>
              <p className="mt-0.5 inline-block max-w-full break-words rounded-2xl bg-white/10 px-2.5 py-1.5 text-sm text-white">
                {msg.text}
              </p>
            </div>
          ))
        )}
      </div>
      <form onSubmit={(e) => void submit(e)} className="flex gap-2 border-t border-white/10 p-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={240}
          placeholder={t('live.chatPlaceholder')}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-primary/40"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
        >
          {t('live.chatSend')}
        </button>
      </form>
    </aside>
  )
}
