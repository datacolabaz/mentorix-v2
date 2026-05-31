import { WEEKDAYS } from '../../pages/instructor/Schedule'
import { addMinutesToHm } from '../../lib/lessonWeekGrid'
import {
  applyPaymentScheme,
  computeFinalPackageFee,
  formatAzn,
  paymentSchemeFromForm,
  paymentTimingLabel,
  parseDiscountPercent,
} from '../../lib/groupPaymentTerms'

const DEFAULT_LESSON_TIME = '15:00'

const inp =
  'w-full rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/40 border border-[color:var(--border-subtle)] bg-token-surfaceCard/55 text-token-textMain'

export function emptyGroupPackage() {
  const today = new Date()
  const dow = ((today.getDay() + 6) % 7) + 1
  return {
    default_billing_type: '8_lessons',
    default_package_fee: '',
    default_discount_percent: '',
    default_billing_timing: 'postpaid',
    default_payment_plan: 'full',
    default_lesson_weekdays: [dow],
    default_lesson_times: { [String(dow)]: DEFAULT_LESSON_TIME },
    default_lesson_end_times: { [String(dow)]: addMinutesToHm(DEFAULT_LESSON_TIME, 60) },
    default_notifications_enabled: true,
    default_initial_payment_status: 'unpaid',
  }
}

export function groupPackageFromApi(g) {
  if (!g) return emptyGroupPackage()
  const lwd = Array.isArray(g.default_lesson_weekdays) ? g.default_lesson_weekdays : []
  const lt =
    g.default_lesson_times && typeof g.default_lesson_times === 'object' ? g.default_lesson_times : {}
  return {
    default_billing_type: g.default_billing_type || '8_lessons',
    default_package_fee: g.default_package_fee != null ? String(g.default_package_fee) : '',
    default_discount_percent:
      g.default_discount_percent != null ? String(g.default_discount_percent) : '',
    default_billing_timing: g.default_billing_timing || 'postpaid',
    default_payment_plan: g.default_payment_plan || 'full',
    default_lesson_weekdays: lwd,
    default_lesson_times: lt,
    default_lesson_end_times:
      g.default_lesson_end_times && typeof g.default_lesson_end_times === 'object'
        ? g.default_lesson_end_times
        : {},
    default_notifications_enabled: g.default_notifications_enabled !== false,
    default_initial_payment_status: g.default_initial_payment_status || 'unpaid',
  }
}

export default function GroupPackageFields({ value, onChange, compact }) {
  const v = value || emptyGroupPackage()
  const set = (patch) => onChange({ ...v, ...patch })

  const scheme = paymentSchemeFromForm(v)
  const baseFee = Number(v.default_package_fee)
  const disc = parseDiscountPercent(v.default_discount_percent)
  const finalFee = computeFinalPackageFee(baseFee, disc)

  const toggleDay = (day) => {
    const cur = new Set(Array.isArray(v.default_lesson_weekdays) ? v.default_lesson_weekdays : [])
    const lt = { ...(v.default_lesson_times || {}) }
    const let_ = { ...(v.default_lesson_end_times || {}) }
    if (cur.has(day)) {
      cur.delete(day)
      delete lt[String(day)]
      delete let_[String(day)]
    } else {
      cur.add(day)
      if (!lt[String(day)]) lt[String(day)] = DEFAULT_LESSON_TIME
      let_[String(day)] = addMinutesToHm(lt[String(day)], 60)
    }
    set({
      default_lesson_weekdays: [...cur].sort((a, b) => a - b),
      default_lesson_times: lt,
      default_lesson_end_times: let_,
    })
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4 rounded-xl border border-indigo-500/20 bg-[#0f0c29]/40 p-3'}>
      {!compact && (
        <p className="text-xs text-gray-400 leading-relaxed">
          Dəvət linki ilə qoşulan tələbə paket qiymətini, ödəniş vaxtını və endirimi görür; «Razıyam» ilə təsdiq
          edir. Təsdiqdən sonra eyni şərtlər tətbiq olunur.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Paket *</label>
          <select
            className={inp}
            value={v.default_billing_type}
            onChange={(e) => set({ default_billing_type: e.target.value })}
          >
            <option value="8_lessons">8 dərs paketi</option>
            <option value="12_lessons">12 dərs paketi</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Əsas qiymət (₼) *</label>
          <input
            className={inp}
            type="number"
            min={0}
            step={0.01}
            placeholder="150"
            value={v.default_package_fee}
            onChange={(e) => set({ default_package_fee: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
            Endirim % (ixtiyari)
          </label>
          <input
            className={inp}
            type="number"
            min={0}
            max={100}
            step={0.1}
            placeholder="0"
            value={v.default_discount_percent}
            onChange={(e) => set({ default_discount_percent: e.target.value })}
          />
        </div>
        <div className="flex flex-col justify-end">
          <p className="text-xs text-gray-500 mb-1">Tələbəyə göstərilən məbləğ</p>
          <p className="text-lg font-bold text-emerald-300 tabular-nums">
            {finalFee != null ? formatAzn(finalFee) : '—'}
          </p>
          {disc != null && disc > 0 && Number.isFinite(baseFee) ? (
            <p className="text-xs text-gray-500 line-through tabular-nums">{formatAzn(baseFee)}</p>
          ) : null}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Ödəniş vaxtı *</label>
        <select
          className={inp}
          value={scheme}
          onChange={(e) => onChange(applyPaymentScheme(v, e.target.value))}
        >
          <option value="full_prepaid">Əvvəlcədən tam — paket başlamazdan əvvəl tam ödəniş</option>
          <option value="postpaid_full">Sonradan tam — paket bitdikdən sonra tam məbləğ</option>
          <option value="installment">Hissəli — paket müddətində hissə-hissə ödəniş</option>
        </select>
        <p className="text-xs text-gray-500 mt-1.5">{paymentTimingLabel(scheme)}</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Dərs günləri və saatları *</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {WEEKDAYS.map((d) => {
            const active = (v.default_lesson_weekdays || []).includes(d.v)
            return (
              <button
                key={d.v}
                type="button"
                onClick={() => toggleDay(d.v)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                  active
                    ? 'bg-indigo-600/45 border-indigo-400/55 text-white'
                    : 'border-indigo-500/20 text-gray-500'
                }`}
              >
                {d.short}
              </button>
            )
          })}
        </div>
        <div className="space-y-2">
          {WEEKDAYS.filter((d) => (v.default_lesson_weekdays || []).includes(d.v)).map((d) => (
            <div key={d.v} className="flex items-center justify-between gap-2 text-sm flex-wrap">
              <span className="text-gray-300 shrink-0">{d.full}</span>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  title="Başlanğıc"
                  className="bg-[#13112e] border border-indigo-500/20 rounded-lg px-2 py-1 text-white text-sm"
                  value={v.default_lesson_times?.[String(d.v)] || ''}
                  onChange={(e) => {
                    const key = String(d.v)
                    const start = e.target.value
                    const default_lesson_times = { ...(v.default_lesson_times || {}), [key]: start }
                    const default_lesson_end_times = { ...(v.default_lesson_end_times || {}) }
        