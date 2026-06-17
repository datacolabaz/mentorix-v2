import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Button from '../common/Button'
import useAuthStore from '../../hooks/useAuth'
import {
  CHAT_MAX_FILE_BYTES,
  fetchChatDirects,
  fetchChatAssignments,
  fetchChatGroups,
  fetchChatMessages,
  openChatRoom,
  sendChatMessage,
  uploadChatAttachment,
} from '../../lib/chatApi'
import { subscribeChatRoom } from '../../lib/chatRealtime'
import { resolveApiAssetUrl } from '../../lib/apiBase'
import {
  buildChatTimeline,
  formatChatTime,
  initials,
  isImageAttachment,
  isPdfAttachment,
} from '../../lib/chatFormat'

const POLL_MS = 3000
const EMOJI_QUICK = ['👍', '😊', '🙏', '✅', '❤️', '🎉']

const MODE_COPY = {
  group: {
    sidebarTitle: 'Çat',
    sidebarSubtitle: 'Qrup söhbətləri',
    emptyList: 'Hələ aktiv qrup çatınız yoxdur.',
    listError: 'Qruplar yüklənmədi',
    headerFallback: 'Qrup çatı',
    peerLabel: (item) => item?.group_name || 'Qrup',
    peerMeta: (item) => (
      <>
        <span>{item?.member_count ?? '—'} üzv</span>
        {Number(item?.online_count) > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
            {item.online_count} onlayn
          </span>
        ) : null}
      </>
    ),
    headerMeta: (item) => (
      <>
        <span>{item?.member_count ?? '—'} üzv</span>
        {Number(item?.online_count) > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
            <span>{item.online_count} onlayn</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-token-textMuted/40" aria-hidden />
            <span>Offlayn</span>
          </span>
        )}
      </>
    ),
    itemKey: (item) => item.group_id,
    isActive: (item, active) => String(item.group_id) === String(active?.group_id),
  },
  direct: {
    sidebarTitle: 'Fərdi çat',
    sidebarSubtitle: 'Təkbətək söhbətlər',
    emptyList: 'Hələ fərdi çatınız yoxdur.',
    listError: 'Söhbətlər yüklənmədi',
    headerFallback: 'Fərdi çat',
    peerLabel: (item) => item?.peer_name || 'İstifadəçi',
    peerMeta: (item) =>
      item?.is_online ? (
        <span className="inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
          onlayn
        </span>
      ) : (
        <span>offlayn</span>
      ),
    headerMeta: (item) =>
      item?.is_online ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
          <span>Onlayn</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-token-textMuted/40" aria-hidden />
          <span>Offlayn</span>
        </span>
      ),
    itemKey: (item) => item.peer_id || item.room_id,
    isActive: (item, active) => String(item.peer_id) === String(active?.peer_id),
  },
  assignment: {
    sidebarTitle: 'Tapşırıq çatı',
    sidebarSubtitle: 'Tapşırıq söhbətləri',
    emptyList: 'Hələ tapşırıq çatınız yoxdur.',
    listError: 'Tapşırıqlar yüklənmədi',
    headerFallback: 'Tapşırıq çatı',
    peerLabel: (item) => item?.assignment_title || 'Tapşırıq',
    peerMeta: (item) => (
      <>
        <span>{item?.member_count ?? '—'} iştirakçı</span>
        {Number(item?.online_count) > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />
            {item.online_count} onlayn
          </span>
        ) : null}
      </>
    ),
    headerMeta: (item) => (
      <>
        <span>{item?.member_count ?? '—'} iştirakçı</span>
        {Number(item?.online_count) > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
            <span>{item.online_count} onlayn</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-token-textMuted/40" aria-hidden />
            <span>Offlayn</span>
          </span>
        )}
      </>
    ),
    itemKey: (item) => item.assignment_id,
    isActive: (item, active) => String(item.assignment_id) === String(active?.assignment_id),
  },
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
        m.body === msg?.body &&
        m.attachment_url === msg?.attachment_url
      ),
  )
  return mergeMessage(withoutPendingDupes, { ...msg, _pending: false })
}

function AttachmentBubble({ url, type, name }) {
  const resolved = resolveApiAssetUrl(url)
  if (isImageAttachment(type)) {
    return (
      <a href={resolved} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={resolved}
          alt={name || 'Şəkil'}
          className="max-w-[260px] rounded-xl border border-[color:var(--border-subtle)] object-cover"
        />
      </a>
    )
  }
  if (isPdfAttachment(type)) {
    return (
      <a
        href={resolved}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/50 px-3 py-2 text-sm text-token-textMain hover:border-primary/30 transition-colors"
      >
        <span aria-hidden>📄</span>
        <span className="truncate">{name || 'PDF fayl'}</span>
        <span className="text-xs text-token-textMuted shrink-0">Yüklə</span>
      </a>
    )
  }
  if (resolved) {
    return (
      <a href={resolved} target="_blank" rel="noopener noreferrer" className="text-sm underline mt-1 inline-block">
        {name || 'Fayl'}
      </a>
    )
  }
  return null
}

function MessageGroup({ group, currentUserId }) {
  const mine = String(group.sender_id) === String(currentUserId)

  return (
    <div className={['flex gap-2', mine ? 'flex-row-reverse' : 'flex-row'].join(' ')}>
      {!mine ? (
        <div
          className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold border border-[color:var(--border-subtle)] bg-token-surfaceCard text-token-textMain"
          aria-hidden
        >
          {initials(group.sender_name)}
        </div>
      ) : null}

      <div className={['flex flex-col gap-0.5 max-w-[min(85%,520px)]', mine ? 'items-end' : 'items-start'].join(' ')}>
        {!mine ? (
          <div className="text-[11px] font-semibold text-token-textMuted px-1 mb-0.5">
            {group.sender_name || 'İstifadəçi'}
          </div>
        ) : null}

        {group.messages.map((m) => (
          <div key={m.id} className={['group relative', mine ? 'self-end' : 'self-start'].join(' ')}>
            <div
              className={[
                'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                mine
                  ? 'bg-primary/20 border border-primary/30 text-token-textMain'
                  : 'bg-token-surfaceCard border border-[color:var(--border-subtle)] text-token-textMain',
                m._pending ? 'opacity-75' : '',
              ].join(' ')}
            >
              {m.body ? <div className="whitespace-pre-wrap break-words">{m.body}</div> : null}
              {m.attachment_url ? (
                <AttachmentBubble url={m.attachment_url} type={m.attachment_type} name={m.attachment_name} />
              ) : null}
            </div>
            <div
              className={[
                'pointer-events-none absolute -bottom-4 text-[10px] text-token-textMuted tabular-nums opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap',
                mine ? 'right-1' : 'left-1',
              ].join(' ')}
            >
              {m._pending ? 'Göndərilir…' : formatChatTime(m.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Full-panel chat workspace (group or direct) — sidebar + conversation.
 */
export default function ChatWorkspace({ role, mode = 'group' }) {
  const copy = MODE_COPY[mode] || MODE_COPY.group
  const isDirect = mode === 'direct'
  const isAssignment = mode === 'assignment'
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [room, setRoom] = useState(null)
  const [activeItem, setActiveItem] = useState(null)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState(null)
  const [emojiOpen, setEmojiOpen] = useState(false)

  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const pollRef = useRef(null)
  const previewUrlRef = useRef(null)

  const selectedGroupId = searchParams.get('groupId')
  const selectedPeerId = searchParams.get('peerId') || searchParams.get('studentId')
  const selectedPeerName = searchParams.get('peerName') || searchParams.get('studentName') || ''
  const selectedAssignmentId = searchParams.get('assignmentId')
  const selectedAssignmentTitle = searchParams.get('assignmentTitle') || ''

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

  const refreshList = useCallback(async () => {
    if (isDirect) {
      const list = await fetchChatDirects()
      setItems(list)
      return list
    }
    if (isAssignment) {
      const list = await fetchChatAssignments()
      setItems(list)
      return list
    }
    const list = await fetchChatGroups()
    setItems(list)
    return list
  }, [isDirect, isAssignment])

  const selectItem = useCallback(
    (item) => {
      if (isDirect) {
        if (!item?.peer_id) return
        setActiveItem(item)
        const next = { peerId: item.peer_id }
        if (item.peer_name) next.peerName = item.peer_name
        setSearchParams(next, { replace: true })
        return
      }
      if (isAssignment) {
        if (!item?.assignment_id) return
        setActiveItem(item)
        setSearchParams({ assignmentId: item.assignment_id }, { replace: true })
        return
      }
      if (!item?.group_id) return
      setActiveItem(item)
      setSearchParams({ groupId: item.group_id }, { replace: true })
    },
    [isDirect, isAssignment, setSearchParams],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setListLoading(true)
      setErr(null)
      try {
        const list = await refreshList()
        if (cancelled) return
        setItems(list)
      } catch (e) {
        if (!cancelled) setErr(e?.message || copy.listError)
      } finally {
        if (!cancelled) setListLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, mode, refreshList, copy.listError])

  useEffect(() => {
    if (isDirect) {
      if (!items.length && !selectedPeerId) {
        setActiveItem(null)
        return
      }
      const fromUrl = selectedPeerId ? items.find((i) => String(i.peer_id) === String(selectedPeerId)) : null
      if (fromUrl) {
        setActiveItem(fromUrl)
        return
      }
      if (selectedPeerId && role === 'instructor') {
        setActiveItem({
          peer_id: selectedPeerId,
          peer_name: selectedPeerName || 'Tələbə',
          room_id: null,
          is_online: false,
        })
        return
      }
      if (items[0]) {
        setActiveItem(items[0])
        const next = { peerId: items[0].peer_id }
        if (items[0].peer_name) next.peerName = items[0].peer_name
        setSearchParams(next, { replace: true })
      }
      return
    }

    if (isAssignment) {
      if (!items.length && !selectedAssignmentId) {
        setActiveItem(null)
        return
      }
      const fromUrl = selectedAssignmentId
        ? items.find((i) => String(i.assignment_id) === String(selectedAssignmentId))
        : null
      if (fromUrl) {
        setActiveItem(fromUrl)
        return
      }
      if (selectedAssignmentId) {
        setActiveItem({
          assignment_id: selectedAssignmentId,
          assignment_title: selectedAssignmentTitle || 'Tapşırıq',
        })
        return
      }
      if (items[0]) {
        setActiveItem(items[0])
        setSearchParams({ assignmentId: items[0].assignment_id }, { replace: true })
      }
      return
    }

    if (!items.length) {
      setActiveItem(null)
      return
    }
    const fromUrl = selectedGroupId ? items.find((g) => String(g.group_id) === String(selectedGroupId)) : null
    if (fromUrl) {
      setActiveItem(fromUrl)
      return
    }
    const first = items[0]
    setActiveItem(first)
    setSearchParams({ groupId: first.group_id }, { replace: true })
  }, [items, selectedGroupId, selectedPeerId, selectedPeerName, selectedAssignmentId, selectedAssignmentTitle, isDirect, isAssignment, role, setSearchParams])

  useEffect(() => {
    if (isDirect) {
      if (!activeItem?.peer_id) {
        setRoom(null)
        setMessages([])
        return undefined
      }

      let cancelled = false
      ;(async () => {
        setLoading(true)
        setErr(null)
        try {
          let r
          if (activeItem.room_id) {
            r = { id: activeItem.room_id, title: activeItem.peer_name }
          } else if (role === 'instructor') {
            r = await openChatRoom({
              kind: 'direct',
              student_id: activeItem.peer_id,
              student_name: activeItem.peer_name,
            })
            if (!cancelled) {
              const updated = await refreshList()
              const match = updated.find((i) => String(i.peer_id) === String(activeItem.peer_id))
              if (match) setActiveItem(match)
            }
          } else {
            throw new Error('Fərdi çat tapılmadı')
          }
          if (cancelled || !r?.id) return
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
    }

    if (isAssignment) {
      if (!activeItem?.assignment_id) {
        setRoom(null)
        setMessages([])
        return undefined
      }

      let cancelled = false
      ;(async () => {
        setLoading(true)
        setErr(null)
        try {
          const r = await openChatRoom({
            kind: 'assignment',
            assignment_id: activeItem.assignment_id,
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
    }

    if (!activeItem?.group_id) {
      setRoom(null)
      setMessages([])
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const r = await openChatRoom({ kind: 'group', group_id: activeItem.group_id })
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
  }, [isDirect, isAssignment, activeItem?.peer_id, activeItem?.room_id, activeItem?.group_id, activeItem?.assignment_id, activeItem?.peer_name, role, loadMessages, refreshList])

  useEffect(() => {
    if (!room?.id) return undefined

    const unsubscribe = subscribeChatRoom(room.id, {
      onMessage: (msg) => {
        setMessages((prev) => absorbIncomingMessage(prev, msg))
        requestAnimationFrame(() => scrollToBottom())
      },
    })

    pollRef.current = setInterval(() => {
      void loadMessages(room.id, { silent: true })
    }, POLL_MS)

    return () => {
      unsubscribe()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [room?.id, loadMessages, scrollToBottom])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    }
  }, [])

  const clearPendingFile = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPendingFile(null)
    setFileError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const onPickFile = useCallback(
    (e) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (file.size > CHAT_MAX_FILE_BYTES) {
        setFileError('Fayl 5MB-dan böyük ola bilməz')
        clearPendingFile()
        return
      }
      const mime = String(file.type || '').toLowerCase()
      if (!mime.startsWith('image/') && mime !== 'application/pdf') {
        setFileError('Yalnız şəkil və PDF qəbul olunur')
        clearPendingFile()
        return
      }
      setFileError(null)
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      const preview = mime.startsWith('image/') ? URL.createObjectURL(file) : null
      previewUrlRef.current = preview
      setPendingFile({ file, preview, name: file.name, type: mime })
    },
    [clearPendingFile],
  )

  const onSend = useCallback(
    async (e) => {
      e?.preventDefault?.()
      const body = draft.trim()
      if ((!body && !pendingFile) || !room?.id || sending) return

      const optimisticId = `optimistic-${Date.now()}`
      const optimisticMsg = {
        id: optimisticId,
        room_id: room.id,
        sender_id: user?.id,
        sender_name: user?.full_name || null,
        sender_role: user?.role || null,
        body,
        attachment_url: pendingFile?.preview || null,
        attachment_type: pendingFile?.type || null,
        attachment_name: pendingFile?.name || null,
        created_at: new Date().toISOString(),
        _pending: true,
      }

      const savedDraft = draft
      const savedFile = pendingFile
      setDraft('')
      clearPendingFile()
      setErr(null)
      setMessages((prev) => mergeMessage(prev, optimisticMsg))
      requestAnimationFrame(() => scrollToBottom())
      setSending(true)

      try {
        let attachment_url = null
        let attachment_type = null
        if (savedFile?.file) {
          const uploaded = await uploadChatAttachment(room.id, savedFile.file)
          attachment_url = uploaded?.url || null
          attachment_type = uploaded?.attachment_type || savedFile.type
        }

        const msg = await sendChatMessage(room.id, {
          body,
          attachment_url,
          attachment_type,
        })
        const serverMsg = msg?.id
          ? { ...msg, _pending: false }
          : { ...optimisticMsg, id: msg?.id || optimisticId, _pending: false }
        setMessages((prev) => mergeMessage(prev, serverMsg, optimisticId))
        requestAnimationFrame(() => scrollToBottom())
      } catch (e2) {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
        setDraft(savedDraft)
        if (savedFile) setPendingFile(savedFile)
        setErr(e2?.message || 'Göndərilmədi')
      } finally {
        setSending(false)
        inputRef.current?.focus()
      }
    },
    [draft, pendingFile, room?.id, sending, scrollToBottom, user, clearPendingFile],
  )

  const onInputKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Enter' || e.shiftKey) return
      e.preventDefault()
      void onSend(e)
    },
    [onSend],
  )

  const timeline = useMemo(() => buildChatTimeline(messages), [messages])
  const canSend = Boolean(room?.id) && !sending && (draft.trim() || pendingFile)

  return (
    <div className="flex flex-col md:flex-row h-[calc(100dvh-72px-env(safe-area-inset-top,0px))] md:h-full min-h-0 w-full max-w-full overflow-hidden rounded-none md:rounded-2xl border-0 md:border border-[color:var(--border-subtle)] bg-token-surfaceMain text-token-textMain">
      <aside className="w-full md:w-72 lg:w-80 shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-[color:var(--border-subtle)] bg-token-surfaceCard/40 min-h-0">
        <div className="px-4 py-3 border-b border-[color:var(--border-subtle)]">
          <h1 className="text-base font-bold text-token-textMain">{copy.sidebarTitle}</h1>
          <p className="text-xs text-token-textMuted mt-0.5">{copy.sidebarSubtitle}</p>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
          {listLoading ? (
            <p className="text-sm text-token-textMuted text-center py-6">Yüklənir…</p>
          ) : null}
          {!listLoading && !items.length ? (
            <p className="text-sm text-token-textMuted text-center py-6 px-3">{copy.emptyList}</p>
          ) : null}
          {items.map((item) => {
            const active = copy.isActive(item, activeItem)
            return (
              <button
                key={copy.itemKey(item)}
                type="button"
                onClick={() => selectItem(item)}
                className={[
                  'w-full text-left rounded-xl px-3 py-2.5 transition-colors border',
                  active
                    ? 'bg-primary/15 border-primary/30 text-token-textMain'
                    : 'border-transparent hover:bg-token-surfaceCard/70 text-token-textMain',
                ].join(' ')}
              >
                <div className="font-semibold text-sm truncate">{copy.peerLabel(item)}</div>
                <div className="text-[11px] text-token-textMuted mt-0.5 flex items-center gap-2">
                  {copy.peerMeta(item)}
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 px-4 py-3 border-b border-[color:var(--border-subtle)] bg-token-surfaceCard/30 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold truncate">
              {activeItem ? copy.peerLabel(activeItem) : copy.headerFallback}
            </h2>
            <div className="text-xs text-token-textMuted flex items-center gap-2 mt-0.5">
              {activeItem ? copy.headerMeta(activeItem) : null}
            </div>
          </div>
        </header>

        {err ? (
          <div className="mx-4 mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-200 px-3 py-2 text-sm">
            {err}
          </div>
        ) : null}

        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 bg-token-surfaceMain">
          {loading && !messages.length ? (
            <p className="text-sm text-token-textMuted text-center py-10">Mesajlar yüklənir…</p>
          ) : null}
          {!loading && !messages.length ? (
            <p className="text-sm text-token-textMuted text-center py-10">Hələ mesaj yoxdur. İlk mesajı siz yazın.</p>
          ) : null}

          {timeline.map((item) =>
            item.type === 'date' ? (
              <div key={item.key} className="flex justify-center">
                <span className="text-[11px] font-medium text-token-textMuted bg-token-surfaceCard/80 border border-[color:var(--border-subtle)] px-3 py-1 rounded-full">
                  {item.label}
                </span>
              </div>
            ) : (
              <MessageGroup key={item.key} group={item} currentUserId={user?.id} />
            ),
          )}
        </div>

        <form
          onSubmit={onSend}
          className="shrink-0 border-t border-[color:var(--border-subtle)] bg-token-surfaceCard/40 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          {fileError ? (
            <div className="mb-2 text-xs text-rose-600 dark:text-rose-300">{fileError}</div>
          ) : null}
          {pendingFile ? (
            <div className="mb-2 flex items-center gap-2">
              {pendingFile.preview ? (
                <img
                  src={pendingFile.preview}
                  alt=""
                  className="w-14 h-14 rounded-lg object-cover border border-[color:var(--border-subtle)]"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg border border-[color:var(--border-subtle)] flex items-center justify-center text-xl bg-token-surfaceMain">
                  📄
                </div>
              )}
              <div className="min-w-0 flex-1 text-xs text-token-textMuted truncate">{pendingFile.name}</div>
              <button
                type="button"
                onClick={clearPendingFile}
                className="text-token-textMuted hover:text-token-textMain px-2"
                aria-label="Faylı sil"
              >
                ×
              </button>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!room?.id || loading}
              className="w-10 h-10 shrink-0 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain text-token-textMain hover:border-primary/30 disabled:opacity-50 flex items-center justify-center"
              aria-label="Fayl əlavə et"
            >
              📎
            </button>

            <div className="relative flex-1 min-w-0">
              {emojiOpen ? (
                <div className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard shadow-lg z-10">
                  {EMOJI_QUICK.map((em) => (
                    <button
                      key={em}
                      type="button"
                      className="w-8 h-8 rounded-lg hover:bg-token-surfaceMain text-lg"
                      onClick={() => {
                        setDraft((d) => `${d}${em}`)
                        setEmojiOpen(false)
                        inputRef.current?.focus()
                      }}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              ) : null}
              <textarea
                ref={inputRef}
                className="w-full min-h-[44px] max-h-32 resize-y rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm text-token-textMain placeholder:text-token-textMuted outline-none focus:border-primary/40"
                placeholder="Mesaj yazın…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onInputKeyDown}
                rows={1}
                disabled={!room?.id || loading}
              />
            </div>

            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              disabled={!room?.id || loading}
              className="w-10 h-10 shrink-0 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain text-lg hover:border-primary/30 disabled:opacity-50"
              aria-label="Emoji"
            >
              😊
            </button>

            <Button type="submit" loading={sending} disabled={!canSend || loading}>
              Göndər
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
