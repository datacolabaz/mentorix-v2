import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api, { AUTH_REQUEST_TIMEOUT_MS } from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { fmtAzBakuField } from '../../lib/azDatetime'

function fmtDuration(minutes) {
  const m = Number(minutes) || 0
  if (m < 60) return `${m} dəq`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}:${String(rest).padStart(2, '0')}` : `${h} saat`
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
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])
  const [downloadingId, setDownloadingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [sharingId, setSharingId] = useState(null)

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

  const handleDownload = async (session) => {
    if (!session?.recording_url) return
    setDownloadingId(session.id)
    try {
      await downloadRecording(session.recording_url, `mentorix-${session.room_code || 'ders'}.webm`)
      toast('Yazı yükləndi')
    } catch {
      toast('Yazı yüklənmədi', 'error')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleShare = async (session) => {
    if (!session?.has_recording) {
      toast('Bu dərsin yazısı yoxdur', 'info')
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
        toast('Paylaşım linki kopyalandı')
      } catch {
        window.prompt('Paylaşım linkini kopyalayın:', url)
      }
    } catch (e) {
      toast(e?.message || 'Paylaşım alınmadı', 'error')
    } finally {
      setSharingId(null)
    }
  }

  const handleDelete = async (session) => {
    if (!session?.room_code) return
    const ok = window.confirm(`«${session.title}» dərsini silmək istəyirsiniz? Yazı da silinəcək.`)
    if (!ok) return
    setDeletingId(session.id)
    try {
      await api.delete(`/live/history/${encodeURIComponent(session.room_code)}`)
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
      toast('Dərs silindi')
    } catch (e) {
      toast(e?.message || 'Silinmədi', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Canlı dərslər</h1>
          <p className="text-xs text-token-textMuted mt-1">Keçmiş Mentorix Live sessiyaları və yazılar</p>
        </div>
        <Link to="/instructor/teaching-groups">
          <Button variant="secondary">Qrupdan başlat</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-token-textMuted py-12 text-center">Yüklənir…</p>
      ) : !sessions.length ? (
        <Card className="p-10 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">🔴</div>
          <p className="text-sm text-token-textMuted">Hələ canlı dərs yoxdur</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="p-4 border border-[color:var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-sm text-token-textMain truncate">{s.title}</h2>
                <p className="text-[11px] text-token-textMuted mt-1">
                  {s.group_name || 'Ümumi'}
                  {s.started_at ? ` · ${fmtAzBakuField(s, 'started_at')}` : ''}
                </p>
                {s.recorded_by_name ? (
                  <p className="text-[10px] text-primary/80 mt-1">Yazı: {s.recorded_by_name}</p>
                ) : null}
              </div>

              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-token-textMuted sm:justify-end">
                  <span>{fmtDuration(s.duration_minutes)}</span>
                  <span>{s.participant_count || 0} iştirakçı</span>
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
                      ⬇ Yazı
                      {s.recording_duration_sec ? ` (${fmtRecordingDuration(s.recording_duration_sec)})` : ''}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-token-textMuted/80 px-1">Yazı yoxdur</span>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!s.has_recording}
                    loading={sharingId === s.id}
                    onClick={() => void handleShare(s)}
                  >
                    🔗 Paylaş
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={deletingId === s.id}
                    onClick={() => void handleDelete(s)}
                  >
                    🗑 Sil
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
