import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { fetchChatMessages, openChatRoom, sendChatMessage } from '../../lib/chatApi'
import { subscribeChatRoom } from '../../lib/chatRealtime'
import useAuthStore from '../../hooks/useAuth'

function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('az-AZ', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function mergeMessage(list, nextMsg, replaceId = null) {
  if (!nextMsg) return list
  const without = replaceId ? list.filter((m) => m.id !== replaceId) : list
  if (without.some((m) => m.id === nextMsg.id)) return without
  return [...without, nextMsg]
}

function absorbIncomingMessage(prev, msg) {
  const withoutPendingDupes = prev.filter(
    (m) =>
      !(
        m._pending &&
        String(m.sender_id) === String(msg?.sender_id) &&
        m.body === msg?.body
      ),
  )
  return mergeMessage(withoutPendingDupes, { ...msg, _pending: false })
}

/**
 * Slack-style contextual chat panel (group / assignment / direct).
 */
export default function ChatPanel({
  open,
  onClose,
  kind,
  groupId,
  assignmentId,
  studentId,
  studentName,
  title,
}) {
  const { user } = useAuthStore()
  const [room, setRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const pollRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  const loadMessages = useCallback(
    async (roomId, { silent = false } = {}) => {
      if (!roomId) return
      if (!silent) setLoading(true)
      try {
        const list = await fetchChatMessages(roomId, { limit: 50 })
        setMessages(list)
        if (!silent) setTimeout(scrollToBottom, 0)
      } catch (e) {
        if (!silent) setErr(e?.message || 'Mesajlar yüklənmədi')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [scrollToBottom],
  )

  useEffect(() => {
    if (!open) {
      setRoom(null)
      setMessages([])
      setDraft('')
      setErr(null)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await openChatRoom({
          kind,
          group_id: groupId || undefined,
          assignment_id: assignmentId || undefined,
          student_id: studentId || undefined,
          student_name: studentName || undefined,
        })
        if (cancelled) return
        setRoom(r)
        await loadMessages(r.id)
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Çat açılmadı')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, kind, groupId, assignmentId, studentId, studentName, loadMessages])

  useEffect(() => {
    if (!open || !room?.id) return undefined

    const unsubscribe = subscribeChatRoom(room.id, {
      onMessage: (msg) => {
        setMessages((prev) => absorbIncomingMessage(prev, msg))
        requestAnimationFrame(() => scrollToBottom())
      },
    })

    pollRef.current = setInterval(() => {
      void loadMessages(room.id, { silent: true })
    }, 3000)

    return () => {
      unsubscribe()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [open, room?.id, loadMessages, scrollToBottom])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  const onSend = useCallback(
    async (e) => {
      e?.preventDefault?.()
      const body = draft.trim()
      if (!body || !room?.id || sending) return

      const optimisticId = `optimistic-${Date.now()}`
      const optimisticMsg = {
        id: optimisticId,
        room_id: room.id,
        sender_id: user?.id,
        sender_name: user?.full_name || null,
        sender_role: user?.role || null,
        body,
        created_at: new Date().toISOString(),
        _pending: true,
      }

      setDraft('')
      setErr(null)
      setMessages((prev) => mergeMessage(prev, optimisticMsg))
      requestAnimationFrame(() => scrollToBottom())
      setSending(true)

      try {
        const msg = await sendChatMessage(room.id, body)
        const serverMsg = msg?.id
          ? { ...msg, _pending: false }
          : { ...optimisticMsg, id: msg?.id || optimisticId, _pending: false }
        setMessages((prev) => mergeMessage(prev, serverMsg, optimisticId))
        requestAnimationFrame(() => scrollToBottom())
      } catch (e2) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        setDraft(body)
        setErr(e2?.message || 'Göndərilmədi')
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    },
    [draft, room?.id, sending, scrollToBottom, user?.full_name, user?.id, user?.role],
  )

  const onInputKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      e.preventDefault()
      void onSend(e)
    },
    [onSend],
  )

  const panelTitle = title || room?.title || 'Çat'
  const hasMessages = messages.length > 0

  return (
    <Modal open={open} onClose={onClose} title={panelTitle} size="lg" scrollBody>
      <div className="flex flex-col min-h-[min(60vh,520px)]">
        {err ? (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 px-3 py-2 text-sm">
            {err}
          </div>
        ) : null}

        <div
          ref={listRef}
          className="flex-1 min-h-[280px] max-h-[min(52vh,480px)] overflow-y-auto rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-3 space-y-3"
        >
          {loading && !hasMessages ? (
            <p className="text-sm text-token-textMuted text-center py-8">Yüklənir…</p>
          ) : null}
          {!loading && !hasMessages ? (
            <p className="text-sm text-token-textMuted text-center py-8">Hələ mesaj yoxdur. İlk mesajı siz yazın.</p>
          ) : null}
          {messages.map((m) => {
            const mine = String(m.sender_id) === String(user?.id)
            return (
              <div key={m.id} className={['flex', mine ? 'justify-end' : 'justify-start'].join(' ')}>
                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    mine
                      ? 'bg-primary/20 border border-primary/30 text-token-textMain'
                      : 'bg-token-surfaceCard border border-[color:var(--border-subtle)] text-token-textMain',
                    m._pending ? 'opacity-80' : '',
                  ].join(' ')}
                >
                  {!mine ? (
                    <div className="text-[10px] font-semibold text-token-textMuted mb-1 truncate">
                      {m.sender_name || 'İstifadəçi'}
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className="text-[10px] text-token-textMuted mt-1 tabular-nums">
                    {m._pending ? 'Göndərilir…' : fmtTime(m.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <form onSubmit={onSend} className="mt-4 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="flex-1 min-h-[44px] max-h-32 resize-y rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm text-token-textMain placeholder:text-token-textMuted outline-none focus:border-primary/40"
            placeholder="Mesaj yazın…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKeyDown}
            rows={2}
            disabled={!room?.id || loading}
          />
          <Button type="submit" loading={sending} disabled={!room?.id || loading || sending || !draft.trim()}>
            Göndər
          </Button>
        </form>
      </div>
    </Modal>
  )
}
