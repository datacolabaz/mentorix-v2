import { WEEKDAYS } from '../../pages/instructor/Schedule'
import Card from '../common/Card'
import { formatAzn, billingTypeLabel } from '../../lib/groupPaymentTerms'

const DELIVERY_LABELS = {
  online: 'Onlayn',
  teacher_place: 'Müəllimin yanında',
  student_place: 'Tələbənin evində',
}

function formatDeliveryList(formats) {
  const list = Array.isArray(formats) ? formats : []
  if (!list.length) return null
  return list.map((f) => DELIVERY_LABELS[f] || f).join(' · ')
}

export default function JoinGroupTermsOverview({ joinInfo }) {
  if (!joinInfo) return null

  const preview = joinInfo.group_terms_preview
  const pkg = joinInfo.package_offer
  const lessonFormat =
    joinInfo.lesson_format_label || formatDeliveryList(joinInfo.delivery_formats)

  const scheduleFromPkg =
    (pkg?.lesson_weekdays || []).length > 0
      ? (pkg.lesson_weekdays || [])
          .map((d) => {
            const wd = WEEKDAYS.find((w) => w.v === d)
            const t = pkg.lesson_times?.[String(d)]
            return wd ? `${wd.short} ${t || ''}`.trim() : null
          })
          .filter(Boolean)
          .join(' · ')
      : ''

  const schedule =
    preview?.schedule_summary ||
    scheduleFromPkg ||
    (preview?.has_schedule ? '' : '')

  const billingLabel =
    preview?.billing_type_label ||
    (pkg?.billing_type_label || billingTypeLabel(pkg?.billing_type))

  const paymentShort =
    preview?.payment_timing_short || pkg?.payment_timing_short || '—'

  const paymentLong =
    preview?.payment_timing_label || pkg?.payment_timing_label || ''

  const showIncomplete = !joinInfo.invite_ready

  return (
    <Card className="p-4 mb-4 border border-primary/25 bg-primary/5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary/90 mb-1">
          Qrupa qoşulmazdan əvvəl — qrup şərtləri
        </p>
        <p className="text-sm text-token-textMuted leading-relaxed">
          Bu məlumatları oxuyub razı qalsanız, aşağıda məlumatlarınızı doldurub «Qoşul» düyməsinə basın.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-token-textMuted font-semibold mb-1">
            Qrup
          </p>
          <p className="font-semibold text-token-textMain">{joinInfo.group_name}</p>
          <p className="text-xs text-token-textMuted mt-0.5">
            {joinInfo.subject_name} · {joinInfo.instructor_name}
          </p>
        </div>

        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-token-textMuted font-semibold mb-1">
            Dərs formatı
          </p>
          <p className="font-medium text-token-textMain">
            {lessonFormat || 'Müəllim təyin edəcək / sorğu ilə'}
          </p>
        </div>

        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-token-textMuted font-semibold mb-1">
            Həftənin günləri
          </p>
          <p className="font-medium text-token-textMain">{schedule || '—'}</p>
        </div>

        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-token-textMuted font-semibold mb-1">
            Paket
          </p>
          <p className="font-medium text-token-textMain">{billingLabel || '—'}</p>
        </div>

        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-token-textMuted font-semibold mb-1">
            Ödəniş vaxtı
          </p>
          <p className="font-medium text-token-textMain">{paymentShort}</p>
          {paymentLong ? (
            <p className="text-xs text-token-textMuted mt-1 leading-relaxed">{paymentLong}</p>
          ) : null}
        </div>

        {pkg ? (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-200/80 font-semibold mb-1">
              Paket qiyməti
            </p>
            <p className="text-2xl font-bold text-emerald-300 tabular-nums">{formatAzn(pkg.final_price)}</p>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-center text-token-textMuted pt-1">
        Aşağı sürüşdürün — giriş və «Qoşul» düyməsi aşağıdadır
      </p>

      {showIncomplete ? (
        <p className="text-xs text-amber-200/95 leading-relaxed border border-amber-500/30 bg-amber-500/10 rounded-xl px-3 py-2">
          Müəllim qrup paketini (qiymət və tam cədvəl) hələ tamamlamayıb. Aşağıdakı məlumatları doldura bilərsiniz,
          amma «Qoşul» yalnız paket hazır olanda aktiv olacaq.
        </p>
      ) : null}
    </Card>
  )
}
