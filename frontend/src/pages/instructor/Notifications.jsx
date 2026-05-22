import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import FilterTabs from '../../components/common/FilterTabs'
import NotificationCard from '../../components/notifications/NotificationCard'
import StatusBadge from '../../components/common/StatusBadge'
import { isToday, isThisWeek, isThisMonth } from '../../mock/smsHistory'
import { useBillingStatus } from '../../hooks/useBillingStatus'
import useUiStore from '../../hooks/useUi'

const SEEN_KEY = 'mx_instructor_notifications_seen_at_v1'

function alertLevelStyles(theme) {
  const light = theme !== 'dark'
  return {
    critical: {
      cls: light ? 'border-red-500/35 bg-red-50' : 'border-red-500/40 bg-red-500/10',
      badge: light ? 'bg-red-100 text-red-800' : 'bg-red-500/20 text-red-400',
      icon: '🔴',
    },
    warning: {
      cls: light ? 'border-amber-500/35 bg-amber-50' : 'border-yellow-500/40 bg-yellow-500/10',
      badge: light ? 'bg-amber-100 text-amber-900' : 'bg-yellow-500/20 text-yellow-400',
      icon: '🟡',
    },
  }
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

function formatStorageUsedFromMb(mb) {
  const m = Number(mb) || 0
  if (m <= 0) return '0 KB'
  if (m < 1) return `${Math.max(1, Math.round(m * 1024))} KB`
  return formatMbValue(m)
}

function normPhoneDigits(v) {
  return String(v || '').replace(/\D/g, '')
}

/** +994 / 0 prefiks fərqlərini nəzərə alır (Ödənişlər ilə eyni məntiq) */
function phonesMatch(a, b) {
  const da = normPhoneDigits(a)
  const db = normPhoneDigits(b)
  if (!da || !db) return false
  if (da === db) return true
  const core = (d) => {
    let x = d
    if (x.startsWith('994')) x = x.slice(3)
    if (x.startsWith('0')) x = x.slice(1)
    return x
  }
  const ca = core(da)
  const cb = core(db)
  if (ca && cb && ca === cb) return true
  if (ca.length >= 9 && cb.length >= 9 && ca.slice(-9) === cb.slice(-9)) return true
  return da.endsWith(db) || db.endsWith(da)
}

function foldAzSearch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ə/g, 'e')
}

function studentDisplayName(s) {
  const full = String(s?.full_name || s?.student_name || s?.name || '').trim()
  if (full) return full
  const parts = `${s?.first_name || ''} ${s?.last_name || ''}`.trim()
  return parts || ''
}

function matchesSmsSearch(item, query, phoneToName, students = []) {
  const q = String(query || '').trim()
  if (!q) return true
  const qFold = foldAzSearch(q)
  const qLower = q.toLowerCase()
  const digits = normPhoneDigits(q)

  const name = foldAzSearch(item.student_name || '')
  if (name && qFold && name.includes(qFold)) return true
  if (name && qLower && name.includes(qLower)) return true

  const msg = foldAzSearch(item.message || '')
  if (msg && qFold && msg.includes(qFold)) return true

  const phoneList = [...(item.phones || []), item.phone].filter(Boolean)
  for (const p of phoneList) {
    const d = normPhoneDigits(p)
    if (digits.length >= 3 && d.includes(digits)) return true
    if (qFold && foldAzSearch(p).includes(qFold)) return true
    const mapped = phoneToName && phoneToName.get(d)
    if (mapped && foldAzSearch(mapped).includes(qFold)) return true
  }

  for (const s of students || []) {
    const sName = foldAzSearch(studentDisplayName(s))
    if (!sName || !qFold || !sName.includes(qFold)) continue
    if (item.student_id && s.id && String(item.student_id) === String(s.id)) return true
    const sPhones = [s.phone, s.parent_phone, s.parentPhone].filter(Boolean)
    for (const ip of phoneList) {
      for (const sp of sPhones) {
        if (phonesMatch(ip, sp)) return true
      }
    }
  }
  return false
}

function addPhoneNameKeys(map, phone, name) {
  const d = normPhoneDigits(phone)
  if (!d || !name) return
  map.set(d, name)
  if (d.startsWith('994')) map.set(d.slice(3), name)
  if (d.startsWith('0')) map.set(d.slice(1), name)
  let core = d
  if (core.startsWith('994')) core = core.slice(3)
  if (core.startsWith('0')) core = core.slice(1)
  if (core.length >= 9) map.set(core.slice(-9), name)
}

function buildStudentPhoneNameMap(students) {
  const map = new Map()
  for (const s of students || []) {
    const name = studentDisplayName(s)
    if (!name) continue
    for (const p of [s.phone, s.parent_phone, s.parentPhone]) {
      addPhoneNameKeys(map, p, name)
    }
  }
  return map
}

function enrichSmsWithStudentNames(items, phoneToName) {
  return (items || []).map((x) => {
    const phone = normPhoneDigits(x.phone)
    const fromMap = phone && phoneToName.get(phone)
    const student_name = x.student_name || fromMap || null
    return student_name ? { ...x, student_name } : x
  })
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
  const { theme } = useUiStore()
  const LEVEL = useMemo(() => alertLevelStyles(theme), [theme])
  const progressTrackCls =
    theme === 'dark' ? 'bg-white/10' : 'bg-slate-900/[0.08]'
  const [alerts, setAlerts] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [tab, setTab] = useState('all') // all | sms
  // UX default: show real data immediately (avoid "0" on first paint)
  const [smsTimeFilter, setSmsTimeFilter] = useState('all') // all | today | week | month
  const [smsStatusFilter, setSmsStatusFilter] = useState('all') // all | sent | failed | scheduled
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsItem, setDetailsItem] = useState(null)
  const [smsLoading, setSmsLoading] = useState(false)
  const [smsErr, setSmsErr] = useState(null)
  const [smsDbItems, setSmsDbItems] = useState([])
  const [smsStudents, setSmsStudents] = useState([])
  const [smsSearch, setSmsSearch] = useState('')
  const smsFetchSeq = useRef(0)
  const [smsSearchDebounced, setSmsSearchDebounced] = useState('')
  const [smsShowCount, setSmsShowCount] = useState(40)
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('')
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const debugSms = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('debugSms') === '1'
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()))
    } catch {}
  }, [])

  useEffect(() => {
    if (tab !== 'sms') return
    const t = setTimeout(() => setSmsSearchDebounced(smsSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [smsSearch, tab])

  useEffect(() => {
    if (tab !== 'sms') return
    let cancelled = false
    const seq = ++smsFetchSeq.current
    setSmsLoading(true)
    setSmsErr(null)
    Promise.all([
      api.get('/sms-logs', { params: { limit: 200 } }),
      api.get('/sms-logs/plan', { params: { days: 90 } }),
      api.get('/students').catch(() => ({ students: [] })),
    ])
      .then(([hist, plan, studentsRes]) => {
        if (cancelled || seq !== smsFetchSeq.current) return
        const roster = studentsRes?.students || studentsRes?.items || []
        setSmsStudents(roster)
        const phoneToName = buildStudentPhoneNameMap(roster)
        const rawItems = enrichSmsWithStudentNames(Array.isArray(hist?.items) ? hist.items : [], phoneToName)
        const rawPlan = enrichSmsWithStudentNames(Array.isArray(plan?.items) ? plan.items : [], phoneToName)
        const normPhone = (p) => String(p || '').replace(/\D/g, '')
        const mapped = [...rawItems, ...rawPlan].map((x) => ({
          ...x,
          createdAt: x.createdAt ?? x.created_at ?? null,
        }))
        const rankStatus = (s) => {
          const st = String(s || '').toLowerCase()
          if (st === 'failed') return 3
          if (st === 'sent') return 2
          if (st === 'pending') return 1
          if (st === 'scheduled') return 0
          return 2
        }

        // Build phone -> student mapping (enrollment + enriched names).
        const phoneToStudent = new Map()
        for (const [digits, name] of phoneToName.entries()) {
          if (digits && name) phoneToStudent.set(digits, name)
        }
        for (const x of mapped) {
          const phone = normPhone(x.phone)
          const studentKey = String(x.student_id || x.student_name || '').trim()
          if (phone && studentKey) phoneToStudent.set(phone, studentKey)
        }

        const uniq = new Map()
        for (const x of mapped) {
          const phone = normPhone(x.phone)
          const studentKey =
            String(x.student_name || x.student_id || '').trim() ||
            (phone ? String(phoneToStudent.get(phone) || '').trim() : '')
          const entityKey = studentKey || phone || 'unknown'
          const key = [
            String(x.type || ''),
            entityKey,
            String(x.createdAt || ''),
            String(x.message || ''),
          ].join('|')
          const prev = uniq.get(key)
          if (!prev) {
            uniq.set(key, {
              ...x,
              student_name: x.student_name || (phone ? phoneToName.get(phone) : null) || null,
              phones: x.phone ? [x.phone] : [],
            })
            continue
          }
          const mergedPhones = [...new Set([...(prev.phones || []), ...(x.phone ? [x.phone] : [])])]
          const winner = rankStatus(x.status) > rankStatus(prev.status) ? x : prev
          const mergedName =
            winner.student_name ||
            x.student_name ||
            (phone ? phoneToName.get(phone) : null) ||
            prev.student_name ||
            null
          uniq.set(key, { ...winner, student_name: mergedName, phones: mergedPhones })
        }
        const deduped = Array.from(uniq.values())
        setSmsDbItems(deduped)
        if (debugSms) {
          // eslint-disable-next-line no-console
          console.log('[sms-logs] raw items:', rawItems)
          // eslint-disable-next-line no-console
          console.log('[sms-logs/plan] raw items:', rawPlan)
          // eslint-disable-next-line no-console
          console.log('[sms-logs] merged mapped:', mapped)
          // eslint-disable-next-line no-console
          console.log('[sms-logs] deduped:', deduped)
        }
      })
      .catch((e) => {
        if (!cancelled && seq === smsFetchSeq.current) {
          setSmsDbItems([])
          setSmsStudents([])
          if (debugSms) {
            // eslint-disable-next-line no-console
            console.log('[sms-logs] error:', e)
          }
          const st = e?.status ? ` (${e.status})` : ''
          setSmsErr(`SMS tarixçəsi hazırda əlçatan deyil${st}`)
        }
      })
      .finally(() => {
        if (!cancelled && seq === smsFetchSeq.current) setSmsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, debugSms])

  useEffect(() => {
    if (tab !== 'sms') return
    setSmsShowCount(40)
  }, [tab, smsTimeFilter, smsStatusFilter, smsSearchDebounced])

  const smsBaseList = useMemo(() => {
    return Array.isArray(smsDbItems) ? smsDbItems : []
  }, [smsDbItems])

  const smsPhoneToName = useMemo(() => buildStudentPhoneNameMap(smsStudents), [smsStudents])

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

  const smsUsed = billing?.usage?.sms_monthly ?? profile?.sms_used_monthly ?? profile?.sms_used ?? 0
  const smsLim = billing?.limits?.sms_monthly ?? profile?.sms_limit ?? null
  const storageUsedMb = billing?.usage?.storage_mb ?? profile?.storage_used_mb ?? null
  const storageLimMb = billing?.limits?.storage_mb ?? profile?.storage_limit_mb ?? null
  const ramUsedMb = billing?.usage?.ram_mb ?? profile?.ram_used_mb ?? null
  const ramLimMb = billing?.limits?.ram_mb ?? profile?.ram_limit_mb ?? null

  const pctOrZero = (used, lim) => {
    if (lim == null) return 0
    const u = Number(used || 0) || 0
    const l = Number(lim || 0) || 0
    if (!l) return 0
    return Math.round((u / l) * 100)
  }

  const systemPercent = {
    sms: pctOrZero(smsUsed, smsLim),
    storage: pctOrZero(storageUsedMb, storageLimMb),
    ram: pctOrZero(ramUsedMb, ramLimMb),
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

  const smsTimeRows = useMemo(() => {
    const now = new Date()
    const filtered = smsBaseList.filter((x) => {
      if (!matchesSmsSearch(x, smsSearchDebounced, smsPhoneToName, smsStudents)) return false
      if (smsTimeFilter === 'all') return true
      if (smsTimeFilter === 'today') return isToday(x.createdAt, now)
      if (smsTimeFilter === 'week') return isThisWeek(x.createdAt, now)
      return isThisMonth(x.createdAt, now)
    })
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [smsTimeFilter, smsBaseList, smsSearchDebounced, smsPhoneToName, smsStudents])

  const smsRows = useMemo(() => {
    if (smsStatusFilter === 'sent') return smsTimeRows.filter((x) => x.status === 'sent')
    if (smsStatusFilter === 'failed') return smsTimeRows.filter((x) => x.status === 'failed')
    if (smsStatusFilter === 'scheduled') return smsTimeRows.filter((x) => x.status === 'scheduled')
    return smsTimeRows
  }, [smsStatusFilter, smsTimeRows])

  const smsCounts = useMemo(() => {
    const sent = smsTimeRows.filter((x) => x.status === 'sent').length
    const scheduled = smsTimeRows.filter((x) => x.status === 'scheduled').length
    return { sent, scheduled }
  }, [smsTimeRows])

  const smsHistoryTotal = useMemo(() => smsBaseList.length, [smsBaseList])

  const tabItems = useMemo(
    () => [
      { id: 'all', label: 'Bütün bildirişlər' },
      { id: 'sms', label: 'SMS tarixçəsi' },
    ],
    []
  )

  const smsTimeTabs = useMemo(() => {
    const now = new Date()
    const all = smsBaseList.length
    const today = smsBaseList.filter((x) => isToday(x.createdAt, now)).length
    const week = smsBaseList.filter((x) => isThisWeek(x.createdAt, now)).length
    const month = smsBaseList.filter((x) => isThisMonth(x.createdAt, now)).length
    return [
      { id: 'all', label: 'All time', count: all },
      { id: 'today', label: 'Bu gün', count: today },
      { id: 'week', label: 'Bu həftə', count: week },
      { id: 'month', label: 'Bu ay', count: month },
    ]
  }, [smsBaseList])

  const smsStatusTabs = useMemo(() => {
    const all = smsTimeRows.length
    const sent = smsTimeRows.filter((x) => x.status === 'sent').length
    const failed = smsTimeRows.filter((x) => x.status === 'failed').length
    const scheduled = smsTimeRows.filter((x) => x.status === 'scheduled').length
    return [
      { id: 'all', label: 'All (total history)', count: all },
      { id: 'sent', label: 'Göndərildi', count: sent },
      { id: 'failed', label: 'Uğursuz', count: failed },
      { id: 'scheduled', label: 'Planlaşdırılıb', count: scheduled },
    ]
  }, [smsTimeRows])

  const smsQuotaLine = useMemo(() => {
    const lim = billing?.limits?.sms_monthly
    const used = billing?.usage?.sms_monthly
    if (lim == null && used == null) return null
    const usedN = Number(used || 0) || 0
    const limLabel = lim == null ? '∞' : String(Math.round(Number(lim)))
    return { used: usedN, limLabel }
  }, [billing])

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
    <div className="p-4 sm:p-6 min-w-0 flex flex-col gap-6">
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
            <div className="text-sm font-semibold text-token-textMain">Aylıq SMS</div>
            <div className={`h-2.5 rounded-full overflow-hidden ${progressTrackCls}`}>
              <div className={`h-full ${barTone(systemPercent.sms)}`} style={{ width: `${Math.min(100, systemPercent.sms)}%` }} />
            </div>
            <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
              {Number(smsUsed || 0) || 0}/{smsLim == null ? '∞' : Math.round(Number(smsLim))}
            </div>
          </div>

          <div className="grid grid-cols-[92px_1fr_auto] items-center gap-x-4 gap-y-2">
            <div className="text-sm font-semibold text-token-textMain">Storage</div>
            <div className={`h-2.5 rounded-full overflow-hidden ${progressTrackCls}`}>
              <div className={`h-full ${barTone(systemPercent.storage)}`} style={{ width: `${Math.min(100, systemPercent.storage)}%` }} />
            </div>
            <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
              {formatStorageUsedFromMb(storageUsedMb)} / {storageLimMb == null ? '∞' : formatBytesLimitFromMb(storageLimMb)}
            </div>
          </div>

          <div className="grid grid-cols-[92px_1fr_auto] items-center gap-x-4 gap-y-2">
            <div className="text-sm font-semibold text-token-textMain">RAM</div>
            <div className={`h-2.5 rounded-full overflow-hidden ${progressTrackCls}`}>
              <div className={`h-full ${barTone(systemPercent.ram)}`} style={{ width: `${Math.min(100, systemPercent.ram)}%` }} />
            </div>
            <div className="text-sm text-token-textMuted tabular-nums text-right whitespace-nowrap">
              {ramUsedMb == null ? '—' : formatMbValue(ramUsedMb)} / {ramLimMb == null ? '∞' : formatMbValue(ramLimMb)}
            </div>
          </div>
        </div>
      </Card>

      <FilterTabs tabs={tabItems} activeId={tab} onChange={(id) => setTab(id)} />

      {tab === 'sms' ? (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base text-token-textMain">SMS tarixçəsi</h2>
              <p className="text-xs text-token-textMuted mt-1">
                Ödəniş xatırlatma mesajlarının göndərilmə statusu və qısa preview.
              </p>
              {smsLoading ? <p className="text-xs text-token-textMuted mt-2">Tarixçə yüklənir…</p> : null}
              {debugSms && !smsLoading ? (
                <div className="mt-3 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/30 p-3">
                  <p className="text-[11px] font-semibold text-token-textMuted uppercase tracking-wider mb-2">
                    Debug: API-dən gələn data (filterdən əvvəl, ilk 2)
                  </p>
                  <pre className="text-[11px] leading-relaxed text-token-textMain overflow-auto max-h-56">
                    {JSON.stringify(smsBaseList.slice(0, 2), null, 2)}
                  </pre>
                </div>
              ) : null}
              <div className="mt-3 flex flex-col gap-2">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--border-subtle)] bg-token-surfaceCard/50 px-3 py-1.5 text-[11px] text-token-textMain">
                  <span className="text-token-textMuted">Total SMS history:</span>
                  <span className="font-semibold tabular-nums">{smsLoading ? '—' : smsHistoryTotal}</span>
                </span>
                {smsQuotaLine ? (
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] text-token-textMain">
                    <span className="text-token-textMuted">Bu ay ümumi SMS istifadəsi:</span>
                    <span className="font-semibold tabular-nums">
                      {smsQuotaLine.used}/{smsQuotaLine.limLabel}
                    </span>
                  </span>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-token-textMuted">Seçilmiş filter nəticələri:</span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-200/90">
                    Göndərildi (filter) <span className="font-bold tabular-nums">{smsLoading ? '—' : smsCounts.sent}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-200/90">
                    Planlaşdırılıb (filter) <span className="font-bold tabular-nums">{smsLoading ? '—' : smsCounts.scheduled}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="shrink-0 w-full sm:w-auto space-y-2">
              <input
                type="search"
                value={smsSearch}
                onChange={(e) => setSmsSearch(e.target.value)}
                placeholder="Ad və ya telefon (məs: Gözel / 559815866)"
                className="w-full sm:w-72 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-token-textMuted focus:border-primary/40 outline-none"
                aria-label="SMS tarixçəsində axtarış"
              />
              <FilterTabs tabs={smsTimeTabs} activeId={smsTimeFilter} onChange={(id) => setSmsTimeFilter(id)} />
              <FilterTabs tabs={smsStatusTabs} activeId={smsStatusFilter} onChange={(id) => setSmsStatusFilter(id)} />
            </div>
          </div>

          {!smsRows.length ? (
            <Card className="p-8 sm:p-10 text-center">
              <div className="text-3xl mb-3">📭</div>
              <div className="text-sm font-semibold text-token-textMain">
                {smsErr ? 'SMS tarixçəsi yüklənmədi' : smsSearchDebounced ? 'Axtarışa uyğun SMS tapılmadı' : 'Bu filter üçün SMS yoxdur'}
              </div>
              <p className="text-xs text-token-textMuted mt-1">
                {smsErr
                  ? 'Bir az sonra yenidən yoxlayın.'
                  : smsSearchDebounced
                    ? 'Ad və ya telefonu yoxlayın (ən azı 2 simvol).'
                    : 'Filtrləri dəyişin və ya yeni SMS göndərin.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-token-textMuted">
                  Göstərilir:{' '}
                  <span className="text-token-textMain font-semibold tabular-nums">
                    {Math.min(smsRows.length, smsShowCount)}
                  </span>{' '}
                  / <span className="text-token-textMain font-semibold tabular-nums">{smsRows.length}</span>
                </div>
                {smsShowCount < smsRows.length ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:text-primary/90"
                    onClick={() => setSmsShowCount((n) => Math.min(smsRows.length, n + 40))}
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
                  <p className="text-sm text-token-textMain break-words">{alert.message}</p>
                  <p className="text-xs text-token-textMuted mt-1">
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