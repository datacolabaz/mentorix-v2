import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api, { AUTH_REQUEST_TIMEOUT_MS } from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { fmtAzBakuField } from '../../lib/azDatetime'

function fmtDuration(minutes, t) {
  const m = Number(minutes) || 0
  if (m < 60) return `${m} ${t('live.minuteShort')}`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest
    ? t('live.hourFormat', { h, m: String(rest).padStart(2, '0') })
    : `${h} ${t('live.hourShort')}`
}

function fmtRecordingDuration(totalSec) {
  const s = Math.max(0, Number(totalSec) || 0)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

async function downloadRecording(url, filename) {
  const blob = await api.get(url, {
    responseType: 'blob',
    timeout: AUTH_REQUEST_TIMEOUT_MS,
  })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export default function InstructorLiveHistory() {
  const { t } = useTranslation()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [sharingId, setSharingId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const selectAllRef = useRef(null)

  const selectedCount = selectedIds.length
  const allSelected = sessions.length > 0 && selectedCount === sessions.length
  const someSelected = selectedCount > 0 && !allSelected

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/live/history')
      setSessions(Array.isArray(res.sessions) ? res.sessions : [])
    } catch {
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => sessions.some((s) => s.id === id)))
  }, [sessions])

  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : sessions.map((s) => s.id))
  }

  const handleDownload = async (session) => {
    if (!session?.recording_url) return
    setDownloadingId(session.id)
    try {
      await downloadRecording(session.recording_url, `mentorix-${session.room_code || 'ders'}.webm`)
      toast(t('live.downloadOk'))
    } catch {
      toast(t('live.downloadFailed'), 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleShare = async (session) => {
    if (!session?.has_recording) {
      toast(t('live.shareNoRecording'), 'info')
      return
    }
    setSharingId(session.id)
    try {
      let shareUrl = session.share_url
      if (!shareUrl) {
        const res = await api.get('/live/history')
        const fresh = (res.sessions || []).find((s) => s.id === session.id)
        shareUrl = fresh?.share_url || null
      }
      if (!shareUrl) {
        toast('Paylaşım linki yaradıla bilmədi', 'error')
        return
      }
      const url = `${window.location.origin}${shareUrl}`
      try {
        await navigator.clipboard.writeText(url)
        toast(t('live.shareCopied'))
      } catch {
        window.prompt('Paylaşım linkini kopyalayın:', url)
      }
    } catch (e) {
      toast(e?.message || t('live.shareFailed'), 'error')
    } finally {
      setSharingId(null)
    }
  }

  const handleDelete = async (session) => {
    if (!session?.room_code) return
    const ok = window.confirm(t('live.confirmDeleteOne', { title: session.title }))
    if (!ok) return
    setDeletingId(session.id)
    try {
      await api.delete(`/live/history/${encodeURIComponent(session.room_code)}`)
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
      setSelectedIds((prev) => prev.filter((id) => id !== session.id))
      toast(t('live.deletedOne'))
    } catch (e) {
      toast(e?.message || t('live.deleteFailed'), 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedCount) return
    const selected = sessions.filter((s) => selectedIds.includes(s.id))
    const ok = window.confirm(t('live.confirmDeleteMany', { n: selected.length }))
    if (!ok) return
    setBulkDeleting(true)
    try {
      const results = await Promise.allSettled(
        selected.map((s) => api.delete(`/live/history/${encodeURIComponent(s.room_code)}`)),
      )
      const deletedIds = []
      let failed = 0
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') deletedIds.push(selected[i].id)
        else failed += 1
      })
      setSessions((prev) => prev.filter((s) => !deletedIds.includes(s.id)))
      setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)))
      if (failed === 0) toast(t('live.bulkDeleted', { n: deletedIds.length }))
      else if (deletedIds.length === 0) toast(t('live.bulkNone'), 'error')
      else toast(t('live.bulkPartial', { ok: deletedIds.length, fail: failed }), 'info')
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">{t('live.historyTitle')}</h1>
          <p className="text-xs text-token-textMuted mt-1">{t('live.historySubtitle')}</p>
        </div>
        <Link to="/instructor/teaching-groups">
          <Button variant="secondary">{t('live.startFromGroup')}</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-token-textMuted py-12 text-center">{t('live.loading')}</p>
      ) : !sessions.length ? (
        <Card className="p-10 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">🔴</div>
          <p className="text-sm text-token-textMuted">{t('live.noSessions')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <label className="flex items-center gap-2 text-sm text-token-textMuted cursor-pointer select-none">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={allSelected}
                onChange={toggleAll}
              />
              {t('live.selectAll')}
              {selectedCount > 0 ? (
                <span className="text-token-textMain font-medium">({selectedCount})</span>
              ) : null}
            </label>
            {selectedCount > 0 ? (
              <Button
                size="sm"
                variant="danger"
                loading={bulkDeleting}
                onClick={() => void handleBulkDelete()}
              >
                {t('live.deleteSelected')} ({selectedCount})
              </Button>
            ) : null}
          </div>

          {sessions.map((s) => (
            <Card
              key={s.id}
              className={`p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                selectedIds.includes(s.id)
                  ? 'border-primary/40 bg-primary/[0.04]'
                  : 'border-[color:var(--border-subtle)]'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <label className="shrink-0 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => toggleOne(s.id)}
                  />
                </label>
                <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-sm text-token-textMain truncate">{s.title}</h2>
                <p className="text-[11px] text-token-textMuted mt-1">
                  {s.group_name || t('live.general')}
                  {s.started_at ? ` · ${fmtAzBakuField(s, 'started_at')}` : ''}
                </p>
                {s.recorded_by_name ? (
                  <p className="text-[10px] text-primary/80 mt-1">{t('live.recordingBy')} {s.recorded_by_name}</p>
                ) : null}
                {s.guests?.length ? (
                  <ul className="text-[10px] text-token-textMuted mt-2 space-y-0.5">
                    <li className="font-semibold text-gray-500">{t('live.guestParticipants')}</li>
                    {s.guests.map((g) => (
                      <li key={g.id}>
                        👤 {g.full_name}{' '}
                        <span className="text-gray-500">({t('live.guestLabel')})</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                </div>
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-token-textMuted sm:justify-end">
                  <span>{fmtDuration(s.duration_minutes, t)}</span>
                  <span>{s.participant_count || 0} {t('live.participants')}</span>
                  {s.guest_count ? (
                    <span className="text-gray-500">· {s.guest_count} {t('live.guestLabel').toLowerCase()}</span>
                  ) : null}
                  <span className="font-mono text-primary/80">{s.room_code}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {s.has_recording ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={downloadingId === s.id}
                      onClick={() => void handleDownload(s)}
                    >
                      ⬇ {t('live.downloadRecording')}
                      {s.recording_duration_sec ? ` (${fmtRecordingDuration(s.recording_duration_sec)})` : ''}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-token-textMuted/80 px-1">{t('live.noRecording')}</span>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!s.has_recording}
                    loading={sharingId === s.id}
                    onClick={() => void handleShare(s)}
                  >
                    🔗 {t('live.share')}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={deletingId === s.id}
                    onClick={() => void handleDelete(s)}
                  >
                    🗑 {t('common.delete')}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
