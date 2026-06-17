import { useEffect, useMemo, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import {
  computeFinalPackageFee,
  formatAzn,
  paymentSchemeFromForm,
  paymentTimingLabel,
} from '../../lib/groupPaymentTerms'

const WEEKDAY_SHORT = ['', 'B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B']

function billingTypeLabel(bt) {
  if (bt === '12_lessons') return '12 dərs paketi'
  return '8 dərs paketi'
}

function lessonDaysLabel(weekdays, times) {
  const days = Array.isArray(weekdays) ? weekdays : []
  if (!days.length) return '—'
  return days
    .map((d) => {
      const t = times?.[String(d)] || times?.[d]
      return t ? `${WEEKDAY_SHORT[d] || d} ${String(t).slice(0, 5)}` : WEEKDAY_SHORT[d] || d
    })
    .join(', ')
}

function buildLocalPreview(group) {
  if (!group) return null
  const fee = computeFinalPackageFee(group.default_package_fee, group.default_discount_percent)
  const scheme = paymentSchemeFromForm(group)
  let weekdays = group.default_lesson_weekdays
  if (typeof weekdays === 'string') {
    try {
      weekdays = JSON.parse(weekdays)
    } catch {
      weekdays = []
    }
  }
  let times = group.default_lesson_times
  if (typeof times === 'string') {
    try {
      times = JSON.parse(times)
    } catch {
      times = {}
    }
  }
  return {
    billing_type: group.default_billing_type || '8_lessons',
    final_price: fee,
    discount_percent: group.default_discount_percent,
    package_fee: group.default_package_fee,
    payment_scheme: scheme,
    lesson_weekdays: weekdays || [],
    lesson_times: times || {},
  }
}

/**
 * Tələbəni qrupdan qrupa köçürmə — ağıllı təsdiq modalı.
 */
export default function StudentGroupTransferModal({
  open,
  onClose,
  transfer,
  onSuccess,
  theme = 'dark',
}) {
  const [pricingMode, setPricingMode] = useState('apply_target')
  const [scheduleEffective, setScheduleEffective] = useState('immediate')
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const student = transfer?.student
  const targetGroup = transfer?.targetGroup
  const sourceLabel = transfer?.sourceGroupLabel || 'köhnə qrup'
  const targetLabel = transfer?.targetGroupLabel || targetGroup?.name || 'yeni qrup'

  const localPreview = useMemo(() => buildLocalPreview(targetGroup), [targetGroup])
  const pkg = preview?.package_preview || localPreview

  const currentFee = useMemo(() => {
    const fee = Number(student?.monthly_fee)
    if (Number.isFinite(fee) && fee > 0) return fee
    return null
  }, [student?.monthly_fee])

  const progress = useMemo(() => {
    const used = Number(student?.calendar_used_lessons ?? student?.lesson_count ?? 0) || 0
    const total = Number(student?.calendar_total_lessons ?? 0) || 0
    const remaining = total > 0 ? Math.max(0, total - used) : null
    return { used, total, remaining }
  }, [student])

  useEffect(() => {
    if (!open) return
    setPricingMode('apply_target')
    setScheduleEffective('immediate')
    setError(null)
    setPreview(null)
  }, [open, transfer?.targetGroupId])

  useEffect(() => {
    if (!open || !transfer?.targetGroupId) return
    let cancelled = false
    setPreviewLoading(true)
    api
      .get('/groups/transfer-preview', { params: { target_group_id: transfer.targetGroupId } })
      .then((res) => {
        if (!cancelled && res?.success) setPreview(res)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, transfer?.targetGroupId])

  const confirm = async () => {
    if (!student?.enrollment_id || !transfer?.targetGroupId) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.post('/groups/transfer-student', {
        enrollment_id: student.enrollment_id,
        student_id: student.id,
        source_group_id: transfer.sourceGroupId || student.group_id || null,
        target_group_id: transfer.targetGroupId,
        pricing_mode: pricingMode,
        schedule_effective: scheduleEffective,
      })
      if (!res?.success) throw new Error(res?.message || 'Köçürmə alınmadı')
      onSuccess?.(res)
      onClose()
    } catch (e) {
      setError(e?.message || 'Köçürmə alınmadı')
    } finally {
      setBusy(false)
    }
  }

  const mutedCls = theme === 'dark' ? 'text-gray-400' : 'text-slate-600'
  const textCls = theme === 'dark' ? 'text-gray-200' : 'text-slate-800'
  const cardCls =
    theme === 'dark'
      ? 'rounded-xl border border-white/10 bg-white/[0.03] p-3'
      : 'rounded-xl border border-slate-200 bg-slate-50 p-3'

  const radioCls = (active) =>
    [
      'flex gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-200',
      active
        ? 'border-primary/50 bg-primary/10 shadow-[0_0_0_1px_rgba(var(--primary-rgb,56,189,248),0.25)]'
        : theme === 'dark'
          ? 'border-white/10 bg-white/[0.02] hover:border-white/20'
          : 'border-slate-200 bg-white hover:border-slate-300',
    ].join(' ')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Qrup köçürməsini təsdiqlə"
      size="lg"
      scrollBody
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Ləğv et
          </Button>
          <Button type="button" onClick={() => void confirm()} loading={busy}>
            Təsdiqlə
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className={`text-sm leading-relaxed ${textCls}`}>
          <span className="font-semibold text-white">{student?.full_name || 'Tələbə'}</span> adlı
          tələbəni{' '}
          <span className="font-semibold text-primary">&quot;{targetLabel}&quot;</span> qrupuna
          keçirirsiniz.
        </p>
        <p className={`text-xs ${mutedCls}`}>
          Mənbə: {sourceLabel}
          {progress.total > 0 ? (
            <>
              {' '}
              · Bu paketdə {progress.used}/{progress.total} dərs (
              {progress.remaining != null ? `${progress.remaining} qalıb` : '—'})
            </>
          ) : null}
        </p>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-white">Qiymət və paket</h3>
          <label className={radioCls(pricingMode === 'apply_target')}>
            <input
              type="radio"
              name="pricing_mode"
              className="mt-1 accent-primary"
              checked={pricingMode === 'apply_target'}
              onChange={() => setPricingMode('apply_target')}
            />
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium text-white">
                Yeni qrupun standart qiymətini və paketini tətbiq et
              </div>
              {previewLoading ? (
                <p className={`text-xs ${mutedCls}`}>Paket məlumatları yüklənir…</p>
              ) : pkg ? (
                <p className={`text-xs ${mutedCls}`}>
                  {billingTypeLabel(pkg.billing_type)}
                  {pkg.final_price != null ? ` · ${formatAzn(pkg.final_price)}` : ''}
                  {pkg.discount_percent > 0 ? ` (${pkg.discount_percent}% endirim)` : ''}
                  {pkg.payment_scheme
                    ? ` · ${paymentTimingLabel(pkg.payment_scheme)}`
                    : ''}
                </p>
              ) : (
                <p className="text-xs text-amber-300/90">
                  Hədəf qrupun paket şablonu tam deyil — əvvəlcə qrup tənzimləmələrini yoxlayın.
                </p>
              )}
            </div>
          </label>
          <label className={radioCls(pricingMode === 'keep_existing')}>
            <input
              type="radio"
              name="pricing_mode"
              className="mt-1 accent-primary"
              checked={pricingMode === 'keep_existing'}
              onChange={() => setPricingMode('keep_existing')}
            />
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium text-white">
                Tələbənin mövcud xüsusi qiymət/endirim şərtlərini qoru
              </div>
              <p className={`text-xs ${mutedCls}`}>
                {student?.billing_type ? billingTypeLabel(student.billing_type) : 'Cari paket'}
                {currentFee != null ? ` · ${formatAzn(currentFee)}` : ''}
                {student?.discount_percent > 0
                  ? ` (${student.discount_percent}% endirim)`
                  : ''}
              </p>
            </div>
          </label>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-white">Cari ayın balansı və cədvəl</h3>
          <label className={radioCls(scheduleEffective === 'immediate')}>
            <input
              type="radio"
              name="schedule_effective"
              className="mt-1 accent-primary"
              checked={scheduleEffective === 'immediate'}
              onChange={() => setScheduleEffective('immediate')}
            />
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium text-white">Keçid dərhal aktiv olsun</div>
              <p className={`text-xs ${mutedCls}`}>
                Keçmiş dərslər saxlanılır; qalan dərslər yeni qrupun cədvəlinə uyğun planlanır.
                {pkg?.lesson_weekdays?.length ? (
                  <>
                    {' '}
                    Yeni cədvəl:{' '}
                    {lessonDaysLabel(pkg.lesson_weekdays, pkg.lesson_times)}
                  </>
                ) : null}
              </p>
            </div>
          </label>
          <label className={radioCls(scheduleEffective === 'next_cycle')}>
            <input
              type="radio"
              name="schedule_effective"
              className="mt-1 accent-primary"
              checked={scheduleEffective === 'next_cycle'}
              onChange={() => setScheduleEffective('next_cycle')}
            />
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-medium text-white">Keçid növbəti paketdən aktiv olsun</div>
              <p className={`text-xs ${mutedCls}`}>
                Tələbə bu paketi köhnə cədvəldə bitirir; qrup adı dəyişir, növbəti dövrdə yeni
                cədvəl tətbiq olunur.
              </p>
            </div>
          </label>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className={cardCls}>
          <p className={`text-xs ${mutedCls} leading-relaxed`}>
            Ödəniş tarixçəsi və keçmiş dərslər silinmir. Yalnız gələcək planlama seçiminizə uyğun
            yenilənir.
          </p>
        </div>
      </div>
    </Modal>
  )
}
