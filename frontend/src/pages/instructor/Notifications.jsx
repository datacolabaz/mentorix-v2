import { useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import FilterTabs from '../../components/common/FilterTabs'
import NotificationCard from '../../components/notifications/NotificationCard'
import StatusBadge from '../../components/common/StatusBadge'
import { isToday, isThisWeek } from '../../mock/smsHistory'

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
  const [tab, setTab] = useState('all') // all | sms
  const [smsFilter, setSmsFilter] = useState('today') // today | week | failed | scheduled
  const [smsTypeTab, setSmsTypeTab] = useState('payment') // payment | otp
  const [smsTypeFilter, setSmsTypeFilter] = useState('payment') // all | payment | otp
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsItem, setDetailsItem] = useState(null)
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsErr, setSmsErr] = useState(null)
  const [smsDbItems, setSmsDbItems] = useState([])
  const [smsShowCount, setSmsShowCount] = useState(20)
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('')

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
      .get('/sms-logs?limit=200')
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
    if (tab !== 'sms') return
    setSmsShowCount(20)
  }, [tab, smsFilter, smsTypeTab, smsTypeFilter])

  const smsBaseList = useMemo(() => {
    return Array.isArray(smsDbItems) ? smsDbItems : []
  }, [smsDbItems])

  // Keep the extra type filter aligned with the active type tab to avoid
  // "empty" state when a user selects conflicting controls (e.g. OTP tab + Ödəniş filter).
  useEffect(() => {
    setSmsTypeFilter((prev) => {
      if (prev === 'all') return prev
      return smsTypeTab === 'otp' ? 'otp' : 'payment'
    })
  }, [smsTypeTab])

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
    if (!fetchedAt) return
    try {
      setLastUpdatedLabel(formatAgo(Date.now() - new Date(fetchedAt).getTime()))
    } catch {
      setLastUpdatedLabel('')
    }
  }, [fetchedAt])

  const systemPercent = {
    sms: Number(profile?.sms_percent ?? 0) || 0,
    storage: Number(profile?.storage_percent ?? 0) || 0,
    ram: Number(profile?.ram_percent ?? 0) || 0,
  }

  const usageTone = (pct) => {
    const p = Number(pct) || 0
    if (p >= 100) return 'danger'
    if (p >= 80) return 'due'
    return 'paid'
  }

  const barTone = (pct) => {
    const p = Number(pct) || 0
    if (p >= 100) return 'bg-rose-500'
    if (p >= 80) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const smsRows = useMemo(() => {
    const now = new Date()
    const filtered = smsBaseList.filter((x) => {
      if (smsFilter === 'today') return isToday(x.createdAt, now)
      if (smsFilter === 'week') return isThisWeek(x.createdAt, now)
      if (smsFilter === 'failed') return x.status === 'failed'
      if (smsFilter === 'scheduled') return x.status === 'scheduled'
      return true
    })
    const typed = filtered.filter((x) => {
      const t = String(x.type || 'payment_reminder')
      if (smsTypeTab === 'otp') return t === 'otp'
      return t !== 'otp'
    })
    const byExtraFilter = typed.filter((x) => {
      const t = String(x.type || 'payment_reminder')
      if (smsTypeFilter === 'all') return true
      if (smsTypeFilter === 'otp') return t === 'otp'
      return t !== 'otp'
    })
    return byExtraFilter.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [smsFilter, smsBaseList, smsTypeTab, smsTypeFilter])

  const smsSummary = useMemo(() => {
    const sent = smsBaseList.filter((x) => x.status === 'sent')
    const failed = smsBaseList.filter((x) => x.status === 'failed')
    const scheduled = smsBaseList.filter((x) => x.status === 'scheduled')
    const uniq = new Set(
      smsBaseList.flatMap((x) => (Array.isArray(x.students) ? x.students : x.phone ? [x.phone] : []))
    )
    return {
      totalMessages: smsBaseList.length,
      totalRecipients: uniq.size,
      sent: sent.length,
      failed: failed.length,
      scheduled: scheduled.length,
    }
  }, [smsBaseList])

  const smsTypeTabs = useMemo(
    () => [
      { id: 'payment', label: 'Ödəniş mesajları' },
      { id: 'otp', label: 'Sistem mesajları (OTP)' },
    ],
    []
  )

  const smsTypeFilters = useMemo(
    () => [
      { id: 'all', label: 'Hamısı' },
      { id: 'payment', label: 'Ödəniş' },
      { id: 'otp', label: 'OTP' },
    ],
    []
  )

  const tabItems = useMemo(
    () => [
      { id: 'all', label: 'Bütün bildirişlər' },
      { id: 'sms', label: 'SMS tarixçəsi' },
    ],
    []
  )

  const smsTabs = useMemo(() => {
    const now = new Date()
    const scope = smsBaseList.filter((x) => {
      const t = String(x.type || 'payment_reminder')
      if (smsTypeTab === 'otp') return t === 'otp'
      return t !== 'otp'
    })
    const today = scope.filter((x) => isToday(x.createdAt, now)).length
    const week = scope.filter((x) => isThisWeek(x.createdAt, now)).length
    const failed = scope.filter((x) => x.status === 'failed').length
    const scheduled = scope.filter((x) => x.status === 'scheduled').length
    return [
      { id: 'today', label: 'Bu gün', count: today },
      { id: 'week', label: 'Bu həftə', count: week },
      { id: 'failed', label: 'Uğursuz', count: failed },
      { id: 'scheduled', label: 'Planlaşdırılıb', count: scheduled },
    ]
  }, [smsBaseList, smsTypeTab])

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

      <Card hover className="p-5 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard shadow-[0_10px_30px_rgba(0,0,0,0.10)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-base text-token-textMain">Sistem vəziyyəti</h2>
            <p className="text-xs text-token-textMuted mt-1">
              {lastUpdatedLabel ? `Son yenilənmə: ${lastUpdatedLabel}` : '—'}
            </p>
          </div>
          <StatusBadge variant={usageTone(Math.max(systemPercent.sms, systemPercent.storage, systemPercent.ram))}>
            {Math.max(systemPercent.sms, systemPercent.storage, systemPercent.ram) >= 80 ? 'Diqqət' : 'Stabil'}
          </StatusBadge>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-[92px_1fr_auto] items-center gap-x-4 gap-y-2">
            <div className="text-sm font-semibold text-token-textMain">SMS</div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full ${barTone(systemPercent.sms)}`} style={{ width: `${Math.min(100, systemPercent.sms)}%` }} />
            </div>
            <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
              {profile?.sms_used ?? 0}/{profile?.sms_limit ?? 0}
            </div>
          </div>

          <div className="grid grid-cols-[92px_1fr_auto] items-center gap-x-4 gap-y-2">
            <div className="text-sm font-semibold text-token-textMain">Storage</div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full ${barTone(systemPercent.storage)}`} style={{ width: `${Math.min(100, systemPercent.storage)}%` }} />
            </div>
            <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
              {formatStorageUsed(profile?.storage_used_bytes)} / {formatBytesLimitFromMb(profile?.storage_limit_mb)}
            </div>
          </div>

          <div className="grid grid-cols-[92px_1fr_auto] items-center gap-x-4 gap-y-2">
            <div className="text-sm font-semibold text-token-textMain">RAM</div>
            <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div className={`h-full ${barTone(systemPercent.ram)}`} style={{ width: `${Math.min(100, systemPercent.ram)}%` }} />
            </div>
            <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
              {formatMbValue(profile?.ram_used_mb)} / {formatMbValue(profile?.ram_limit_mb)}
            </div>
          </div>
        </div>
      </Card>

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
                <p className="text-xs text-amber-600 dark:text-amber-200/90 mt-2">{smsErr}</p>
              ) : (
                <p className="text-xs text-token-textMuted mt-2">Mənbə: sistem logları</p>
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <FilterTabs tabs={smsTypeTabs} activeId={smsTypeTab} onChange={(id) => setSmsTypeTab(id)} />
            <div className="sm:shrink-0">
              <FilterTabs tabs={smsTypeFilters} activeId={smsTypeFilter} onChange={(id) => setSmsTypeFilter(id)} />
            </div>
          </div>

          {!smsRows.length ? (
            <Card className="p-8 sm:p-10 text-center">
              <div className="text-3xl mb-3">📭</div>
              <div className="text-sm font-semibold text-token-textMain">
                {smsErr ? 'SMS tarixçəsi yüklənmədi' : 'Bu filter üçün SMS yoxdur'}
              </div>
              <p className="text-xs text-token-textMuted mt-1">
                {smsErr ? 'Bir az sonra yenidən yoxlayın.' : 'Filteri dəyişin və ya yeni SMS göndərin.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-token-textMuted">
                  Göstərilir: <span className="text-token-textMain font-semibold tabular-nums">{Math.min(smsRows.length, smsShowCount)}</span> /{' '}
                  <span className="text-token-textMain font-semibold tabular-nums">{smsRows.length}</span>
                </div>
                {smsShowCount < smsRows.length ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:text-primary/90"
                    onClick={() => setSmsShowCount((n) => Math.min(smsRows.length, n + 20))}
                  >
                    Daha çox göstər
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {smsRows.slice(0, smsShowCount).map((item) => (
                  <NotificationCard key={item.id} item={item} onDetails={openDetails} />
                ))}
              </div>
              {smsShowCount < smsRows.length ? (
                <div className="flex justify-center pt-1">
                  <Button variant="secondary" size="sm" onClick={() => setSmsShowCount((n) => Math.min(smsRows.length, n + 40))}>
                    Daha çox yüklə
                  </Button>
                </div>
              ) : null}
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
                    <p className="font-semibold text-token-textMain">
                      {String(detailsItem.type || 'payment_reminder') === 'otp' ? 'PIN kod göndərildi' : 'Ödəniş xatırlatma göndərildi'}
                    </p>
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