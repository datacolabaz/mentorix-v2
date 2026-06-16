import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { fetchChatMessages, openChatRoom, sendChatMessage } from '../../lib/chatApi'
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
        const list = await fetchChatMessages(roomId, { limit: 80 })
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
    pollRef.current = setInterval(() => {
      void loadMessages(room.id, { silent: true })
    }, 8000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [open, room?.id, loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  async function onSend(e) {
    e?.preventDefault?.()
    const body = draft.trim()
    if (!body || !room?.id || sending) return
    setSending(true)
    setErr(null)
    try {
      const msg = await sendChatMessage(room.id, body)
      setDraft('')
      if (msg) setMessages((prev) => [...prev, msg])
      else await loadMessages(room.id, { silent: true })
    } catch (e2) {
      setErr(e2?.message || 'Göndərilmədi')
    } finally {
      setSending(false)
    }
  }

  const panelTitle = title || room?.title || 'Çat'

  return (
    <Modal open={open} onClose={onClose} title={panelTitle} size="lg" scrollBody>
      <div className="flex flex-col min-h-[min(60vh,520px)]">
        {err ? (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-100 px-3 py-2 text-sm">
            {err}
          </div>
        ) : null}

        <div
          ref={listRef}
          className="flex-1 min-h-[280px] max-h-[min(52vh,480px)] overflow-y-auto rounded-xl border border-white/10 bg-black/20 px-3 py-3 space-y-3"
        >
          {loading && !messages.length ? (
            <p className="text-sm text-gray-500 text-center py-8">Yüklənir…</p>
          ) : null}
          {!loading && !messages.length ? (
            <p className="text-sm text-gray-500 text-center py-8">Hələ mesaj yoxdur. İlk mesajı siz yazın.</p>
          ) : null}
          {messages.map((m) => {
            const mine = String(m.sender_id) === String(user?.id)
            return (
              <div key={m.id} className={['flex', mine ? 'justify-end' : 'justify-start'].join(' ')}>
                <div
                  className={[
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    mine
                      ? 'bg-primary/20 border border-primary/25 text-gray-100'
                      : 'bg-white/5 border border-white/10 text-gray-200',
                  ].join(' ')}
                >
                  {!mine ? (
                    <div className="text-[10px] font-semibold text-gray-400 mb-1 truncate">
                      {m.sender_name || 'İstifadəçi'}
                    </div>
                  ) : null}
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className="text-[10px] text-gray-500 mt-1 tabular-nums">{fmtTime(m.created_at)}</div>
                </div>
              </div>
            )
          })}
        </div>

        <form onSubmit={onSend} className="mt-4 flex gap-2 items-end">
          <textarea
            className="flex-1 min-h-[44px] max-h-32 resize-y rounded-xl border border-white/10 bg-[#13112e] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40"
            placeholder="Mesaj yazın…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            disabled={!room?.id || loading}
          />
          <Button type="submit" loading={sending} disabled={!room?.id || loading || !draft.trim()}>
            Göndər
          </Button>
        </form>
      </div>
    </Modal>
  )
}
