import { useCallback, useEffect, useMemo, useState } from 'react'
import { anchorToYmd, computeMonthlyBalanceState } from '../../lib/subscriptionBillingPreview'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'
import Tooltip from '../../components/common/Tooltip'
import { formatAgoShort, getLastSmsForStudentName, smsHistoryMock } from '../../mock/smsHistory'

function formatAzn(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `${x.toLocaleString('az-AZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₼`
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

export default function InstructorPayments() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [students, setStudents] = useState([])
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
  const [historyLoading, setHistoryLoading] = useState(false)
  const [deletingPaymentId, setDeletingPaymentId] = useState(null)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustRow, setAdjustRow] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustDate, setAdjustDate] = useState(() => new Date().toISOString().split('T')[0])
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const toast = useToast()
  const theme = useUiStore((s) => s.theme)
  const smsLastByName = useMemo(() => {
    const map = new Map()
    for (const item of smsHistoryMock || []) {
      if (!Array.isArray(item.students)) continue
      for (const name of item.students) {
        const prev = map.get(name)
        if (!prev || new Date(item.createdAt).getTime() > new Date(prev.createdAt).getTime()) {
          map.set(name, item)
        }
      }
    }
    return map
  }, [])

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
    setQuickRow(row)
    const deficit =
      row.pending_debt != null && Number.isFinite(Number(row.pending_debt)) && Number(row.pending_debt) > 0
        ? Number(row.pending_debt)
        : null
    const mf = row.monthly_fee != null && Number.isFinite(Number(row.monthly_fee)) ? Number(row.monthly_fee) : null
    const firstAmt = deficit != null && deficit > 0 ? deficit : mf != null && mf > 0 ? mf : ''
    setQuickLines([newQuickLine({ amount: firstAmt === '' ? '' : String(firstAmt) })])
    setQuickOpen(true)
  }

  const quickPartialUnderpay = useMemo(() => {
    if (!quickRow || quickRow.billing_type !== 'monthly' || quickRow.payment_plan !== 'partial') return false
    const mf = Number(quickRow.monthly_fee)
    if (!Number.isFinite(mf) || mf <= 0) return false
    return quickLines.some((ln) => {
      const a = Number(ln.amount)
      return Number.isFinite(a) && a > 0 && a + 0.005 < mf
    })
  }, [quickRow, quickLines])

  const quickPreview = useMemo(() => {
    if (!quickRow || quickRow.billing_type !== 'monthly') return null
    const mf = Number(quickRow.monthly_fee)
    if (!Number.isFinite(mf) || mf <= 0) return null
    const anchor = anchorToYmd(quickRow.lesson_start_date || quickRow.payment_start_date)
    if (!anchor) return null
    const basePaid = Number(quickRow.total_payments) || 0
    let add = 0
    for (const ln of quickLines) {
      const a = Number(ln.amount)
      if (Number.isFinite(a) && a > 0) add += a
    }
    return computeMonthlyBalanceState({
      monthly_fee: mf,
      anchor_ymd: anchor,
      today_ymd: todayBaku,
      total_paid: basePaid + add,
    })
  }, [quickRow, quickLines, todayBaku])

  const [openCats, setOpenCats] = useState(() => new Set())

  const categorized = useMemo(() => {
    const list = Array.isArray(students) ? students : []
    const cats = [
      { key: 'monthly', label: 'Aylıq paketlər', match: (s) => String(s.billing_type) === 'monthly' },
      { key: '8', label: '8 dərs paketləri', match: (s) => String(s.billing_type) === '8_lessons' },
      { key: '12', label: '12 dərs paketləri', match: (s) => String(s.billing_type) === '12_lessons' },
      { key: 'other', label: 'Digər', match: (s) => !['monthly', '8_lessons', '12_lessons'].includes(String(s.billing_type)) },
    ]
    return cats
      .map((c) => ({ ...c, items: list.filter(c.match) }))
      .filter((c) => c.items.length > 0)
  }, [students])

  const submitQuickPay = async (keepOpen = false) => {
    if (!quickRow?.enrollment_id) return
    const payload = []
    for (const ln of quickLines) {
      const amt = Number(ln.amount)
      if (!Number.isFinite(amt) || amt <= 0) continue
      payload.push({
        amount: amt,
        payment_date: ln.payment_date && /^\d{4}-\d{2}-\d{2}$/.test(ln.payment_date) ? ln.payment_date : undefined,
        notes: ln.notes?.trim() || undefined,
      })
    }
    if (payload.length === 0) {
      toast('Ən azı bir sətirdə məbləğ daxil edin', 'error')
      return
    }
    setMarkingId(quickRow.enrollment_id)
    try {
      if (payload.length === 1) {
        await api.post('/payments/mark-monthly-paid', {
          enrollment_id: quickRow.enrollment_id,
          amount: payload[0].amount,
          payment_date: payload[0].payment_date,
          notes: payload[0].notes,
        })
      } else {
        await api.post('/payments/mark-monthly-paid-batch', {
          enrollment_id: quickRow.enrollment_id,
          payments: payload,
        })
      }
      toast(payload.length > 1 ? `${payload.length} ödəniş qeydə alındı` : 'Ödəniş qeydə alındı')
      if (!keepOpen) {
        setQuickOpen(false)
        setQuickRow(null)
        setQuickLines([])
      } else {
        setQuickLines([newQuickLine()])
      }
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setMarkingId(null)
    }
  }

  const fetchHistoryForEnrollment = async (enrollmentId) => {
    setHistoryLoading(true)
    try {
      const d = await api.get('/payments/enrollment/' + encodeURIComponent(enrollmentId) + '/history')
      setHistoryPayments(Array.isArray(d.payments) ? d.payments : [])
      setHistorySummary(d.balance_summary ?? null)
    } catch (e) {
      toast(e?.message || 'Tarixçə yüklənmədi', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  const openHistory = async (row) => {
    if (!row?.enrollment_id) return
    setHistoryRow(row)
    setHistoryOpen(true)
    setHistoryPayments([])
    setHistorySummary(null)
    await fetchHistoryForEnrollment(row.enrollment_id)
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
      await fetchHistoryForEnrollment(eid)
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
          Aylıq paketdə keçmiş aylar üçün <span className="text-primary/90 font-semibold">Ödəniş</span> pəncərəsində hər sətirdə
          real ödəniş tarixini qeyd edin — məbləğlər cəmlənir və ankor borc ilə uyğunlaşır. Qalıq borc və balans{' '}
          <span className="text-primary/90 font-semibold">Tarixçə</span>də görünür. Davamiyyət ödənişdən ayrıdır. «Balans düzəlişi»
          ümumi gəlirə daxil edilmir.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card hover className="p-5">
          <div className="text-[11px] font-semibold text-token-textMuted uppercase tracking-widest mb-2">
            Total Earnings
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-token-textMain tabular-nums">
            {loading ? '…' : formatAzn(totalEarnings)}
          </div>
          <p className="text-xs text-token-textMuted mt-2">Tamamlanmış ödənişlərin cəmi (bütün dövr)</p>
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
              : `${pendingCount} tələbə · aylıq paketlər üzrə qalıq borc cəmi`}
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
                    <div className="text-xs text-token-textMuted">{c.items.length} tələbə</div>
                  </div>
                  <div className="text-token-textMuted text-sm font-mono">{isOpen ? '▴' : '▾'}</div>
                </button>

                {isOpen && (
                  <div className="p-2 sm:p-3 space-y-1.5 bg-token-surfaceMain/40">
                    {c.items.map((s) => {
                      const isMonthly =
                        s.billing_type === 'monthly' && s.monthly_fee != null && Number(s.monthly_fee) > 0
                      const isPartial = s.payment_plan === 'partial'
                      const debt = s.pending_debt != null ? Number(s.pending_debt) : 0
                      const showDebtRed = isMonthly && isPartial && Number.isFinite(debt) && debt > 0.005
                      const showDebt = isMonthly && Number.isFinite(debt) && debt > 0.005
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
                          <div className="text-[11px] text-token-textMuted mt-1">
                            {(() => {
                              const full = [s.first_name, s.last_name].filter(Boolean).join(' ').trim()
                              const last = smsLastByName.get(full) || getLastSmsForStudentName(full, smsHistoryMock)
                              if (!last) {
                                return <span className="text-token-textMuted">SMS göndərilməyib</span>
                              }
                              const when = formatAgoShort(last.createdAt)
                              const status =
                                last.status === 'failed'
                                  ? { label: 'Uğursuz', cls: 'text-rose-600 dark:text-rose-300' }
                                  : last.status === 'scheduled'
                                    ? { label: 'Plan', cls: 'text-amber-600 dark:text-amber-200/90' }
                                    : { label: 'Göndərildi', cls: 'text-emerald-600 dark:text-emerald-200/90' }
                              return (
                                <Tooltip
                                  content={
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-token-textMain">Son SMS</span>
                                        <span className={['text-[10px] font-semibold', status.cls].join(' ')}>
                                          {status.label}
                                        </span>
                                      </div>
                                      <div className="text-[10px] text-token-textMuted">
                                        {new Date(last.createdAt).toLocaleString('az-AZ')}
                                      </div>
                                      <div className="text-[11px] text-token-textMain leading-snug">
                                        {String(last.message || '—')}
                                      </div>
                                    </div>
                                  }
                                >
                                  <span className="inline-flex items-center gap-2 cursor-default">
                                    <span className="text-token-textMuted">Son SMS:</span>
                                    <span className="text-token-textMain font-semibold">{when}</span>
                                    <span className={['text-[10px] font-semibold', status.cls].join(' ')}>· {status.label}</span>
                                  </span>
                                </Tooltip>
                              )
                            })()}
                          </div>
                          </div>

                          <div className="flex flex-col sm:items-end gap-2 shrink-0">
                            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
                              {isMonthly ? (
                                isPartial ? (
                                  <span className="inline-flex rounded-md bg-rose-500/15 text-rose-200 px-2 py-0.5 text-xs font-semibold">
                                    Hissəli
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-md bg-emerald-500/10 text-emerald-200/90 px-2 py-0.5 text-xs font-medium">
                                    Tam
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex rounded-md bg-indigo-500/10 text-indigo-200/90 px-2 py-0.5 text-xs font-medium">
                                  {c.key === '8' ? '8 dərs' : c.key === '12' ? '12 dərs' : 'Paket'}
                                </span>
                              )}

                              {isMonthly ? (
                                <>
                                  <span className="text-xs text-token-textMuted">
                                    Cari balans:{' '}
                                    <span className="text-token-textMain font-mono tabular-nums">{formatAzn(s.net_balance)}</span>
                                  </span>
                                  <span className="text-xs text-token-textMuted">
                                    Ödənilib:{' '}
                                    <span className="text-token-textMain font-mono tabular-nums">{formatAzn(s.total_payments)}</span>
                                  </span>
                                  <span
                                    className={`text-xs font-semibold tabular-nums ${
                                      showDebtRed ? 'text-rose-300' : showDebt ? 'text-amber-200/90' : 'text-token-textMuted'
                                    }`}
                                  >
                                    Qalıq borc: {formatAzn(s.pending_debt)}
                                  </span>
                                </>
                              ) : null}
                            </div>

                            <div className="flex gap-2 flex-wrap justify-end">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void openHistory(s)}
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
        title="Ödənişlər (aylıq abunə)"
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
              Bir neçə ay üçün sətir əlavə edin; hər sətirdə ödəniş tarixi, məbləğ və istəyə bağlı qeyd. Borc Bakı
              təqvimi üzrə ankorla hesablanır — aşağıda önizləmə canlı yenilənir.
            </p>

            {quickPartialUnderpay && quickPreview ? (
              <p className="text-xs text-rose-200/95 font-medium rounded-xl border border-rose-500/30 bg-rose-950/25 px-3 py-2">
                Hissəli ödəniş planı: bəzi sətirlərdə məbləğ aylıq məbləğdən azdır — qalıq borc aşağıda qırmızı ilə
                göstərilir; tam ödənişədək ödənişlər əlavə edin.
              </p>
            ) : null}

            {quickPreview && (
              <div className="rounded-xl border border-indigo-500/25 bg-[#0f0c29]/80 px-3 py-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
                <span className="text-gray-500">Cari balans (ödənişdən sonra)</span>
                <span
                  className={`text-right font-semibold ${
                    quickPreview.net_balance > 0.005 ? 'text-emerald-200' : 'text-gray-400'
                  }`}
                >
                  {formatAzn(quickPreview.net_balance)}
                </span>
                <span className="text-gray-500">Qalıq borc</span>
                <span
                  className={`text-right font-semibold ${
                    quickPreview.pending_debt > 0.005 ? 'text-rose-300' : 'text-gray-400'
                  }`}
                >
                  {formatAzn(quickPreview.pending_debt)}
                </span>
              </div>
            )}

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
          if (!historyLoading && !deletingPaymentId) {
            setHistoryOpen(false)
            setHistorySummary(null)
            setDeletingPaymentId(null)
          }
        }}
        title="Ödəniş tarixçəsi"
        size="md"
      >
        {historyRow && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-400">
              {historyRow.first_name} {historyRow.last_name}
            </p>
            {!historyLoading && historySummary && (
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
            {!historyLoading && !historyPayments.length && (
              <p className="text-gray-500 text-xs">Hələ ödəniş qeydi yoxdur.</p>
            )}
            {!historyLoading && historyPayments.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Əməliyyatlar</p>
                <p className="text-[10px] text-gray-600 mb-2 leading-snug">
                  Təkrarlanan və ya səhv qeydi silin — cəm avtomatik yenilənir (ümumi gəlir də SQL üzrə düzəlir).
                </p>
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                  {historyPayments.map((p) => {
                    const mf = historySummary?.monthly_fee != null ? Number(historySummary.monthly_fee) : NaN
                    const partial = historySummary?.payment_plan === 'partial'
                    const amt = Number(p.amount)
                    const under =
                      partial &&
                      Number.isFinite(mf) &&
                      mf > 0 &&
                      Number.isFinite(amt) &&
                      amt > 0 &&
                      amt + 0.005 < mf
                    const busy = !!deletingPaymentId || historyLoading
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center justify-between gap-2 border rounded-lg px-2 py-2 sm:px-3 bg-[#13112e]/60 ${
                          under ? 'border-rose-500/40 bg-rose-950/20' : 'border-indigo-500/15'
                        }`}
                      >
                        <span className={`text-xs whitespace-nowrap shrink-0 ${under ? 'text-rose-200/95' : 'text-gray-400'}`}>
                          {formatDdMmYyyy(p.payment_date || p.paid_at)}
                        </span>
                        <span
                          className={`font-mono tabular-nums text-sm font-medium shrink-0 ${
                            under ? 'text-rose-200' : 'text-white'
                          }`}
                        >
                          {formatAzn(p.amount)}
                        </span>
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
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
