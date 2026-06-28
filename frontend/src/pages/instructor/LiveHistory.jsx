import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { fmtAzBakuField } from '../../lib/azDatetime'

function fmtDuration(minutes) {
  const m = Number(minutes) || 0
  if (m < 60) return `${m} dəq`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h}:${String(rest).padStart(2, '0')}` : `${h} saat`
}

export default function InstructorLiveHistory() {
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState([])

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

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Canlı dərslər</h1>
          <p className="text-xs text-token-textMuted mt-1">Keçmiş Mentorix Live sessiyaları</p>
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
              <div className="min-w-0">
                <h2 className="font-semibold text-sm text-token-textMain truncate">{s.title}</h2>
                <p className="text-[11px] text-token-textMuted mt-1">
                  {s.group_name || 'Ümumi'}
                  {s.started_at ? ` · ${fmtAzBakuField(s, 'started_at')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-token-textMuted shrink-0">
                <span>{fmtDuration(s.duration_minutes)}</span>
                <span>{s.participant_count || 0} iştirakçı</span>
                <span className="font-mono text-primary/80">{s.room_code}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
