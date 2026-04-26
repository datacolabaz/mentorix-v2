import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import FilterTabs from '../../components/common/FilterTabs'
import NotificationCard from '../../components/notifications/NotificationCard'
import StatusBadge from '../../components/common/StatusBadge'
import { smsHistoryMock, isToday, isThisWeek } from '../../mock/smsHistory'

const SEEN_KEY = 'mx_instructor_notifications_seen_at_v1'

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
  const [tab, setTab] = useState('all') // all | sms
  const [smsFilter, setSmsFilter] = useState('today') // today | week | failed | scheduled
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsItem, setDetailsItem] = useState(null)
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsErr, setSmsErr] = useState(null)
  const [smsDbItems, setSmsDbItems] = useState([])

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()))
    } catch {}
  }, [])

  useEffect(() => {
    if (tab !== 'sms') return
    let cancelled = false
    setSmsLoading(true)
    setSmsErr(null)
    api
      .get('/notifications/instructor/sms-history?limit=120')
      .then((d) => {
        if (cancelled) return
        setSmsDbItems(Array.isArray(d.items) ? d.items : [])
      })
      .catch((e) => {
        if (!cancelled) {
          setSmsDbItems([])
          setSmsErr(e?.message || 'SMS tarixçə yüklənmədi')
        }
      })
      .finally(() => {
        if (!cancelled) setSmsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab])

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

  const smsRows = useMemo(() => {
    const now = new Date()
    const base = Array.isArray(smsDbItems) && smsDbItems.length ? smsDbItems : smsHistoryMock
    const list = Array.isArray(base) ? base : []
    const filtered = list.filter((x) => {
      if (smsFilter === 'today') return isToday(x.createdAt, now)
      if (smsFilter === 'week') return isThisWeek(x.createdAt, now)
      if (smsFilter === 'failed') return x.status === 'failed'
      if (smsFilter === 'scheduled') return x.status === 'scheduled'
      return true
    })
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [smsFilter, smsDbItems])

  const smsSummary = useMemo(() => {
    const base = Array.isArray(smsDbItems) && smsDbItems.length ? smsDbItems : smsHistoryMock
    const list = Array.isArray(base) ? base : []
    const sent = list.filter((x) => x.status === 'sent')
    const failed = list.filter((x) => x.status === 'failed')
    const scheduled = list.filter((x) => x.status === 'scheduled')
    const uniq = new Set(
      list.flatMap((x) => (Array.isArray(x.students) ? x.students : x.phone ? [x.phone] : []))
    )
    return {
      totalMessages: list.length,
      totalRecipients: uniq.size,
      sent: sent.length,
      failed: failed.length,
      scheduled: scheduled.length,
    }
  }, [smsDbItems])

  const tabItems = useMemo(
    () => [
      { id: 'all', label: 'Bütün bildirişlər' },
      { id: 'sms', label: 'SMS tarixçəsi' },
    ],
    []
  )

  const smsTabs = useMemo(() => {
    const now = new Date()
    const list = Array.isArray(smsHistoryMock) ? smsHistoryMock : []
    const today = list.filter((x) => isToday(x.createdAt, now)).length
    const week = list.filter((x) => isThisWeek(x.createdAt, now)).length
    const failed = list.filter((x) => x.status === 'failed').length
    const scheduled = list.filter((x) => x.status === 'scheduled').length
    return [
      { id: 'today', label: 'Bu gün', count: today },
      { id: 'week', label: 'Bu həftə', count: week },
      { id: 'failed', label: 'Uğursuz', count: failed },
      { id: 'scheduled', label: 'Planlaşdırılıb', count: scheduled },
    ]
  }, [])

  const openDetails = (item) => {
    setDetailsItem(item)
    setDetailsOpen(true)
  }

  const detailsStatus = detailsItem?.status
  const detailsBadge =
    detailsStatus === 'failed' ? 'danger' : detailsStatus === 'scheduled' ? 'due' : 'paid'
  const detailsLabel =
    detailsStatus === 'failed' ? 'Alınmadı' : detailsStatus === 'scheduled' ? 'Planlaşdırılıb' : 'Göndərildi'

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl break-words">Bildirişlər</h1>
        <p className="text-token-textMuted text-sm mt-1">SMS və saxlama limitləri</p>
      </div>

      <div className="mb-4">
        <FilterTabs tabs={tabItems} activeId={tab} onChange={(id) => setTab(id)} />
      </div>

      {tab === 'sms' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base text-token-textMain">SMS tarixçəsi</h2>
              <p className="text-xs text-token-textMuted mt-1">
                Ödəniş xatırlatma mesajlarının göndərilmə statusu və qısa preview.
              </p>
              {smsLoading ? (
                <p className="text-xs text-token-textMuted mt-2">Tarixçə yüklənir…</p>
              ) : smsErr ? (
                <p className="text-xs text-amber-600 dark:text-amber-200/90 mt-2">{smsErr} (mock göstərilir)</p>
              ) : smsDbItems.length ? (
                <p className="text-xs text-token-textMuted mt-2">Mənbə: DB (sms_logs)</p>
              ) : (
                <p className="text-xs text-token-textMuted mt-2">Mənbə: mock</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-token-surfaceCard/50 px-3 py-1.5 text-[11px] text-token-textMain">
                  <span className="text-token-textMuted">SMS:</span>
                  <span className="font-semibold tabular-nums">{smsSummary.totalMessages}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-token-surfaceCard/50 px-3 py-1.5 text-[11px] text-token-textMain">
                  <span className="text-token-textMuted">Tələbə:</span>
                  <span className="font-semibold tabular-nums">{smsSummary.totalRecipients}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-200/90">
                  Göndərildi <span className="font-bold tabular-nums">{smsSummary.sent}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-700 dark:text-rose-200/90">
                  Alınmadı <span className="font-bold tabular-nums">{smsSummary.failed}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-200/90">
                  Plan <span className="font-bold tabular-nums">{smsSummary.scheduled}</span>
                </span>
              </div>
            </div>
            <div className="shrink-0">
              <FilterTabs tabs={smsTabs} activeId={smsFilter} onChange={(id) => setSmsFilter(id)} />
            </div>
          </div>

          {!smsRows.length ? (
            <Card className="p-8 sm:p-10 text-center">
              <div className="text-3xl mb-3">📭</div>
              <div className="text-sm font-semibold text-token-textMain">Bu filter üçün SMS yoxdur</div>
              <p className="text-xs text-token-textMuted mt-1">Filteri dəyişin və ya yeni SMS göndərin.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {smsRows.slice(0, 12).map((item) => (
                <NotificationCard key={item.id} item={item} onDetails={openDetails} />
              ))}
            </div>
          )}

          <Modal
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            title="SMS detalları"
            size="md"
          >
            {detailsItem ? (
              <div className="space-y-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-token-textMain">Ödəniş xatırlatma göndərildi</p>
                    <p className="text-xs text-token-textMuted mt-1">
                      {new Date(detailsItem.createdAt).toLocaleString('az-AZ')}
                    </p>
                  </div>
                  <StatusBadge variant={detailsBadge}>{detailsLabel}</StatusBadge>
                </div>
                {detailsItem.status === 'failed' && detailsItem.reason ? (
                  <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-200/90 uppercase tracking-wider mb-2">
                      Səbəb
                    </p>
                    <p className="text-sm text-token-textMain leading-relaxed">{detailsItem.reason}</p>
                  </div>
                ) : null}
                <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/40 p-3">
                  <p className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Tələbələr</p>
                  <p className="text-sm text-token-textMain leading-relaxed">
                    {(detailsItem.students || []).join(', ') || '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/40 p-3">
                  <p className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Mesaj</p>
                  <p className="text-sm text-token-textMain leading-relaxed">{detailsItem.message || '—'}</p>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="secondary" onClick={() => setDetailsOpen(false)}>
                    Bağla
                  </Button>
                </div>
              </div>
            ) : null}
          </Modal>
        </div>
      ) : loading ? (
        <div className="text-center py-12 text-token-textMuted">Yüklənir...</div>
      ) : alerts.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-display font-bold text-lg text-token-textMain break-words px-2">
            Hər şey qaydasındadır
          </div>
          <p className="text-token-textMuted text-sm mt-2 px-2">
            Limitləriniz 80%-dən çox dolmayıb
          </p>
          {profile ? (
            <div className="mt-6 text-left">
              <div className="space-y-5">
                {/* SMS */}
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-x-4 gap-y-2">
                  <div className="text-sm text-token-textMain">SMS</div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${profile.sms_percent >= 100 ? 'bg-red-500' : profile.sms_percent >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Number(profile.sms_percent || 0))}%` }}
                    />
                  </div>
                  <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
                    {profile.sms_used}/{profile.sms_limit}
                  </div>
                </div>

                {/* Storage */}
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-x-4 gap-y-2">
                  <div className="text-sm text-token-textMain">Storage</div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${profile.storage_percent >= 100 ? 'bg-red-500' : profile.storage_percent >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Number(profile.storage_percent || 0))}%` }}
                    />
                  </div>
                  <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
                    {formatStorageUsed(profile.storage_used_bytes)} / {formatBytesLimitFromMb(profile.storage_limit_mb)}
                  </div>
                </div>

                {/* RAM */}
                <div className="grid grid-cols-[72px_1fr_auto] items-center gap-x-4 gap-y-2">
                  <div className="text-sm text-token-textMain">RAM</div>
                  <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${profile.ram_percent >= 100 ? 'bg-red-500' : profile.ram_percent >= 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Number(profile.ram_percent || 0))}%` }}
                    />
                  </div>
                  <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
                    {formatMbValue(profile.ram_used_mb)} / {formatMbValue(profile.ram_limit_mb)}
                  </div>
                </div>
              </div>

              <div className="text-xs text-token-textMuted mt-4 tabular-nums">
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