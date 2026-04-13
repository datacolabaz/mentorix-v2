import { useEffect, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { WEEKDAYS } from './Schedule'

const BILLING_OPTS = [
  { value: '8_lessons', label: '8 Ders' },
  { value: '12_lessons', label: '12 Ders' },
  { value: 'monthly', label: 'Ayliq' },
]

const emptyForm = {
  full_name: '',
  email: '',
  phone: '',
  billing_type: '8_lessons',
  referral_notes: '',
  monthly_fee: '',
  payment_start_date: '',
  lesson_weekdays: [],
  teacher_schedule_id: '',
  parent_name: '',
  parent_phone: '',
}

function normalizeWeekdays(raw) {
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) {
    const nums = raw.map((x) => parseInt(String(x), 10)).filter((n) => n >= 1 && n <= 7)
    return [...new Set(nums)].sort((a, b) => a - b)
  }
  if (typeof raw === 'string') {
    try {
      return normalizeWeekdays(JSON.parse(raw))
    } catch {
      return []
    }
  }
  return []
}

function lessonDaysShort(raw) {
  const ids = normalizeWeekdays(raw)
  if (!ids.length) return null
  return ids.map((v) => WEEKDAYS.find((d) => d.v === v)?.short || v).join(' · ')
}

function fmtSlotTime(t) {
  if (t == null) return ''
  const s = typeof t === 'string' ? t : String(t)
  return s.slice(0, 5)
}

function paymentDateHint(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  try {
    const d = parseISO(ymd)
    return isValid(d) ? format(d, 'dd.MM.yyyy') : null
  } catch {
    return null
  }
}

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'

/** Komponent fayl səviyyəsində olmalıdır — parent içində təyin etsək hər render yeni tip olur və input fokusunu itirir */
function StudentFormFields({ data, setData, scheduleMeta, mode }) {
  const hint = paymentDateHint(data.payment_start_date)
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ad Soyad *</label>
        <input
          className={inp}
          placeholder="Eli Huseynov"
          value={data.full_name}
          onChange={(e) => setData((p) => ({ ...p, full_name: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefon *</label>
          <input
            className={inp}
            placeholder="+994XXXXXXXXX"
            value={data.phone}
            onChange={(e) => setData((p) => ({ ...p, phone: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
          <input
            className={inp}
            placeholder="email@mail.com"
            value={data.email}
            onChange={(e) => setData((p) => ({ ...p, email: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aylıq ödəniş (₼)</label>
          <input
            className={inp}
            type="number"
            min={0}
            step={0.01}
            placeholder="0"
            value={data.monthly_fee}
            onChange={(e) => setData((p) => ({ ...p, monthly_fee: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Ödəniş başlanğıcı (gün.ay.il)
          </label>
          <input
            className={inp}
            type="date"
            value={data.payment_start_date}
            onChange={(e) => setData((p) => ({ ...p, payment_start_date: e.target.value }))}
          />
          {hint && (
            <p className="text-[11px] text-indigo-300/80 mt-1.5 tabular-nums">
              Seçilmiş tarix: <span className="text-white font-medium">{hint}</span>
            </p>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
        <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Həftənin dərs günləri *</p>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Tələbənin həftədə hansı günlər dərs alacağını qeyd edin (ödəniş başlanğıcı ilə birlikdə qeydiyyat üçün).
        </p>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const active = Array.isArray(data.lesson_weekdays) && data.lesson_weekdays.includes(d.v)
            return (
              <button
                key={d.v}
                type="button"
                onClick={() =>
                  setData((p) => {
                    const cur = new Set(Array.isArray(p.lesson_weekdays) ? p.lesson_weekdays : [])
                    if (cur.has(d.v)) cur.delete(d.v)
                    else cur.add(d.v)
                    return { ...p, lesson_weekdays: [...cur].sort((a, b) => a - b) }
                  })
                }
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-indigo-600/45 border-indigo-400/55 text-white'
                    : 'bg-[#13112e] border-indigo-500/20 text-gray-500 hover:border-indigo-500/35'
                }`}
              >
                {d.short}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing Novu</label>
        <p className="text-[10px] text-gray-500 mb-2">
          Dərs günlərini seçdikdən dərhal sonra billing seçin: 8 dərs, 12 dərs və ya aylıq.
        </p>
        <select className={inp} value={data.billing_type} onChange={(e) => setData((p) => ({ ...p, billing_type: e.target.value }))}>
          {BILLING_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {mode === 'add' && scheduleMeta && (
        <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Dərs vaxtı (slot)</p>
          {scheduleMeta.loading && <p className="text-xs text-gray-500">Boş slotlar yüklənir…</p>}
          {!scheduleMeta.loading && scheduleMeta.requiresScheduleSlot && !scheduleMeta.availableSlots?.length && (
            <p className="text-xs text-amber-200/90">
              Boş slot yoxdur. Əvvəlcə «Cədvəlim» səhifəsində iş saatları yaradın.
            </p>
          )}
          {!scheduleMeta.loading && scheduleMeta.availableSlots?.length > 0 && (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              <p className="text-[10px] text-gray-500">Yalnız boş slotlar göstərilir.</p>
              {WEEKDAYS.map((d) => {
                const selectedDays = Array.isArray(data.lesson_weekdays) ? data.lesson_weekdays : []
                if (selectedDays.length && !selectedDays.includes(d.v)) return null
                const list = scheduleMeta.availableSlots.filter((s) => s.day_of_week === d.v)
                if (!list.length) return null
                return (
                  <div key={d.v}>
                    <p className="text-[10px] font-semibold text-gray-500 mb-1.5">{d.full}</p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((s) => (
                        <label
                          key={s.id}
                          className={`inline-flex items-center gap-2 cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                            data.teacher_schedule_id === s.id
                              ? 'border-indigo-400 bg-indigo-600/25 text-white'
                              : 'border-indigo-500/20 bg-[#13112e] text-gray-300 hover:border-indigo-500/40'
                          }`}
                        >
                          <input
                            type="radio"
                            name="teacher_schedule_slot"
                            className="accent-indigo-500"
                            checked={data.teacher_schedule_id === s.id}
                            onChange={() => setData((p) => ({ ...p, teacher_schedule_id: s.id }))}
                          />
                          <span className="font-mono tabular-nums">
                            {d.short} · {fmtSlotTime(s.start_time)}–{fmtSlotTime(s.end_time)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Menbe (ixtiyari)</label>
        <input
          className={inp}
          placeholder="Instagram, tovsiye..."
          value={data.referral_notes}
          onChange={(e) => setData((p) => ({ ...p, referral_notes: e.target.value }))}
        />
      </div>
      <div className="pt-2 border-t border-indigo-500/20">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Valideyn (ixtiyari)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ad Soyad</label>
            <input
              className={inp}
              placeholder="Valideyn adi"
              value={data.parent_name}
              onChange={(e) => setData((p) => ({ ...p, parent_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefon</label>
            <input
              className={inp}
              placeholder="+994XXXXXXXXX"
              value={data.parent_phone}
              onChange={(e) => setData((p) => ({ ...p, parent_phone: e.target.value }))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InstructorStudents() {
  const [students, setStudents] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [enrollMeta, setEnrollMeta] = useState({
    loading: false,
    requiresScheduleSlot: false,
    availableSlots: [],
  })
  const toast = useToast()

  useEffect(() => {
    if (!addModal) return
    setEnrollMeta((m) => ({ ...m, loading: true }))
    api
      .get('/teacher-schedules/for-enrollment')
      .then((d) => {
        setEnrollMeta({
          loading: false,
          requiresScheduleSlot: !!d.requiresScheduleSlot,
          availableSlots: d.availableSlots || [],
        })
      })
      .catch(() => {
        setEnrollMeta({ loading: false, requiresScheduleSlot: false, availableSlots: [] })
      })
  }, [addModal])

  const load = async () => {
    setListError(null)
    setListLoading(true)
    try {
      const d = await api.get('/students')
      setStudents(d.stude