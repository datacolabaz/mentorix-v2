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
  const d = String(val).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '—'
  const [y, m, day] = d.split('-')
  return `${day}.${m}.${y}`
}

const statusLabel = {
  gözlənilir: 'Gözlənilir',
  ödənilib: 'Ödənilib',
  təyin_edilməyib: '—',
}

const statusPill = {
  gözlənilir: 'bg-amber-500/15 text-amber-200 border-amber-500/25',
  ödənilib: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/25',
  təyin_edilməyib: 'bg-[#1a1740] text-gray-500 border-indigo-500/15',
}

export default function InstructorPayments() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [students, setStudents] = useState([])
  const [markingId, setMarkingId] = useState(null)
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [legacyRow, setLegacyRow] = useState(null)
  const [legacyAmount, setLegacyAmount] = useState('')
  const [legacyDate, setLegacyDate] = useState(() => new Date().toISOString().split('T')[0])
  const [legacyKind, setLegacyKind] = useState('past_payment')
  const [legacyNotes, setLegacyNotes] = useState('')
  const [legacySaving, setLegacySaving] = useState(false)
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
        payment_method: 'manual',
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

  const markPaid = async (enrollmentId) => {
    setMarkingId(enrollmentId)
    try {
      const d = await api.post('/payments/mark-monthly-paid', { enrollment_id: enrollmentId })
      if (d.alreadyPaid) toast(d.message || 'Bu ay üçün artıq qeyd var', 'info')
      else toast('Ödəniş qeydə alındı')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setMarkingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">Ödənişlər</h1>
        <p className="text-gray-500 text-sm mt-1">
          Aylıq ödənişlər, cari ay üzrə gözlənilənlər və ümumi gəlir.
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
            {loading ? '…' : `${pendingCount} tələbə · cari ay üçün gözlənilir`}
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
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-indigo-500/25 text-left text-[11px] uppercase tracking-wider text-indigo-300/70 bg-[#0f0c29]/90">
                  <th className="py-3.5 px-4 font-semibold">Ad</th>
                  <th className="py-3.5 px-4 font-semibold">Soyad</th>
                  <th className="py-3.5 px-4 font-semibold">Nömrə</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Ödəniş başlanğıcı</th>
                  <th className="py-3.5 px-4 font-semibold">Ödəniş statusu</th>
                  <th className="py-3.5 px-4 font-semibold whitespace-nowrap">Keçmiş</th>
                  <th className="py-3.5 px-4 font-semibold w-[1%] whitespace-nowrap text-right">Əməl</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {students.map((s) => {
                  const st = s.payment_status || 'təyin_edilməyib'
                  const showPay = st === 'gözlənilir'
                  return (
                    <tr
                      key={s.enrollment_id}
                      className="border-b border-indigo-500/10 hover:bg-indigo-500/[0.06] transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-white">{s.first_name}</td>
                      <td className="py-3.5 px-4">{s.last_name}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-400 tabular-nums">{s.phone || '—'}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-gray-300 tabular-nums whitespace-nowrap">
                        {formatDdMmYyyy(s.payment_start_date)}
                      </td>
                      <td className="py-3.5 px-4 align-top">
                        {s.pre_system_enrollment ? (
                          <span className="inline-flex text-[10px] font-semibold px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-400/30 text-sky-200">
                            Sistemdən əvvəl
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusPill[st] || statusPill.təyin_edilməyib}`}
                        >
                          {statusLabel[st] || '—'}
                        </span>
                        {s.monthly_fee != null && Number(s.monthly_fee) > 0 && (
                          <span className="block text-[11px] text-gray-500 mt-1 tabular-nums">
                            Aylıq: {formatAzn(s.monthly_fee)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button type="button" size="sm" variant="secondary" onClick={() => openLegacy(s)}>
                            Keçmiş qeyd
                          </Button>
                          {showPay ? (
                            <Button
                              type="button"
                              size="sm"
                              loading={markingId === s.enrollment_id}
                              onClick={() => void markPaid(s.enrollment_id)}
                              className="!bg-indigo-600 hover:!bg-indigo-500 !text-white border-0"
                            >
                              Ödənildi
                            </Button>
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
            {legacyRow.pre_system_enrollment && (
              <p className="text-sky-200/95 text-xs leading-relaxed border border-sky-500/25 rounded-xl px-3 py-2 bg-sky-500/10">
                Bu tələbə sistemin aktivləşdirilməsindən öncə qeydiyyatdan keçmişdir. Aşağıdakı qeyd ümumi gəlir
                statistikasına daxil ediləcək.
              </p>
            )}
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
    </div>
  )
}
