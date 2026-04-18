import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'

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
  const [quickAmount, setQuickAmount] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyRow, setHistoryRow] = useState(null)
  const [historyPayments, setHistoryPayments] = useState([])
  const [historySummary, setHistorySummary] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [legacyRow, setLegacyRow] = useState(null)
  const [legacyAmount, setLegacyAmount] = useState('')
  const [legacyDate, setLegacyDate] = useState(() => new Date().toISOString().split('T')[0])
  const [legacyKind, setLegacyKind] = useState('past_payment')
  const [legacyNotes, setLegacyNotes] = useState('')
  const [legacySaving, setLegacySaving] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustRow, setAdjustRow] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustDate, setAdjustDate] = useState(() => new Date().toISOString().split('T')[0])
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    setErr(null)
    setLoading(true)
    try {
      const d = await api.get('/payments/instructor-board')
      setTotalEarnings(d.totalEarnings ?? 0)
      setPendingCount(d.pendingCount ?? 0)
      setPendingAmount(d.pendingAmount ?? 0)
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

  const openLegacy = (row) => {
    setLegacyRow(row)
    setLegacyAmount('')
    setLegacyDate(new Date().toISOString().split('T')[0])
    setLegacyKind('past_payment')
    setLegacyNotes('')
    setLegacyOpen(true)
  }

  const submitLegacy = async () => {
    if (!legacyRow?.enrollment_id) return
    const amt = Number(legacyAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast('Məbləği düzgün daxil edin', 'error')
      return
    }
    setLegacySaving(true)
    try {
      await api.post('/payments', {
        enrollment_id: legacyRow.enrollment_id,
        amount: amt,
        payment_method: 'cash',
        payment_date: legacyDate || null,
        status: 'completed',
        legacy_kind: legacyKind,
        notes: legacyNotes.trim() || undefined,
      })
      toast('Qeyd əlavə olundu')
      setLegacyOpen(false)
      setLegacyRow(null)
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setLegacySaving(false)
    }
  }

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

  const openQuickPay = (row) => {
    setQuickRow(row)
    const deficit =
      row.pending_debt != null && Number.isFinite(Number(row.pending_debt)) && Number(row.pending_debt) > 0
        ? String(Number(row.pending_debt))
        : ''
    const mf = row.monthly_fee != null ? String(row.monthly_fee) : ''
    setQuickAmount(deficit || mf)
    setQuickOpen(true)
  }

  const submitQuickPay = async () => {
    if (!quickRow?.enrollment_id) return
    const amt = Number(quickAmount)
    if (!Number.isFinite(amt) || amt <= 0) {
      toast('Məbləği düzgün daxil edin', 'error')
      return
    }
    setMarkingId(quickRow.enrollment_id)
    try {
      await api.post('/payments/mark-monthly-paid', {
        enrollment_id: quickRow.enrollment_id,
        amount: amt,
      })
      toast('Ödəniş qeydə alındı')
      setQuickOpen(false)
      setQuickRow(null)
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setMarkingId(null)
    }
  }

  const openHistory = async (row) => {
    if (!row?.enrollment_id) return
    setHistoryRow(row)
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryPayments([])
    setHistorySummary(null)
    try {
      const d = await api.get('/payments/enrollment/' + encodeURIComponent(row.enrollment_id) + '/history')
      setHistoryPayments(Array.isArray(d.payments) ? d.payments : [])
      setHistorySummary(d.balance_summary ?? null)
    } catch (e) {
      toast(e?.message || 'Tarixçə yüklənmədi', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Ödənişlər</h1>
        <p className="text-gray-500 text-sm mt-1">
          Cədvəldə yalnız aylıq məbləğ və ödənilənlər göstərilir. Qalıq borc və balans yalnız{' '}
          <span className="text-indigo-300">Tarixçə</span> pəncərəsində hesablanır. Davamiyyət ödənişdən tam ayrıdır.
          «Balans düzəlişi» ümumi gəlirə daxil edilmir.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-5 border border-indigo-500/20 bg-gradient-to-br from-[#13112e] to-[#0f0c29] shadow-lg shadow-indigo-950/20">
          <div className="text-[11px] font-semibold text-indigo-300/80 uppercase tracking-widest mb-2">
            Total Earnings
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-white tabular-nums">
            {loading ? '…' : formatAzn(totalEarnings)}
          </div>
          <p className="text-xs text-gray-500 mt-2">Tamamlanmış ödənişlərin cəmi (bütün dövr)</p>
        </Card>
        <Card className="p-5 border border-indigo-500/20 bg-gradient-to-br from-[#13112e] to-[#0f0c29] shadow-lg shadow-indigo-950/20">
          <div className="text-[11px] font-semibold text-indigo-300/80 uppercase tracking-widest mb-2">
            Pending Payments
          </div>
          <div className="font-display font-extrabold text-2xl sm:text-3xl text-amber-200/95 tabular-nums">
            {loading ? '…' : formatAzn(pendingAmount)}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {loading
              ? '…'
              : `${pendingCount} tələbə · aylıq paketlər üzrə qalıq borc cəmi`}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden border border-indigo-500/20">
        <div className="px-4 py-3 border-b border-indigo-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#13112e]/80">
          <h2 className="font-display font-bold text-sm text-white tracking-wide">Tələbələr</h2>
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

        {!loading && !err && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px] table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
                <col className="w-[34%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-indigo-500/25 text-left text-[11px] uppercase tracking-wider text-indigo-300/70 bg-[#0f0c29]/90">
                  <th className="py-3 px-3 font-semibold">Tələbə</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">Başlama</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Aylıq</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Cəmi ödənilən</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Əməllər</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {students.map((s) => {
                  const isMonthly = s.billing_type === 'monthly' && s.monthly_fee != null && Number(s.monthly_fee) > 0
                  return (
                    <tr
                      key={s.enrollment_id}
                      className="border-b border-indigo-500/10 hover:bg-indigo-500/[0.06] transition-colors align-top"
                    >
                      <td className="py-3 px-3 min-w-0">
                        <div className="font-medium text-white truncate" title={`${s.first_name} ${s.last_name}`}>
                          {s.first_name} {s.last_name}
                        </div>
                        <div className="font-mono text-[11px] text-gray-500 tabular-nums truncate mt-0.5">
                          {s.phone || '—'}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-gray-300 whitespace-nowrap">
                        <span className="font-mono tabular-nums text-white/90">
                          {formatDdMmYyyy(s.lesson_start_date || s.payment_start_date)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-white font-medium whitespace-nowrap">
                        {isMonthly ? formatAzn(s.monthly_fee) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-white font-medium whitespace-nowrap">
                        {isMonthly ? formatAzn(s.total_payments) : '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex flex-col gap-1.5 items-end w-full max-w-[11rem] ml-auto">
                          <Button type="button" size="sm" variant="secondary" className="w-full justify-center" onClick={() => openLegacy(s)}>
                            Keçmiş qeyd
                          </Button>
                          {isMonthly ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="w-full justify-center"
                                onClick={() => openAdjust(s)}
                              >
                                Balans düzəlişi
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                loading={markingId === s.enrollment_id}
                                onClick={() => openQuickPay(s)}
                                className="w-full justify-center !bg-indigo-600 hover:!bg-indigo-500 !text-white border-0"
                              >
                                Ödəniş
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="w-full justify-center"
                                onClick={() => void openHistory(s)}
                              >
                                Tarixçə
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {!students.length && (
              <div className="text-center py-14 text-gray-500 text-sm">Bu qrupda tələbə yoxdur</div>
            )}
          </div>
        )}
      </Card>

      <Modal
        open={legacyOpen}
        onClose={() => !legacySaving && setLegacyOpen(false)}
        title="Keçmiş ödəniş / başlanğıc balansı"
        size="md"
      >
        {legacyRow && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-gray-500 leading-relaxed border border-indigo-500/15 rounded-xl px-3 py-2 bg-[#0f0c29]/80">
              <span className="font-semibold text-gray-400">Nə üçündür?</span> Edupanelə düşməmiş real ödənişləri və ya
              başlanğıcda artıq ödənilmiş məbləği burada qeyd edirsiniz; bunlar tamamlanmış ödəniş kimi saxlanılır və
              aylıq abunə borcunun hesablanmasına daxil olunur. Yeni ödəniş üçün siyahıdakı{' '}
              <span className="text-indigo-300 font-medium">Ödəniş</span> düyməsindən istifadə edin.
            </p>
            <p className="text-gray-400">
              Tələbə:{' '}
              <span className="text-white font-medium">
                {legacyRow.first_name} {legacyRow.last_name}
              </span>
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Növ</label>
              <select
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                value={legacyKind}
                onChange={(e) => setLegacyKind(e.target.value)}
                disabled={legacySaving}
              >
                <option value="past_payment">Keçmiş ödəniş qeydi</option>
                <option value="initial_balance">Başlanğıc balansı</option>
              </select>
            </div>
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
                  value={legacyAmount}
                  onChange={(e) => setLegacyAmount(e.target.value)}
                  disabled={legacySaving}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Ödəniş tarixi
                </label>
                <input
                  type="date"
                  className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                  value={legacyDate}
                  onChange={(e) => setLegacyDate(e.target.value)}
                  disabled={legacySaving}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qeyd</label>
              <input
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                placeholder="İstəyə bağlı"
                value={legacyNotes}
                onChange={(e) => setLegacyNotes(e.target.value)}
                disabled={legacySaving}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" disabled={legacySaving} onClick={() => setLegacyOpen(false)}>
                Ləğv
              </Button>
              <Button type="button" loading={legacySaving} onClick={() => void submitLegacy()}>
                Qeydə al
              </Button>
            </div>
          </div>
        )}
      </Modal>

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

      <Modal open={quickOpen} onClose={() => !markingId && setQuickOpen(false)} title="Ödəniş (aylıq abunə)" size="md">
        {quickRow && (
          <div className="space-y-4 text-sm">
            <p className="text-gray-400">
              Tələbə:{' '}
              <span className="text-white font-medium">
                {quickRow.first_name} {quickRow.last_name}
              </span>
            </p>
            <p className="text-xs text-gray-500">
              Hissəli və ya tam ödəniş: istənilən məbləği daxil edin. Borc təqvim ankoruna görə (keçmiş dövr sayı ×
              aylıq) avtomatik yenilənir.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Məbləğ (₼)</label>
              <input
                type="number"
                min={0.01}
                step={0.01}
                className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white outline-none focus:border-blue-500"
                value={quickAmount}
                onChange={(e) => setQuickAmount(e.target.value)}
                disabled={!!markingId}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" disabled={!!markingId} onClick={() => setQuickOpen(false)}>
                Ləğv
              </Button>
              <Button type="button" loading={!!markingId} onClick={() => void submitQuickPay()}>
                Qeydə al
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={historyOpen}
        onClose={() => {
          if (!historyLoading) {
            setHistoryOpen(false)
            setHistorySummary(null)
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
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Əməliyyatlar</p>
                <ul className="space-y-2 max-h-56 overflow-y-auto">
                  {historyPayments.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between gap-3 border border-indigo-500/15 rounded-lg px-3 py-2 bg-[#13112e]/60"
                    >
                      <span className="text-gray-400 text-xs whitespace-nowrap">
                        {formatDdMmYyyy(p.payment_date || p.paid_at)}
                      </span>
                      <span className="text-white font-mono tabular-nums">{formatAzn(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
