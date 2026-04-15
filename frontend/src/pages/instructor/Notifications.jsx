import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const LEVEL = {
  critical: { cls: 'border-red-500/40 bg-red-500/10', badge: 'bg-red-500/20 text-red-400', icon: '🔴' },
  warning: { cls: 'border-yellow-500/40 bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-400', icon: '🟡' },
}

function formatStorageUsed(usedBytes) {
  const b = Number(usedBytes) || 0
  if (b <= 0) return '0 KB'
  const kb = b / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = b / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

function formatBytesLimitFromMb(limitMb) {
  const mb = Number(limitMb) || 0
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function formatMbValue(mb) {
  const m = Number(mb) || 0
  if (m >= 1024) return `${(m / 1024).toFixed(1)} GB`
  return `${m} MB`
}

function formatAgo(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s əvvəl`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}dəq əvvəl`
  const h = Math.floor(m / 60)
  return `${h}saat əvvəl`
}

export default function InstructorNotifications() {
  const [alerts, setAlerts] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    let cancelled = false
    api
      .get('/notifications/instructor')
      .then((d) => {
        if (!cancelled) {
          setAlerts(d.alerts || [])
          setProfile(d.profile || null)
          setFetchedAt(new Date())
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAlerts([])
          setProfile(null)
          setFetchedAt(new Date())
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const syncInfo = useMemo(() => {
    const syncAt = profile?.usage_synced_at ? new Date(profile.usage_synced_at) : null
    const pageAt = fetchedAt ? new Date(fetchedAt) : null
    const diffMs = syncAt && pageAt ? Math.abs(pageAt.getTime() - syncAt.getTime()) : null
    return { syncAt, pageAt, diffMs }
  }, [profile?.usage_synced_at, fetchedAt, nowTick])

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl break-words">Bildirişlər</h1>
        <p className="text-gray-400 text-sm mt-1">SMS və saxlama limitləri</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Yüklənir...</div>
      ) : alerts.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-display font-bold text-lg text-white break-words px-2">
            Hər şey qaydasındadır
          </div>
          <p className="text-gray-400 text-sm mt-2 px-2">
            Limitləriniz 80%-dən çox dolmayıb
          </p>
          {profile ? (
            <div className="mt-6 text-left">
              <div className="space-y-5">
                {/* SMS */}
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-x-4 gap-y-2">
                  <div className="text-sm text-gray-300">SMS</div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${profile.sms_percent >= 100 ? 'bg-red-500' : profile.sms_percent >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Number(profile.sms_percent || 0))}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-400 tabular-nums text-right whitespace-nowrap">
                    {profile.sms_used}/{profile.sms_limit}
                  </div>
                </div>

                {/* Storage */}
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-x-4 gap-y-2">
                  <div className="text-sm text-gray-300">Storage</div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${profile.storage_percent >= 100 ? 'bg-red-500' : profile.storage_percent >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Number(profile.storage_percent || 0))}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-400 tabular-nums text-right whitespace-nowrap">
                    {formatStorageUsed(profile.storage_used_bytes)} / {formatBytesLimitFromMb(profile.storage_limit_mb)}
                  </div>
                </div>

                {/* RAM */}
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-x-4 gap-y-2">
                  <div className="text-sm text-gray-300">RAM</div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${profile.ram_percent >= 100 ? 'bg-red-500' : profile.ram_percent >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Number(profile.ram_percent || 0))}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-400 tabular-nums text-right whitespace-nowrap">
                    {formatMbValue(profile.ram_used_mb)} / {formatMbValue(profile.ram_limit_mb)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-4 tabular-nums">
                <div>
                  Son sync: {syncInfo.syncAt ? syncInfo.syncAt.toLocaleString() : '—'}
                  {syncInfo.syncAt ? ` (${formatAgo(nowTick - syncInfo.syncAt.getTime())})` : ''}
                </div>
                <div>
                  Səhifə: {syncInfo.pageAt ? syncInfo.pageAt.toLocaleString() : '—'}
                  {syncInfo.pageAt ? ` (${formatAgo(nowTick - syncInfo.pageAt.getTime())})` : ''}
                </div>
                <div>
                  Fərq: {syncInfo.diffMs == null ? '—' : formatAgo(syncInfo.diffMs)}
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {alerts.map((alert, i) => (
            <div key={i} className={`border rounded-2xl p-4 sm:p-5 ${LEVEL[alert.level].cls}`}>
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <span className="text-2xl shrink-0">{LEVEL[alert.level].icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold mb-2 ${LEVEL[alert.level].badge}`}>
                    {alert.level === 'critical' ? 'Kritik' : 'Xəbərdarlıq'}
                  </span>
                  <p className="text-gray-300 text-sm break-words">{alert.message}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    {alert.type === 'sms' ? '📱 SMS' : alert.type === 'ram' ? '🧠 RAM' : '💾 Storage'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
