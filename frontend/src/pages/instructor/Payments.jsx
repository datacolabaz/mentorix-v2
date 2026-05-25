import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'

function formatAzn(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `${x.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`
}

function roundMoney(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function formatDdMmYyyy(val) {
  if (val == null || val === '') return '—'
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const day = String(val.getUTCDate()).padStart(2, '0')
    return `${day}.${m}.${y}`
  }
  const d = String(val).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

function normPhoneDigits(v) {
  return String(v ?? '').replace(/\D/g, '')
}

function paymentHistorySortMs(p) {
  const pd = p.payment_date != null ? String(p.payment_date).slice(0, 10) : ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(pd)) {
    return new Date(`${pd}T12:00:00Z`).getTime()
  }
  if (p.paid_at) {
    const t = new Date(p.paid_at).getTime()
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function sortPaymentsChronologically(list) {
  return [...(list || [])].sort((a, b) => {
    const da = paymentHistorySortMs(a)
    const db = paymentHistorySortMs(b)
    if (da !== db) return da - db
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

function historyDateKey(p) {
  return formatDdMmYyyy(p.payment_date || p.paid_at)
}

function lessonStatusLabel(status) {
  const st = String(status || '').toLowerCase()
  if (st === 'done') return { text: 'Keçib', cls: 'text-emerald-300' }
  if (st === 'absent') return { text: 'Qayıb', cls: 'text-rose-300' }
  if (st === 'cancelled') return { text: 'Ləğv', cls: 'text-gray-400' }
  return { text: 'Gözləyir', cls: 'text-amber-200/90' }
}

/** Ad və telefon üzrə (case-insensitive, +994 / boşluq tolerant) */
function matchesStudentSearch(student, searchTerm) {
  const q = String(searchTerm ?? '').trim().toLowerCase()
  if (!q) return true
  const qDigits = normPhoneDigits(searchTerm)
  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim().toLowerCase()
  if (name.includes(q)) return true
  const phoneDigits = normPhoneDigits(student.phone)
  if (!qDigits) return false
  return (
    phoneDigits.includes(qDigits) ||
    (qDigits.length >= 7 && phoneDigits.endsWith(qDigits)) ||
    (qDigits.startsWith('0') && phoneDigits.endsWith(qDigits.slice(1)))
  )
}

function SearchIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function InstructorPayments() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [students, setStudents] = useState([])
  const [dueConfirmations, setDueConfirmations] = useState([])
  const [packConfirmations, setPackConfirmations] = useState([])
  const [packConfirmOpen, setPackConfirmOpen] = useState(false)
  const [confirmingKey, setConfirmingKey] = useState(null)
  const [markingId, setMarkingId] = useState(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickRow, setQuickRow] = useState(null)
  /** { id, payment_date, amount, notes }[] */
  const [quickLines, setQuickLines] = useState([])
  const [todayBaku, setTodayBaku] = useState(() => new Date().toISOString().slice(0, 10))
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRow, setHistoryRow] = useState(null)
  const [historyPayments, setHistoryPayments] = useState([])
  const [historySummary, setHistorySummary] = useState(null)
  const [historyViewMode, setHistoryViewMode] = useState('monthly')
  const [historyPackages, setHistoryPackages] = useState([])
  const [historyPackSummary, setHistoryPackSummary] = useState(null)
  const [openHistoryPackages, setOpenHistoryPackages] = useState(() => new Set())
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState(null)
  /** Sistemdən əvvəl qeydiyyat: keçmiş paket ödənişlərini toplu qeydə alma təklifi */
  const [legacyRestorePrompt, setLegacyRestorePrompt] = useState(null)
  const [legacyRestoreBusy, setLegacyRestoreBusy] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustRow, setAdjustRow] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustDate, setAdjustDate] = useState(() => new Date().toISOString().split('T')[0])
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const toast = useToast()
  const theme = useUiStore((s) => s.theme)

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const d = await api.get('/payments/instructor-board')
      setTotalEarnings(d.totalEarnings ?? 0)
      setPendingCount(d.pendingCount ?? 0)
      setPendingAmount(d.pendingAmount ?? 0)
      if (d.today_baku && /^\d{4}-\d{2}-\d{2}$/.test(String(d.today_baku))) {
        setTodayBaku(String(d.today_baku).slice(0, 10))
      }
      setStudents(d.students || [])
      setDueConfirmations(Array.isArray(d.due_confirmations) ? d.due_confirmations : [])
      const packs = Array.isArray(d.pack_confirmations) ? d.pack_confirmations : []
      setPackConfirmations(packs)
      if (packs.length > 0) setPackConfirmOpen(true)
    } catch (e) {
      setErr(e?.message || 'Məlumat yüklənmədi')
      setStudents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openAdjust = (row) => {
    setAdjustRow(row)
    setAdjustAmount('')
    setAdjustDate(new Date().toISOString().split('T')[0])
    setAdjustNotes('')
    setAdjustOpen(true)
  }

  const submitAdjust = async () => {
    if (!adjustRow?.enrollment_id) return
    const amt = Number(adjustAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast('Məbləği düzgün daxil edin', 'error')
      return
    }
    setAdjustSaving(true)
    try {
      await api.post('/payments', {
        enrollment_id: adjustRow.enrollment_id,
        amount: amt,
        payment_method: 'cash',
        payment_date: adjustDate || null,
        status: 'completed',
        legacy_kind: 'balance_adjustment',
        notes: adjustNotes.trim() || undefined,
      })
      toast('Balans düzəlişi qeydə alındı')
      setAdjustOpen(false)
      setAdjustRow(null)
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setAdjustSaving(false)
    }
  }

  const newQuickLine = useCallback(
    (defaults = {}) => ({
      id: globalThis.crypto?.randomUUID?.() || `l_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      payment_date: defaults.payment_date ?? todayBaku,
      amount: defaults.amount != null ? String(defaults.amount) : '',
      notes: defaults.notes != null ? String(defaults.notes) : '',
    }),
    [todayBaku]
  )

  const openQuickPay = (row) => {
    // Subscription billing removed; quick-pay modal is no longer used.
    void row
  }

  const quickPartialUnderpay = false
  const quickPreview = null

  const [openCats, setOpenCats] = useState(() => new Set())
  const [searchTerm, setSearchTerm] = useState('')

  const categorized = useMemo(() => {
    const list = Array.isArray(students) ? students : []
    const cats = [
      { key: '8', label: '8 dərs paketləri', match: (s) => String(s.billing_type) === '8_lessons' },
      { key: '12', label: '12 dərs paketləri', match: (s) => String(s.billing_type) === '12_lessons' },
      { key: 'other', label: 'Digər', match: (s) => !['8_lessons', '12_lessons'].includes(String(s.billing_type)) },
    ]
    return cats
      .map((c) => {
        const allItems = list.filter(c.match)
        const items =
          c.key === '8' && searchTerm.trim()
            ? allItems.filter((s) => matchesStudentSearch(s, searchTerm))
            : allItems
        return { ...c, items, totalCount: allItems.length }
      })
      .filter((c) => (c.key === '8' ? c.totalCount > 0 : c.items.length > 0))
  }, [students, searchTerm])

  const submitQuickPay = async (keepOpen = false) => {
    void keepOpen
  }

  const dueConfirmKey = (item) => `${item.enrollment_id}|${item.due_ymd}`

  const packConfirmKey = (item) => `${item.enrollment_id}|p${item.package_number}`

  const confirmPackPayment = async (item, opts = {}) => {
    const key = packConfirmKey(item)
    setConfirmingKey(key)
    try {
      await api.post('/payments/confirm-pack', {
        enrollment_id: item.enrollment_id,
        package_number: item.package_number,
        amount: item.amount,
        payment_date: item.due_ymd,
      })
      toast('Paket ödənişi təsdiqləndi — tarixçəyə əlavə olundu', 'success')
      if (opts.refreshHistory && historyRow?.enrollment_id === item.enrollment_id) {
        await fetchHistoryForEnrollment(item.enrollment_id, historyRow.billing_type, '8', historyRow)
      }
      setPackConfirmations((prev) => prev.filter((x) => packConfirmKey(x) !== key))
      await load()
    } catch (e) {
      toast(e?.message || 'Təsdiq alınmadı', 'error')
      if (e?.status === 409) await load()
    } finally {
      setConfirmingKey(null)
    }
  }

  const confirmDuePayment = async (item, opts = {}) => {
    const key = dueConfirmKey(item)
    setConfirmingKey(key)
    try {
      await api.post('/payments/confirm-due', {
        enrollment_id: item.enrollment_id,
        due_ymd: item.due_ymd,
        amount: item.amount,
      })
      toast('Ödəniş təsdiqləndi — tarixçəyə əlavə olundu', 'success')
      if (opts.refreshHistory && historyRow?.enrollment_id === item.enrollment_id) {
        await fetchHistoryForEnrollment(item.enrollment_id, historyRow.billing_type, '8', historyRow)
      }
      await load()
    } catch (e) {
      toast(e?.message || 'Təsdiq alınmadı', 'error')
      if (e?.status === 409) await load()
    } finally {
      setConfirmingKey(null)
    }
  }

  const canConfirmUnpaidDue = (p) => {
    if (p.timeline_status !== 'unpaid') return false
    const dueYmd = String(p.due_ymd || p.payment_date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueYmd)) return false
    const cutoff = String(historySummary?.payment_confirmation_cutoff || '').slice(0, 10)
    if (!cutoff) return false
    if (dueYmd < cutoff) return false
    if (todayBaku && dueYmd > todayBaku) return false
    return true
  }

  const toggleHistoryPkg = (cyc) => {
    setOpenHistoryPackages((prev) => {
      const next = new Set(prev)
      if (next.has(cyc)) next.delete(cyc)
      else next.add(cyc)
      return next
    })
  }

  const isPackBillingRow = (billingType, categoryKey) =>
    categoryKey === '8' ||
    categoryKey === '12' ||
    billingType === '8_lessons' ||
    billingType === '12_lessons'

  const fetchHistoryForEnrollment = async (enrollmentId, billingType, categoryKey, studentRow) => {
    setHistoryLoading(true)
    setLegacyRestorePrompt(null)
    try {
      const forcePack = isPackBillingRow(billingType, categoryKey)
      const d = await api.get('/payments/enrollment/' + encodeURIComponent(enrollmentId) + '/history', {
        params: forcePack ? { view: 'packages' } : undefined,
      })
      const mode = d.view_mode === 'packages' || forcePack ? 'packages' : 'monthly'
      setHistoryViewMode(mode)
      if (mode === 'packages') {
        const packages = Array.isArray(d.lesson_packages) ? d.lesson_packages : []
        setHistoryPackages(packages)
        setHistoryPackSummary(d.summary ?? null)
        setHistoryPayments([])
        setHistorySummary(null)
        const unpaid = packages.filter(
          (p) =>
            p.payment_status === 'unpaid' &&
            !p.legacy_confirmed &&
            Number(p.completed) >= Number(p.total) &&
            Number(p.total) > 0
        )
        setOpenHistoryPackages(new Set(unpaid.map((p) => Number(p.package_number) || 1)))

        if (d.summary?.pre_system_enrollment) {
          const legacyPkgs = packages.filter(
            (p) =>
              p.legacy_confirmed &&
              (Number(p.total_paid) || 0) <= 0.005 &&
              Number(p.total) > 0 &&
              Number(p.completed) >= Number(p.total)
          )
          let fee = d.summary?.monthly_fee != null ? Number(d.summary.monthly_fee) : NaN
          if (!Number.isFinite(fee) || fee <= 0) {
            const rowFee = studentRow?.monthly_fee != null ? Number(studentRow.monthly_fee) : NaN
            if (Number.isFinite(rowFee) && rowFee > 0) fee = rowFee
          }
          if (legacyPkgs.length > 0 && Number.isFinite(fee) && fee > 0) {
            const name = studentRow
              ? `${studentRow.first_name || ''} ${studentRow.last_name || ''}`.trim()
              : d.student_name || 'Tələbə'
            setLegacyRestorePrompt({
              enrollmentId,
              studentName: name || 'Tələbə',
              packages: legacyPkgs,
              fee,
              totalAmount: roundMoney(legacyPkgs.length * fee),
            })
          }
        }
      } else {
        setHistoryPackages([])
        setHistoryPackSummary(null)
        setOpenHistoryPackages(new Set())
        setHistoryPayments(sortPaymentsChronologically(d.payments))
        setHistorySummary(d.balance_summary ?? null)
      }
    } catch (e) {
      toast(e?.message || 'Tarixçə yüklənmədi', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  const openHistory = async (row, categoryKey) => {
    if (!row?.enrollment_id) return
    const forcePack = isPackBillingRow(row.billing_type, categoryKey)
    setHistoryRow(row)
    setHistoryOpen(true)
    setHistoryPayments([])
    setHistorySummary(null)
    setHistoryPackages([])
    setHistoryPackSummary(null)
    setHistoryViewMode(forcePack ? 'packages' : 'monthly')
    setOpenHistoryPackages(new Set())
    await fetchHistoryForEnrollment(row.enrollment_id, row.billing_type, categoryKey, row)
  }

  const confirmAllLegacyPackPayments = async () => {
    const m = legacyRestorePrompt
    if (!m?.enrollmentId) return
    setLegacyRestoreBusy(true)
    try {
      const d = await api.post(
        `/payments/enrollment/${encodeURIComponent(m.enrollmentId)}/confirm-legacy-packs`,
        {}
      )
      const n = Number(d?.count) || 0
      toast(
        n > 0
          ? `${n} keçmiş paket ödənişi sistemə əlavə olundu (${formatAzn(d?.total_amount ?? m.totalAmount)})`
          : 'Əlavə olunacaq paket qalmayıb',
        n > 0 ? 'success' : 'info'
      )
      setLegacyRestorePrompt(null)
      if (historyRow?.enrollment_id === m.enrollmentId) {
        await fetchHistoryForEnrollment(m.enrollmentId, historyRow.billing_type, '8', historyRow)
      }
      await load()
    } catch (e) {
      toast(e?.message || 'Qeydə alınmadı', 'error')
    } finally {
      setLegacyRestoreBusy(false)
    }
  }

  const deleteHistoryPayment = async (paymentId) => {
    if (
      !window.confirm(
        'Bu ödəniş qeydini silmək istəyirsiniz? «Cəmi ödənilən» və borc bütün səhifələrdə (cədvəl, dashboard) yenidən hesablanacaq.'
      )
    )
      return
    const eid = historyRow?.enrollment_id
    if (!eid) return
    setDeletingPaymentId(paymentId)
    try {
      await api.delete('/payments/' + encodeURIComponent(paymentId))
      toast('Ödəniş silindi')
      await fetchHistoryForEnrollment(eid, historyRow?.billing_type, '8', historyRow)
      await load()
    } catch (e) {
      toast(e?.message || 'Silinmədi', 'error')
    } finally {
      setDeletingPaymentId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Ödənişlər</h1>
        <p className="text-token-textMuted text-sm mt-1">
          8/12 dərs paketləri tamamlananda təsdiq tələb olunur; aylıq ödənişlər isə cari aydan etibarən təsdiqlənir.
          Təsdiqdən sonra tarixçə və tələbə profilində ödənişlər yenilənir.
        </p>
      </div>

      <Modal
        open={packConfirmOpen && packConfirmations.length > 0}
        onClose={() => !confirmingKey && setPackConfirmOpen(false)}
        title="Paket ödənişi təsdiqi"
        size="md"
      >
        <p className="text-xs text-token-textMuted mb-3 leading-relaxed">
          Bu tələbələrin dərs paketi tamamlanıb, amma ödəniş hələ qeydə alınmayıb. Nağd alındısa təsdiqləyin.
        </p>
        <ul className="space-y-2 max-h-[min(60vh,24rem)] overflow-y-auto pr-0.5">
          {packConfirmations.map((item) => {
            const key = packConfirmKey(item)
            const busy = confirmingKey === key
            const name = item.student_name || `${item.first_name || ''} ${item.last_name || ''}`.trim()
            return (
              <li
                key={key}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-emerald-500/25 bg-token-surfaceCard/50 px-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-token-textMain">{name || '—'}</p>
                  <p className="text-xs text-emerald-200/90 mt-1">
                    {item.period || `Paket #${item.package_number}`} tamamlanıb
                    {item.overdue ? ' · gecikib' : ''}
                  </p>
                  <p className="text-xs text-token-textMuted mt-1 tabular-nums">Məbləğ: {formatAzn(item.amount)}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  loading={busy}
                  disabled={!!confirmingKey}
                  onClick={() => void confirmPackPayment(item)}
                  className="shrink-0 w-full sm:w-auto justify-center"
                >
                  Təsdiqlə
                </Button>
              </li>
            )
          })}
        </ul>
        <div className="flex justify-end pt-3">
          <Button type="button" variant="secondary" size="sm" disabled={!!confirmingKey} onClick={() => setPackConfirmOpen(false)}>
            Sonra
          </Button>
        </div>
      </Modal>

      {!loading && packConfirmations.length > 0 ? (
        <Card hover className="p-4 sm:p-5 mb-6 border border-emerald-500/30 bg-emerald-500/5">
          <h2 className="font-display font-bold text-sm text-emerald-200/95 mb-1">Paket ödənişi gözləyir</h2>
          <p className="text-xs text-token-textMuted mb-3 leading-relaxed">
            {packConfirmations.length} tamamlanmış paket üçün ödəniş təsdiqi lazımdır.
          </p>
          <Button type="button" size="sm" onClick={() => setPackConfirmOpen(true)}>
            Təsdiq pəncərəsini aç
          </Button>
        </Card>
      ) : null}

      {!loading && dueConfirmations.length > 0 ? (
        <Card hover className="p-4 sm:p-5 mb-6 border border-amber-500/30 bg-amber-500/5">
          <h2 className="font-display font-bold text-sm text-amber-200/95 mb-1">Aylıq ödəniş xatırlatması</h2>
          <p className="text-xs text-token-textMuted mb-3 leading-relaxed">
            Ödəniş vaxtı çatıb, amma hələ tarixçəyə düşməyib. Nağd alındısa təsdiqləyin — sonra «Tarixçə» və
            bildirişlər bölməsində görünəcək.
          </p>
          <ul className="space-y-2">
            {dueConfirmations.map((item) => {
              const key = dueConfirmKey(item)
              const busy = confirmingKey === key
              const name = item.student_name || `${item.first_name || ''} ${item.last_name || ''}`.trim()
              const dueLabel = formatDdMmYyyy(item.due_ymd)
              return (
                <li
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-500/25 bg-token-surfaceCard/50 px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-token-textMain">{name || '—'}</p>
                    <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                      <span className="font-medium">{dueLabel}</span> tarixli ödəniş vaxtı çatıb
                      {item.overdue ? ' (gecikib)' : ''}. Ödənişi etmisinizsə təsdiqləyin.
                    </p>
                    <p className="text-xs text-token-textMuted mt-1 tabular-nums">
                      Məbləğ: {formatAzn(item.amount)}
                      {item.period ? ` · ${item.period}` : ''}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    loading={busy}
                    disabled={!!confirmingKey}
                    onClick={() => void confirmDuePayment(item)}
                    className="shrink-0 w-full sm:w-auto justify-center"
                  >
                    Təsdiqlə
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card hover className="p-5">
          <div className="text-[11px] font-semibold text-token-textMuted uppercase tracking-widest mb-2">
            Total Earnings
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-token-textMain tabular-nums">
            {loading ? '…' : formatAzn(totalEarnings)}
          </div>
          <p className="text-xs text-token-textMuted mt-2">Təsdiqlənmiş ödənişlərin cəmi (bütün dövr)</p>
        </Card>
        <Card hover className="p-5">
          <div className="text-[11px] font-semibold text-token-textMuted uppercase tracking-widest mb-2">
            Pending Payments
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-amber-600 dark:text-amber-200/95 tabular-nums">
            {loading ? '…' : formatAzn(pendingAmount)}
          </div>
          <p className="text-xs text-token-textMuted mt-2">
            {loading
              ? '…'
              : `${pendingCount} tələbə · qalıq borc cəmi`}
          </p>
        </Card>
      </div>

      <Card hover className="overflow-hidden border border-[color:var(--border-subtle)] mb-3">
        <div className="px-4 py-3 border-b border-[color:var(--border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-token-surfaceCard/45">
          <h2 className="font-display font-bold text-sm text-token-textMain tracking-wide">Tələbələr</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
            Yenilə
          </Button>
        </div>

        {loading && (
          <div className="p-6">
            <ListSkeleton message="Ödəniş məlumatları yüklənir…" />
          </div>
        )}

        {!loading && err && (
          <div className="p-6 text-center">
            <p className="text-amber-200/90 text-sm mb-3">{err}</p>
            <Button type="button" onClick={() => void load()}>
              Yenidən yüklə
            </Button>
          </div>
        )}
      </Card>

      {!loading && !err && (
        <div className="space-y-3">
          {categorized.map((c) => {
            const isOpen = openCats.has(c.key)
            return (
              <Card
                key={c.key}
                hover
                className="p-0 overflow-hidden border border-[color:var(--border-subtle)] hover:border-primary/20"
              >
                <button
                  type="button"
                  className={[
                    'w-full flex items-center justify-between gap-3 px-4 py-3',
                    'bg-token-surfaceCard/45 hover:bg-token-surfaceCard/60 transition-colors',
                  ].join(' ')}
                  onClick={() =>
                    setOpenCats((prev) => {
                      const next = new Set(prev)
                      if (next.has(c.key)) next.delete(c.key)
                      else next.add(c.key)
                      return next
                    })
                  }
                >
                  <div className="min-w-0 text-left">
                    <div className="font-semibold text-token-textMain truncate">{c.label}</div>
                    <div className="text-xs text-token-textMuted">
                      {c.key === '8' && searchTerm.trim()
                        ? `${c.items.length} / ${c.totalCount} tələbə`
                        : `${c.items.length} tələbə`}
                    </div>
                  </div>
                  <div className="text-token-textMuted text-sm font-mono">{isOpen ? '▴' : '▾'}</div>
                </button>

                {isOpen && (
                  <div className="p-2 sm:p-3 space-y-1.5 bg-token-surfaceMain/40">
                    {c.key === '8' ? (
                      <div className="px-1 pb-1">
                        <label className="sr-only" htmlFor="pack-student-search">
                          Tələbə axtarışı
                        </label>
                        <div className="relative">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-token-textMuted pointer-events-none" />
                          <input
                            id="pack-student-search"
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Ad və ya telefon ilə axtar…"
                            className={[
                              'w-full rounded-xl border border-[color:var(--border-subtle)]',
                              'bg-token-surfaceCard/70 text-token-textMain text-sm',
                              'pl-10 pr-3 py-2.5 outline-none transition-colors',
                              'placeholder:text-token-textMuted',
                              'focus:border-primary/45 focus:ring-1 focus:ring-primary/25',
                            ].join(' ')}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    ) : null}
                    {c.key === '8' && searchTerm.trim() && c.items.length === 0 ? (
                      <p className="text-sm text-token-textMuted text-center py-6 px-2">Şagird tapılmadı</p>
                    ) : null}
                    {c.items.map((s) => {
                      const isPartial = s.payment_plan === 'partial'
                      const debt = s.pending_debt != null ? Number(s.pending_debt) : 0
                      const showDebtRed = isPartial && Number.isFinite(debt) && debt > 0.005
                      const showDebt = Number.isFinite(debt) && debt > 0.005
                      return (
                        <div
                          key={s.enrollment_id}
                          className={[
                            'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl px-3 py-2',
                            'border border-[color:var(--border-subtle)]',
                            'bg-token-surfaceCard/40 hover:bg-token-surfaceCard/55 transition-colors',
                          ].join(' ')}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-token-textMain truncate">
                              {s.first_name} {s.last_name}
                            </div>
                            <div className="text-xs text-token-textMuted flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                              <span className="font-mono text-[11px] tabular-nums truncate">{s.phone || '—'}</span>
                              <span>Başlama:</span>
                              <span className="font-mono text-token-textMain tabular-nums">
                                {formatDdMmYyyy(s.lesson_start_date || s.payment_start_date)}
                              </span>
                            </div>
                            <div className="text-[11px] text-token-textMuted mt-1 truncate">
                              Sahə: <span className="text-token-textMain">{s.track_subject_name || '—'}</span>
                              {s.track_group_name ? <span> · {s.track_group_name}</span> : null}
                            </div>
                          </div>

                          <div className="flex flex-col sm:items-end gap-2 shrink-0">
                            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
                              <span className="inline-flex rounded-md bg-indigo-500/10 text-indigo-200/90 px-2 py-0.5 text-xs font-medium">
                                {c.key === '8' ? '8 dərs' : c.key === '12' ? '12 dərs' : 'Paket'}
                              </span>
                              {showDebt ? (
                                <span
                                  className={`text-xs font-semibold tabular-nums ${
                                    showDebtRed ? 'text-rose-300' : 'text-amber-200/90'
                                  }`}
                                >
                                  Qalıq borc: {formatAzn(s.pending_debt)}
                                </span>
                              ) : null}
                            </div>

                            <div className="flex gap-2 flex-wrap justify-end">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void openHistory(s, c.key)}
                                className={
                                  theme === 'light'
                                    ? '!text-slate-900 !border-slate-200 bg-white hover:bg-slate-50'
                                    : undefined
                                }
                              >
                                Tarixçə
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={adjustOpen}
        onClose={() => !adjustSaving && setAdjustOpen(false)}
        title="Balans düzəlişi"
        size="md"
      >
        {adjustRow && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-500 leading-relaxed border border-indigo-500/15 rounded-xl px-3 py-2 bg-[#0f0c29]/80">
              Ay ortasında dərsi kəsən və ya borcu azaltmaq lazım olan hallarda müsbət məbləğ daxil edin. Bu qeyd
              borc–balans hesabına daxil olunur, amma ümumi gəlir rəqəminə <span className="text-indigo-300">daxil edilmir</span>.
            </p>
            <p className="text-gray-400">
              Tələbə:{' '}
              <span className="text-white font-medium">
                {adjustRow.first_name} {adjustRow.last_name}
              </span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Məbləğ (₼) *
                </label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  disabled={adjustSaving}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tarix</label>
                <input
                  type="date"
                  className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  value={adjustDate}
                  onChange={(e) => setAdjustDate(e.target.value)}
                  disabled={adjustSaving}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qeyd</label>
              <input
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                placeholder="İstəyə bağlı"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                disabled={adjustSaving}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" disabled={adjustSaving} onClick={() => setAdjustOpen(false)}>
                Ləğv
              </Button>
              <Button type="button" loading={adjustSaving} onClick={() => void submitAdjust()}>
                Qeydə al
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={quickOpen}
        onClose={() => {
          if (!markingId) {
            setQuickOpen(false)
            setQuickRow(null)
            setQuickLines([])
          }
        }}
        title="Ödəniş əlavə et"
        size="lg"
      >
        {quickRow && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-400">
              Tələbə:{' '}
              <span className="text-white font-medium">
                {quickRow.first_name} {quickRow.last_name}
              </span>
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Sətir əlavə edin; hər sətirdə ödəniş tarixi, məbləğ və istəyə bağlı qeyd.
            </p>

            {/* quick preview removed */}

            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[1fr_7rem_7rem_2.25rem] gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-1">
                <span>Tarix</span>
                <span className="text-right">Məbləğ ₼</span>
                <span>Qeyd</span>
                <span />
              </div>
              {quickLines.map((ln, idx) => (
                <div
                  key={ln.id}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_7rem_1fr_2.25rem] gap-2 items-center rounded-xl border border-indigo-500/15 bg-[#13112e]/50 p-2"
                >
                  <input
                    type="date"
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-2 py-2 text-white text-xs outline-none focus:border-blue-500"
                    value={ln.payment_date}
                    onChange={(e) =>
                      setQuickLines((rows) =>
                        rows.map((r) => (r.id === ln.id ? { ...r, payment_date: e.target.value } : r))
                      )
                    }
                    disabled={!!markingId}
                  />
                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    placeholder="0"
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-2 py-2 text-white text-xs outline-none focus:border-blue-500 tabular-nums text-right"
                    value={ln.amount}
                    onChange={(e) =>
                      setQuickLines((rows) =>
                        rows.map((r) => (r.id === ln.id ? { ...r, amount: e.target.value } : r))
                      )
                    }
                    disabled={!!markingId}
                  />
                  <input
                    className="w-full bg-[#13112e] border border-indigo-500/20 rounded-lg px-2 py-2 text-white text-xs outline-none focus:border-blue-500"
                    placeholder="Qeyd (ixt.)"
                    value={ln.notes}
                    onChange={(e) =>
                      setQuickLines((rows) =>
                        rows.map((r) => (r.id === ln.id ? { ...r, notes: e.target.value } : r))
                      )
                    }
                    disabled={!!markingId}
                  />
                  <div className="flex justify-end sm:justify-center">
                    <button
                      type="button"
                      title="Sətiri sil"
                      disabled={!!markingId || quickLines.length <= 1}
                      onClick={() => setQuickLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== ln.id)))}
                      className="p-2 rounded-lg text-gray-500 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-30 disabled:hover:text-gray-500 disabled:hover:bg-transparent transition-colors"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M9 3h6l1 2h5v2H3V5h5l1-2zm0 5h2v9H9V8zm4 0h2v9h-2V8zM5 8h2v10a2 2 0 002 2h8a2 2 0 002-2V8h2v10a4 4 0 01-4 4H9a4 4 0 01-4-4V8z"
                          fill="currentColor"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="sm:col-span-4 text-[10px] text-gray-600 sm:hidden">Sətir {idx + 1}</div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-center border-dashed border-indigo-500/35"
              disabled={!!markingId}
              onClick={() => setQuickLines((rows) => [...rows, newQuickLine()])}
            >
              + Daha bir sətir əlavə et
            </Button>

            <div className="flex flex-col-reverse sm:flex-row flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" disabled={!!markingId} onClick={() => setQuickOpen(false)}>
                Ləğv
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={!!markingId}
                disabled={!!markingId}
                onClick={() => void submitQuickPay(true)}
              >
                Yadda saxla və davam et
              </Button>
              <Button type="button" loading={!!markingId} onClick={() => void submitQuickPay(false)}>
                Hamısını yadda saxla
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => {
          if (!historyLoading && !deletingPaymentId && !confirmingKey && !legacyRestoreBusy) {
            setHistoryOpen(false)
            setHistorySummary(null)
            setDeletingPaymentId(null)
            setLegacyRestorePrompt(null)
          }
        }}
        title="Ödəniş tarixçəsi"
        size={historyViewMode === 'packages' ? 'lg' : 'md'}
      >
        {historyRow && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-400">
              {historyRow.first_name} {historyRow.last_name}
            </p>
            {!historyLoading &&
              legacyRestorePrompt?.enrollmentId === historyRow?.enrollment_id &&
              legacyRestorePrompt.packages?.length > 0 && (
                <div className="rounded-xl border border-amber-500/45 bg-amber-500/15 p-4 space-y-3">
                  <p className="text-amber-100 font-semibold text-sm">Keçmiş paket ödənişləri</p>
                  <p className="text-amber-50/90 text-xs leading-relaxed">
                    Bu tələbə sistemə əvvəl qeydiyyatdan əlavə olunub.{' '}
                    <span className="font-medium">{legacyRestorePrompt.packages.length} tamamlanmış paket</span> üçün
                    ödənişlər hələ sistemdə yoxdur. Təsdiq etsəniz, hər paket üçün{' '}
                    <span className="font-mono tabular-nums">{formatAzn(legacyRestorePrompt.fee)}</span> yazılacaq (cəmi{' '}
                    <span className="font-mono tabular-nums font-medium">{formatAzn(legacyRestorePrompt.totalAmount)}</span>
                    ).
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      className="flex-1 justify-center"
                      loading={legacyRestoreBusy}
                      onClick={() => void confirmAllLegacyPackPayments()}
                    >
                      Bütün əvvəlki ödənişləri qeydə al
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1 justify-center"
                      disabled={legacyRestoreBusy}
                      onClick={() => setLegacyRestorePrompt(null)}
                    >
                      Sonra
                    </Button>
                  </div>
                </div>
              )}
            {!historyLoading && historyViewMode === 'packages' && historyPackSummary && (
              <div className="rounded-xl border border-indigo-500/20 bg-[#13112e]/70 p-3 space-y-1.5 text-xs">
                <p className="text-gray-500">
                  Paket:{' '}
                  <span className="text-gray-300">
                    {historyPackSummary.billing_type === '12_lessons' ? '12 dərs' : '8 dərs'}
                  </span>
                </p>
                <p className="text-gray-500">
                  Qeydə alınmış cəmi:{' '}
                  <span className="text-emerald-200/95 font-mono tabular-nums">
                    {formatAzn(historyPackSummary.total_paid)}
                  </span>
                </p>
                {historyPackSummary.pre_system_enrollment ? (
                  <div className="pt-1 border-t border-indigo-500/15 space-y-2">
                    <p className="text-amber-200/80 leading-relaxed">
                      Sistemdən əvvəlki qeydiyyat — paketlər qeydiyyat tarixindən hesablanır.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
            {!historyLoading && historyViewMode === 'monthly' && historySummary && (
              <div className="rounded-xl border border-indigo-500/20 bg-[#13112e]/70 p-3 space-y-2 text-xs">
                {historySummary.billing_anchor_future ? (
                  <p className="text-sky-200/90 leading-relaxed">
                    Ankor başlama tarixi bu gündən sonradır — dövr borcu hələ sıfır sayılır; ödənişlər növbəti
                    dövrlərə düşəcək.
                  </p>
                ) : null}
                {historySummary.payment_plan === 'partial' ? (
                  <p className="text-amber-200/90 font-semibold">Ödəniş planı: hissəli</p>
                ) : null}
                <p className="text-gray-500">
                  Ödəniş növü (qeydiyyat):{' '}
                  <span className="text-gray-300">
                    {historySummary.billing_timing === 'prepaid' ? 'əvvəlcədən' : 'sonradan'}
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 tabular-nums pt-1 border-t border-indigo-500/15">
                  <span className="text-gray-500">Ankor dövr sayı</span>
                  <span className="text-right text-white font-medium">{historySummary.subscription_months ?? 0}</span>
                  {historySummary.last_paid_due_ymd ? (
                    <>
                      <span className="text-gray-500">Son ödənilmiş dövr</span>
                      <span className="text-right text-emerald-200/95 tabular-nums">
                        {formatDdMmYyyy(historySummary.last_paid_due_ymd)}
                      </span>
                    </>
                  ) : null}
                  {historySummary.schedule_last_due_ymd ? (
                    <>
                      <span className="text-gray-500">Cari dövr son tarixi</span>
                      <span className="text-right text-white tabular-nums">
                        {formatDdMmYyyy(historySummary.schedule_last_due_ymd)}
                      </span>
                    </>
                  ) : null}
                  <span className="text-gray-500">Yaranan borc</span>
                  <span className="text-right text-white">{formatAzn(historySummary.accrued_total)}</span>
                  <span className="text-gray-500">Cəmi ödənilən</span>
                  <span className="text-right text-emerald-200/95">{formatAzn(historySummary.total_payments)}</span>
                  <span className="text-gray-500">Qalıq borc</span>
                  <span
                    className={`text-right font-semibold ${
                      Number(historySummary.pending_debt) > 0.005 ? 'text-rose-200' : 'text-gray-400'
                    }`}
                  >
                    {formatAzn(historySummary.pending_debt)}
                  </span>
                  {Number(historySummary.net_balance) > 0.005 && !historySummary.billing_anchor_future ? (
                    <>
                      <span className="text-gray-500">Artıq balans</span>
                      <span className="text-right text-emerald-200 font-medium">
                        {formatAzn(historySummary.net_balance)}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
            )}
            {historyLoading && <p className="text-gray-500 text-xs">Yüklənir…</p>}
            {!historyLoading && historyViewMode === 'packages' && historyPackages.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 mb-2 leading-snug">
                  Paketi açın — ödəniş və dərs tarixləri görünür. Tamamlanmış, ödənilməmiş paketlər üçün «Təsdiqlə»
                  düyməsi var.
                </p>
                <ul className="space-y-2 max-h-[min(55vh,22rem)] overflow-y-auto pr-0.5">
                  {historyPackages.map((pkg) => {
                    const cyc = Number(pkg.package_number) || 1
                    const isOpen = openHistoryPackages.has(cyc)
                    const total = Number(pkg.total) || 0
                    const completed = Number(pkg.completed) || 0
                    const paid = Number(pkg.total_paid) || 0
                    const legacyConfirmed = Boolean(pkg.legacy_confirmed)
                    const pkgPayments = Array.isArray(pkg.package_payments) ? pkg.package_payments : []
                    const isDone = total > 0 && completed >= total
                    const needsConfirm =
                      isDone && pkg.payment_status === 'unpaid' && !legacyConfirmed && paid <= 0.005
                    const legacyFee =
                      historyPackSummary?.monthly_fee != null &&
                      Number.isFinite(Number(historyPackSummary.monthly_fee)) &&
                      Number(historyPackSummary.monthly_fee) > 0
                        ? Number(historyPackSummary.monthly_fee)
                        : null
                    const paidLabel =
                      paid > 0.005
                        ? `Ödəniş: ${formatAzn(paid)}`
                        : legacyConfirmed
                          ? legacyFee != null
                            ? `Ödəniş: ${formatAzn(legacyFee)} (keçmiş paket)`
                            : 'Ödənilib (keçmiş paket)'
                          : needsConfirm
                            ? 'Ödəniş gözləyir'
                            : 'Ödəniş: —'
                    const confirmItem =
                      needsConfirm && historyRow?.enrollment_id
                        ? {
                            enrollment_id: historyRow.enrollment_id,
                            package_number: cyc,
                            amount: historyPackSummary?.monthly_fee,
                            due_ymd: pkg.end_ymd ? String(pkg.end_ymd).slice(0, 10) : todayBaku,
                            period: `Paket #${cyc}`,
                          }
                        : null
                    const rowKey = packConfirmKey(confirmItem || { enrollment_id: '', package_number: cyc })
                    const confirmBusy = confirmItem && confirmingKey === rowKey

                    return (
                      <li
                        key={`pkg-${cyc}`}
                        className="rounded-xl border border-indigo-500/20 bg-[#13112e]/60 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleHistoryPkg(cyc)}
                          className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-indigo-500/5 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">
                              Paket #{cyc}
                              {isDone ? ' · Tamamlanıb' : ''}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {formatDdMmYyyy(pkg.start_ymd)} — {formatDdMmYyyy(pkg.end_ymd)} · {completed}/{total}{' '}
                              dərs ·{' '}
                              <span className={paid > 0.005 || legacyConfirmed ? 'text-emerald-300' : needsConfirm ? 'text-amber-200/90' : ''}>
                                {paidLabel}
                              </span>
                            </p>
                          </div>
                          <span className="text-gray-500 text-xs shrink-0">{isOpen ? '▴' : '▾'}</span>
                        </button>
                        {isOpen ? (
                          <div className="px-3 pb-3 border-t border-indigo-500/15 space-y-2">
                            {pkgPayments.length ? (
                              <ul className="space-y-1.5 pt-2">
                                {pkgPayments.map((p) => (
                                  <li
                                    key={p.id}
                                    className="flex items-center justify-between gap-2 text-xs border border-indigo-500/15 rounded-lg px-2 py-1.5"
                                  >
                                    <span className="text-gray-400">{historyDateKey(p)}</span>
                                    <span className="text-white font-mono tabular-nums">{formatAzn(p.amount)}</span>
                                    {p.id ? (
                                      <button
                                        type="button"
                                        title="Sil"
                                        disabled={!!deletingPaymentId || !!confirmingKey}
                                        onClick={() => void deleteHistoryPayment(p.id)}
                                        className="p-1 text-gray-500 hover:text-rose-300"
                                      >
                                        ×
                                      </button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : legacyConfirmed ? (
                              <p className="text-xs text-emerald-300/90 pt-2">Keçmiş paket — təsdiqlənib.</p>
                            ) : (
                              <p className="text-xs text-gray-500 pt-2">Bu paket üçün ödəniş qeydi yoxdur.</p>
                            )}
                            {(pkg.lessons || []).length > 0 ? (
                              <ul className="space-y-1 pt-1">
                                {(pkg.lessons || []).map((ls) => {
                                  const st = lessonStatusLabel(ls.status)
                                  return (
                                    <li
                                      key={`${cyc}-${ls.lesson_number}`}
                                      className="flex justify-between text-[11px] rounded-lg border border-indigo-500/10 px-2 py-1"
                                    >
                                      <span className="text-gray-400">
                                        Dərs {ls.lesson_number}: {formatDdMmYyyy(ls.ymd)}
                                      </span>
                                      <span className={st.cls}>{st.text}</span>
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : null}
                            {confirmItem ? (
                              <Button
                                type="button"
                                size="sm"
                                loading={confirmBusy}
                                disabled={!!confirmingKey && !confirmBusy}
                                onClick={() => void confirmPackPayment(confirmItem, { refreshHistory: true })}
                                className="w-full justify-center mt-1"
                              >
                                Paket ödənişini təsdiqlə
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {!historyLoading && historyViewMode === 'packages' && !historyPackages.length && (
              <p className="text-gray-500 text-xs">Paket məlumatı tapılmadı.</p>
            )}
            {!historyLoading && historyViewMode === 'monthly' && !historyPayments.length && (
              <p className="text-gray-500 text-xs">
                Bu qeydiyyat üçün (və eyni müəllim altında digər qeydiyyatlar üçün) sistemdə ödəniş sətri tapılmadı.
                Əvvəl əl ilə qeyd edilməyibsə və ya köhnə hesab silinibsə, tarixçə boş ola bilər.
              </p>
            )}
            {!historyLoading && historyViewMode === 'monthly' && historyPayments.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Əməliyyatlar</p>
                <p className="text-[10px] text-gray-600 mb-2 leading-snug">
                  Boz «gözləyir» = həmin ay üçün qeyd yoxdur. Cari aydan etibarən «Təsdiqlə» ilə əlavə edin; keçmiş
                  aylar üçün əl ilə ödəniş qeydi və ya bərpa istifadə edin.
                </p>
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {(() => {
                    const dateCounts = historyPayments.reduce((acc, p) => {
                      const k = historyDateKey(p)
                      acc[k] = (acc[k] || 0) + 1
                      return acc
                    }, {})
                    return historyPayments.map((p) => {
                    const dateLabel = historyDateKey(p)
                    const dupDate = (dateCounts[dateLabel] || 0) > 1
                    const isUnpaid = p.timeline_status === 'unpaid'
                    const mf = historySummary?.monthly_fee != null ? Number(historySummary.monthly_fee) : NaN
                    const partial = historySummary?.payment_plan === 'partial'
                    const amt = Number(p.amount)
                    const under =
                      !isUnpaid &&
                      partial &&
                      Number.isFinite(mf) &&
                      mf > 0 &&
                      Number.isFinite(amt) &&
                      amt > 0 &&
                      amt + 0.005 < mf
                    const dueYmd = String(p.due_ymd || p.payment_date || '').slice(0, 10)
                    const canConfirm = canConfirmUnpaidDue(p)
                    const confirmItem =
                      canConfirm && historyRow?.enrollment_id
                        ? {
                            enrollment_id: historyRow.enrollment_id,
                            due_ymd: dueYmd,
                            amount:
                              Number.isFinite(amt) && amt > 0
                                ? amt
                                : Number.isFinite(mf) && mf > 0
                                  ? mf
                                  : undefined,
                          }
                        : null
                    const rowConfirmKey = confirmItem ? dueConfirmKey(confirmItem) : null
                    const confirmBusy = rowConfirmKey && confirmingKey === rowConfirmKey
                    const busy = !!deletingPaymentId || historyLoading || !!confirmingKey
                    const rowKey = p.id || `due-${String(p.due_ymd || p.payment_date || dateLabel)}`
                    return (
                      <li
                        key={rowKey}
                        className={`flex items-center justify-between gap-2 border rounded-lg px-2 py-2 sm:px-3 bg-[#13112e]/60 ${
                          isUnpaid
                            ? 'border-amber-500/25 bg-amber-950/15'
                            : under
                              ? 'border-rose-500/40 bg-rose-950/20'
                              : 'border-indigo-500/15'
                        }`}
                      >
                        <div className="flex flex-col gap-0.5 shrink-0 min-w-[5.5rem]">
                          <span
                            className={`text-xs whitespace-nowrap ${
                              isUnpaid ? 'text-amber-200/90' : under ? 'text-rose-200/95' : 'text-gray-400'
                            }`}
                          >
                            {dateLabel}
                          </span>
                          {isUnpaid ? (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-300/90">
                              gözləyir
                            </span>
                          ) : null}
                          {dupDate ? (
                            <span className="text-[9px] text-sky-300/90">eyni gün — #{String(p.id || '').slice(0, 8)}</span>
                          ) : null}
                          {p.period ? (
                            <span className="text-[9px] text-gray-500 leading-tight truncate max-w-[9rem]">
                              {p.period}
                            </span>
                          ) : null}
                          {p.from_other_enrollment ? (
                            <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-300/90">
                              köhnə qeyd.
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`font-mono tabular-nums text-sm font-medium shrink-0 ${
                            isUnpaid ? 'text-amber-200/80' : under ? 'text-rose-200' : 'text-white'
                          }`}
                        >
                          {isUnpaid ? '—' : formatAzn(p.amount)}
                        </span>
                        {p.id ? (
                          <button
                            type="button"
                            title="Ödənişi sil"
                            disabled={busy}
                            onClick={() => void deleteHistoryPayment(p.id)}
                            className="ml-auto p-1.5 rounded-lg text-gray-500 hover:text-rose-300 hover:bg-rose-500/15 disabled:opacity-40 shrink-0 transition-colors"
                          >
                            {deletingPaymentId === p.id ? (
                              <span className="text-[10px] text-gray-400 tabular-nums">…</span>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                                <path
                                  d="M9 3h6l1 2h5v2H3V5h5l1-2zm0 5h2v9H9V8zm4 0h2v9h-2V8zM5 8h2v10a2 2 0 002 2h8a2 2 0 002-2V8h2v10a4 4 0 01-4 4H9a4 4 0 01-4-4V8z"
                                  fill="currentColor"
                                />
                              </svg>
                            )}
                          </button>
                        ) : canConfirm && confirmItem ? (
                          <Button
                            type="button"
                            size="sm"
                            loading={confirmBusy}
                            disabled={busy && !confirmBusy}
                            onClick={() => void confirmDuePayment(confirmItem, { refreshHistory: true })}
                            className="ml-auto shrink-0 !px-3 !py-1.5 text-xs"
                          >
                            Təsdiqlə
                          </Button>
                        ) : isUnpaid ? (
                          <span className="ml-auto text-[10px] text-gray-500 shrink-0 text-right max-w-[5rem] leading-tight">
                            keçmiş ay
                          </span>
                        ) : null}
                      </li>
                    )
                  })
                  })()}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
