import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LIVE_CHAT_FILE_ACCEPT,
  LIVE_CHAT_FILE_MAX_BYTES,
  isAllowedLiveChatFilename,
  isLiveChatImage,
  liveChatFileOpenUrl,
} from '../../lib/liveChatFile'

function ChatFileBubble({ file, guestAuth }) {
  const href = liveChatFileOpenUrl(file, guestAuth)
  if (!href) return null
  if (isLiveChatImage(file)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="mt-1 block">
        <img src={href} alt={file.name} className="max-h-36 max-w-full rounded-lg border border-white/10" />
      </a>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex max-w-full items-center gap-1 break-all text-xs text-primary underline"
    >
      📎 {file.name}
    </a>
  )
}

export default function LiveInCallChat({ open, onClose, messages, onSend, onUploadFile, guestAuth }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)

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

  const pickFile = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > LIVE_CHAT_FILE_MAX_BYTES) {
      window.alert(t('live.chatFileTooLarge'))
      return
    }
    const ok = isAllowedLiveChatFilename(file.name, file.type)
    if (!ok) {
      window.alert(t('live.chatFileType'))
      return
    }
    setPendingFile(file)
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (uploading) return
    let fileMeta = null
    if (pendingFile && onUploadFile) {
      setUploading(true)
      try {
        fileMeta = await onUploadFile(pendingFile)
      } catch (err) {
        window.alert(err?.message || t('live.chatFileFailed'))
        setUploading(false)
        return
      }
      setUploading(false)
    }
    const ok = await onSend?.(text, fileMeta)
    if (ok) {
      setText('')
      setPendingFile(null)
    }
  }

  const canSend = Boolean(text.trim() || pendingFile) && !uploading

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
              <div className="mt-0.5 inline-block max-w-full rounded-2xl bg-white/10 px-2.5 py-1.5 text-left text-sm text-white">
                {msg.text ? <p className="break-words">{msg.text}</p> : null}
                {msg.file ? <ChatFileBubble file={msg.file} guestAuth={guestAuth} /> : null}
              </div>
            </div>
          ))
        )}
      </div>
      {pendingFile ? (
        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-1.5 text-[11px] text-gray-300">
          <span className="truncate">📎 {pendingFile.name}</span>
          <button type="button" className="text-gray-400 hover:text-white" onClick={() => setPendingFile(null)}>
            {t('common.close')}
          </button>
        </div>
      ) : null}
      <form onSubmit={(e) => void submit(e)} className="flex gap-1.5 border-t border-white/10 p-2">
        <input ref={fileRef} type="file" accept={LIVE_CHAT_FILE_ACCEPT} className="hidden" onChange={pickFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title={t('live.chatAttach')}
          className="shrink-0 rounded-xl border border-white/15 px-2.5 text-sm text-gray-200 hover:bg-white/10 disabled:opacity-40"
        >
          📎
        </button>
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
          disabled={!canSend}
          className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-black disabled:opacity-40"
        >
          {uploading ? t('live.chatUploading') : t('live.chatSend')}
        </button>
      </form>
    </aside>
  )
}
