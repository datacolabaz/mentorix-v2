import { useEffect, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { WEEKDAYS } from './Schedule'
import { fmtAzBakuLessonRow } from '../../lib/lessonWeekGrid'
import { readCache, writeCache } from '../../lib/cache'

const BILLING_OPTS = [
  { value: '8_lessons', label: '8 Ders' },
  { value: '12_lessons', label: '12 Ders' },
  { value: 'monthly', label: 'Ayliq' },
]

const emptyForm = {
  full_name: '',
  phone: '',
  billing_type: '8_lessons',
  referral_notes: '',
  monthly_fee: '',
  enrollment_date: '',
  billing_timing: 'postpaid',
  payment_plan: 'full',
  first_lesson_date: '',
  lesson_weekdays: [],
  lesson_times: {},
  teacher_schedule_id: '',
  parent_name: '',
  parent_phone: '',
  subject_id: '',
  group_id: '',
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

/** API JSONB / string → { "1": "11:00", ... } */
function normalizeLessonTimes(raw) {
  if (raw == null || raw === '') return {}
  let o = raw
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {}
  const out = {}
  for (const [k, v] of Object.entries(o)) {
    if (v == null || v === '') continue
    const t = fmtSlotTime(v)
    if (t) out[String(k)] = t.length === 5 ? t : t.slice(0, 5)
  }
  return out
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

function normName(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** UI ödəniş sxemi → billing_timing + payment_plan (8/12/aylıq) */
function paymentSchemeFromForm(data) {
  if (data.payment_plan === 'partial') return 'installment'
  if ((data.billing_timing || 'postpaid') === 'prepaid') return 'full_prepaid'
  return 'postpaid_full'
}

function applyPaymentScheme(prev, scheme) {
  if (scheme === 'full_prepaid') return { ...prev, billing_timing: 'prepaid', payment_plan: 'full' }
  if (scheme === 'installment') return { ...prev, billing_timing: 'postpaid', payment_plan: 'partial' }
  return { ...prev, billing_timing: 'postpaid', payment_plan: 'full' }
}

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'

/** Komponent fayl səviyyəsində olmalıdır — parent içində təyin etsək hər render yeni tip olur və input fokusunu itirir */
function StudentFormFields({
  data,
  setData,
  scheduleMeta,
  mode,
  onRefreshSlots,
  toast,
  teachingSubjects = [],
  onCreateSubject,
  onCreateGroup,
}) {
  const [subjectDraft, setSubjectDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [createOpen, setCreateOpen] = useState(null) // 'subject' | 'group' | null
  const [createName, setCreateName] = useState('')

  const selectedSubject = useMemo(
    () => teachingSubjects.find((s) => String(s.id) === String(data.subject_id || '')) || null,
    [teachingSubjects, data.subject_id]
  )

  const subjectNames = useMemo(() => teachingSubjects.map((s) => String(s.name || '').trim()).filter(Boolean), [teachingSubjects])
  const groupNames = useMemo(() => (selectedSubject?.groups || []).map((g) => String(g.name || '').trim()).filter(Boolean), [selectedSubject?.groups])

  const openCreate = (kind, preset) => {
    setCreateOpen(kind)
    setCreateName(String(preset || '').trim())
  }

  const saveCreate = async () => {
    const name = String(createName || '').trim()
    if (!name) return toast('Ad boş ola bilməz', 'error')
    try {
      if (createOpen === 'subject') {
        if (typeof onCreateSubject !== 'function') throw new Error('create subject handler yoxdur')
        const created = await onCreateSubject(name)
        setData((p) => ({ ...p, subject_id: created?.id || '', group_id: '' }))
        setSubjectDraft('')
        setGroupDraft('')
        toast('Yeni sahə əlavə edildi')
      } else if (createOpen === 'group') {
        if (!data.subject_id) return toast('Əvvəl sahə seçin', 'error')
        if (typeof onCreateGroup !== 'function') throw new Error('create group handler yoxdur')
        const created = await onCreateGroup(data.subject_id, name)
        setData((p) => ({ ...p, group_id: created?.id || '' }))
        setGroupDraft('')
        toast('Yeni qrup əlavə edildi')
      }
      setCreateOpen(null)
      setCreateName('')
    } catch (e) {
      toast(e?.message || 'Yaradılmadı', 'error')
    }
  }

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
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefon *</label>
        <input
          className={inp}
          placeholder="+994XXXXXXXXX"
          value={data.phone}
          onChange={(e) => setData((p) => ({ ...p, phone: e.target.value }))}
        />
        <p className="text-[10px] text-gray-500 mt-1.5">Giriş üçün əsas identifikator telefon nömrəsidir (PIN ilə).</p>
      </div>

      <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-3 space-y-2">
        <p className="text-xs font-semibold text-violet-200 uppercase tracking-wider">1. Qeydiyyat növü *</p>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <span className="text-gray-200">Dərs sayı ilə</span> — 8 və ya 12 dərsli paket, tarixlər paket üzrə avtomatik planlanır.
          <span className="mx-1 text-gray-600">·</span>
          <span className="text-gray-200">Aylıq</span> — sabit aylıq məbləğ; tarix əsasən ödəniş ankoru (hər ayın həmin günü) üçündür, paket sayğacı yoxdur.
        </p>
        <select
          className={inp}
          value={data.billing_type}
          onChange={(e) => {
            const v = e.target.value
            setData((p) => {
              if (v === 'monthly') {
                const anchor = p.enrollment_date || p.first_lesson_date || ''
                return { ...p, billing_type: v, first_lesson_date: anchor, enrollment_date: anchor }
              }
              const fl = p.first_lesson_date || p.enrollment_date || ''
              return { ...p, billing_type: v, first_lesson_date: fl, enrollment_date: fl }
            })
          }}
        >
          {BILLING_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === 'monthly' ? 'Aylıq sabit ödəniş' : o.value === '8_lessons' ? '8 dərs paketi (dərs sayı ilə)' : '12 dərs paketi (dərs sayı ilə)'}
            </option>
          ))}
        </select>
      </div>

      {data.billing_type === 'monthly' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aylıq məbləğ (₼) *</label>
            <input
              className={inp}
              type="number"
              min={0}
              step={0.01}
              placeholder="0"
              value={data.monthly_fee}
              onChange={(e) => setData((p) => ({ ...p, monthly_fee: e.target.value }))}
            />
            <p className="text-[10px] text-gray-500 mt-1.5">Ödəniş dövrü üçün gözlənilən sabit məbləğ.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ayın ankor günü (başlama tarixi) *</label>
            <p className="text-[10px] text-gray-500 mb-2">
              Hər ayın ödəniş təqvimi bu günə söykənir. Köhnə formada ayrıca «ilk dərs» sahəsi olanda ili orada səhv qalsa belə, bazada əsas tarix budur — ili düzəltmək üçün həmin ankor gününü
              yeniləyin (redaktə saxlananda serverdə yenilənir).
            </p>
            <input
              className={inp}
              type="date"
              value={data.enrollment_date}
              onChange={(e) => {
                const v = e.target.value
                setData((p) => ({ ...p, enrollment_date: v, first_lesson_date: v }))
              }}
            />
            {paymentDateHint(data.enrollment_date) && (
              <p className="text-[11px] text-indigo-300/80 mt-1.5 tabular-nums">
                Seçilmiş tarix:{' '}
                <span className="text-white font-medium">{paymentDateHint(data.enrollment_date)}</span>
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">2. Paket: ilk dərs tarixi *</p>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Paket qeydiyyatında təqvim bir tarixdən başlayır: seçdiyiniz gün dərs günlərinizdən biri olmalıdır. Sistem bu tarixdən 8 və ya 12 tarixli dərs sırası qurur (aylıq ankor ayrıca
              deyil).
            </p>
            <p className="text-[10px] text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 leading-relaxed">
              Redaktədə dəyişəndə yalnız 1-ci dövrün planı və həmin dövrün davamiyyəti yenilənir. Artıq növbəti paket dövrünə keçilibsə, tarix dəyişməyi server bloklaya bilər.
            </p>
            <input
              className={inp}
              type="date"
              value={data.first_lesson_date}
              onChange={(e) => {
                const v = e.target.value
                setData((p) => ({ ...p, first_lesson_date: v, enrollment_date: v }))
              }}
            />
            {paymentDateHint(data.first_lesson_date) && (
              <p className="text-[11px] text-indigo-300/80 mt-1.5 tabular-nums">
                Seçilmiş tarix: <span className="text-white font-medium">{paymentDateHint(data.first_lesson_date)}</span>
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Məbləğ qeydi (₼) — ixtiyari</label>
            <input
              className={inp}
              type="number"
              min={0}
              step={0.01}
              placeholder="0"
              value={data.monthly_fee}
              onChange={(e) => setData((p) => ({ ...p, monthly_fee: e.target.value }))}
            />
            <p className="text-[10px] text-gray-500 mt-1.5">Paket üzrə istinad məbləği; aylıq sabit ödəniş deyil.</p>
          </div>
        </>
      )}

      <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
        <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Həftənin dərs günləri *</p>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          {data.billing_type === 'monthly'
            ? 'Aylıq qeydiyyatda da dərs günləri və saatlar izləmə və əlaqə üçün saxlanılır.'
            : 'Paketdə tarixlər bu günlərə və aşağıdakı saatlara uyğun avtomatik düzülür.'}
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
      <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-3">
        <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Ödəniş sxemi</p>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Ödəniş modeli (8 dərs / 12 dərs / aylıq üçün eyni) *
          </label>
          <select
            className={inp}
            value={paymentSchemeFromForm(data)}
            onChange={(e) => setData((p) => applyPaymentScheme(p, e.target.value))}
          >
            <option value="full_prepaid">Öncədən tam — məbləğ paket və ya ay başlamazdan əvvəl tam ödənilir</option>
            <option value="installment">Hissəli — hissə-hissə ödəniş; qalıq borc avtomatik izlənir</option>
            <option value="postpaid_full">Sonradan tam — dövr/paket üzrə sonradan bir dəfəyə tam məbləğ</option>
          </select>
          <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
            <span className="text-rose-200/90 font-medium">Hissəli</span> seçildikdə ödənilən məbləğ borcdan az olanda qalıq «Ödənişlər»
            və tarixçədə qırmızı ilə göstərilir. Aylıq məsələn <span className="text-white/90">85 ₼</span>dirsə, tam öncədən ödənişdə 85 ₼
            gözlənilir; hissəlidə isə hər ödəniş ayrıca qeyd olunur və qalıq borc dərhal hesablanır.
          </p>
        </div>
      </div>
      {Array.isArray(teachingSubjects) && teachingSubjects.length > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-3">
          <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Sahə və qrup</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tədris sahəsi</label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    className={inp}
                    list="mx_subjects"
                    value={
                      subjectDraft ||
                      (selectedSubject ? String(selectedSubject.name || '') : '')
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      setSubjectDraft(v)
                      const match = teachingSubjects.find((s) => normName(s.name) === normName(v))
                      if (match) setData((p) => ({ ...p, subject_id: match.id, group_id: '' }))
                      else setData((p) => ({ ...p, subject_id: '', group_id: '' }))
                    }}
                    placeholder="Yazın və ya seçin…"
                  />
                  <datalist id="mx_subjects">
                    {subjectNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => openCreate('subject', subjectDraft)}
                  className="shrink-0"
                >
                  + Yeni
                </Button>
              </div>
              {subjectDraft && !data.subject_id && (
                <button
                  type="button"
                  onClick={() => openCreate('subject', subjectDraft)}
                  className="mt-2 text-[11px] text-blue-300 hover:text-blue-200 underline"
                >
                  “{subjectDraft.trim()}” üçün yeni sahə yarat
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qrup</label>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    className={inp}
                    list="mx_groups"
                    disabled={!data.subject_id}
                    value={
                      groupDraft ||
                      (data.group_id
                        ? String((selectedSubject?.groups || []).find((g) => String(g.id) === String(data.group_id))?.name || '')
                        : '')
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      setGroupDraft(v)
                      const groups = selectedSubject?.groups || []
                      const match = groups.find((g) => normName(g.name) === normName(v))
                      if (match) setData((p) => ({ ...p, group_id: match.id }))
                      else setData((p) => ({ ...p, group_id: '' }))
                    }}
                    placeholder={data.subject_id ? 'Yazın və ya seçin…' : 'Əvvəl sahə seçin'}
                  />
                  <datalist id="mx_groups">
                    {groupNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!data.subject_id}
                  onClick={() => openCreate('group', groupDraft)}
                  className="shrink-0"
                >
                  + Yeni
                </Button>
              </div>
              {data.subject_id && groupDraft && !data.group_id && (
                <button
                  type="button"
                  onClick={() => openCreate('group', groupDraft)}
                  className="mt-2 text-[11px] text-blue-300 hover:text-blue-200 underline"
                >
                  “{groupDraft.trim()}” üçün yeni qrup yarat
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-gray-500">Siyahı «Tənzimləmələr» səhifəsindən idarə olunur.</p>
        </div>
      )}

      <Modal
        open={createOpen === 'subject' || createOpen === 'group'}
        onClose={() => {
          setCreateOpen(null)
          setCreateName('')
        }}
        title={createOpen === 'group' ? 'Yeni qrup əlavə et' : 'Yeni tədris sahəsi əlavə et'}
        size="sm"
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Ad
          </label>
          <input className={inp} value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="məs. Cyber Security" />
          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={saveCreate} className="flex-1 justify-center">
              Yadda saxla
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreateOpen(null)
                setCreateName('')
              }}
              className="flex-1 justify-center"
            >
              Ləğv et
            </Button>
          </div>
        </div>
      </Modal>
      {(mode === 'add' || mode === 'edit') && (
        <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Dərs vaxtı (slot)</p>
          {data.billing_type === '8_lessons' && (
            <p className="text-[10px] text-gray-500">Paket: 8 dərs (qeydiyyatdan sonra sayğac 8-dən geri sayacaq)</p>
          )}
          {data.billing_type === '12_lessons' && (
            <p className="text-[10px] text-gray-500">Paket: 12 dərs (qeydiyyatdan sonra sayğac 12-dən geri sayacaq)</p>
          )}
          {data.billing_type === 'monthly' && (
            <p className="text-[10px] text-gray-500">
              Paket: aylıq — borc hər ayın başlama tarixinin təqvim günü üzrə sabit məbləğdir; davamiyyət yalnız izləmə üçündür.
            </p>
          )}
          {data.billing_type === 'monthly' ? (
            <p className="text-[10px] text-gray-500">
              Seçilmiş dərs günləri üçün saatları qeyd edin. Aylıq qeydiyyatda tarixli «paket dərsləri» avtomatik yaradılmır — yalnız izləmə üçün cədvəl məlumatıdır.
            </p>
          ) : (
            <p className="text-[10px] text-gray-500">
              Seçilmiş dərs günləri üçün saatları qeyd edin. Paket qeydiyyatında yuxarıdakı ilk dərs tarixindən başlayaraq 8 və ya 12 tarixli dərs sırası avtomatik yaradılacaq.
            </p>
          )}
          <div className="space-y-2">
            {WEEKDAYS.filter((d) => (data.lesson_weekdays?.length ? data.lesson_weekdays.includes(d.v) : false)).map((d) => (
              <div key={d.v} className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/15 bg-[#13112e]/60 px-3 py-2">
                <div className="text-xs text-gray-300 font-semibold">{d.full}</div>
                <input
                  type="time"
                  className="bg-[#13112e] border border-indigo-500/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-indigo-400"
                  value={(data.lesson_times && (data.lesson_times[d.v] || data.lesson_times[String(d.v)])) || ''}
                  onChange={(e) =>
                    setData((p) => ({
                      ...p,
                      lesson_times: { ...(p.lesson_times || {}), [String(d.v)]: e.target.value },
                    }))
                  }
                />
              </div>
            ))}
            {!data.lesson_weekdays?.length && (
              <p className="text-xs text-gray-500">Əvvəlcə dərs günlərini seçin.</p>
            )}
          </div>
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
  const [lessonsModal, setLessonsModal] = useState(null)
  // Slot cədvəli tələbə qeydiyyatı üçün artıq tələb olunmur (dərslər tarixlərlə avtomatik yaradılır)
  const [enrollMeta] = useState({ loading: false, requiresScheduleSlot: false, availableSlots: [] })
  const [teachingSubjects, setTeachingSubjects] = useState([])
  const toast = useToast()

  const CACHE_KEY = 'instructor_students_v1'
  const CACHE_TTL_MS = 60000

  const load = async (quiet = false) => {
    setListError(null)
    if (!quiet) setListLoading(true)
    try {
      const d = await api.get('/students')
      const next = d.students || []
      setStudents(next)
      writeCache(CACHE_KEY, { students: next })
    } catch (err) {
      if (!quiet) {
        setListError(err?.message || 'Siyahı yüklənmədi')
        setStudents([])
      }
    } finally {
      if (!quiet) setListLoading(false)
    }
  }
  useEffect(() => {
    void api
      .get('/instructor/teaching')
      .then((d) => setTeachingSubjects(Array.isArray(d.subjects) ? d.subjects : []))
      .catch(() => setTeachingSubjects([]))
  }, [])

  const createTeachingSubject = async (name) => {
    const d = await api.post('/instructor/teaching/subjects', { name })
    const s = d?.subject
    if (!s?.id) throw new Error(d?.message || 'Sahə yaradılmadı')
    setTeachingSubjects((prev) => [...(Array.isArray(prev) ? prev : []), { ...s, groups: [] }])
    return s
  }

  const createTeachingGroup = async (subjectId, name) => {
    const d = await api.post('/instructor/teaching/groups', { subject_id: subjectId, name })
    const g = d?.group
    if (!g?.id) throw new Error(d?.message || 'Qrup yaradılmadı')
    setTeachingSubjects((prev) =>
      (Array.isArray(prev) ? prev : []).map((s) => {
        if (String(s.id) !== String(subjectId)) return s
        const groups = Array.isArray(s.groups) ? s.groups : []
        return { ...s, groups: [...groups, g] }
      })
    )
    return g
  }

  useEffect(() => {
    // 1) Keş varsa dərhal göstər (optimistic UI)
    const cached = readCache(CACHE_KEY, CACHE_TTL_MS)
    if (cached && Array.isArray(cached.students)) {
      setStudents(cached.students)
      setListLoading(false)
    }
    // 2) Arxa planda real datanı yenilə
    void load(true)
  }, [])

  const addStudent = async () => {
    if (!form.full_name || !form.phone) {
      toast('Ad ve telefon teleb olunur', 'error')
      return
    }
    if (!form.lesson_weekdays?.length) {
      toast('Ən azı bir dərs günü seçin', 'error')
      return
    }
    const isPkg = form.billing_type === '8_lessons' || form.billing_type === '12_lessons'
    const isMonthly = form.billing_type === 'monthly'
    if (isMonthly && !form.enrollment_date) {
      toast('Aylıq üçün ayın ankor gününü (başlama tarixini) seçin', 'error')
      return
    }
    if (isPkg && !form.first_lesson_date) {
      toast('Paket üçün ilk dərs tarixini seçin', 'error')
      return
    }
    const enrollmentSend = isPkg ? form.first_lesson_date : form.enrollment_date
    const firstLessonSend = isPkg ? form.first_lesson_date : form.first_lesson_date || null
    // Slot seçimi tələb olunmur: dərslər lesson_times + start_date ilə avtomatik generasiya olunur
    setLoading(true)
    try {
      const reg = await api.post('/auth/register', {
        full_name: form.full_name,
        phone: form.phone,
        role: 'student',
        password: Math.random().toString(36).slice(-8),
      })
      const newUserId = reg.user?.id
      if (!newUserId) throw new Error('Qeydiyyat cavabı gözlənilən deyil')
      const enrRes = await api.post('/students/enroll', {
        student_id: newUserId,
        billing_type: form.billing_type,
        referral_notes: form.referral_notes,
        monthly_fee: form.monthly_fee,
        enrollment_date: enrollmentSend || null,
        first_lesson_date: firstLessonSend || null,
        billing_timing: form.billing_timing || 'postpaid',
        payment_plan: form.payment_plan || 'full',
        subject_id: form.subject_id || undefined,
        group_id: form.group_id || undefined,
        lesson_weekdays: form.lesson_weekdays,
        lesson_times: form.lesson_times || {},
        parent_name: form.parent_name,
        parent_phone: form.parent_phone,
      })
      const ps = enrRes?.pin_sms
      if (ps?.error) {
        toast('Telebe elave edildi, amma PIN SMS gonderile bilmedi. Bir az sonra yeniden cehd edin ve ya telebenin giris ekraninda “Davam et” ile PIN isteyin.', 'error')
      } else if (ps?.sent) {
        toast('Telebe elave edildi. PIN SMS telebeye gonderildi.')
      } else if (ps?.skipped && ps?.message) {
        toast(`Telebe elave edildi. ${ps.message}`)
      } else {
        toast('Telebe elave edildi!')
      }
      setAddModal(false)
      setForm(emptyForm)
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (s) => {
    setEditId(s.enrollment_id)
    const enrSlice =
      s.enrollment_start_date != null && s.enrollment_start_date !== ''
        ? String(s.enrollment_start_date).slice(0, 10)
        : ''
    const firstSlice =
      s.first_lesson_date != null && String(s.first_lesson_date).trim() !== ''
        ? String(s.first_lesson_date).slice(0, 10)
        : ''
    const pkgAnchor = firstSlice || enrSlice
    setEditForm({
      full_name: s.full_name || '',
      phone: s.phone || '',
      billing_type: s.billing_type || '8_lessons',
      referral_notes: s.referral_notes || '',
      monthly_fee: s.monthly_fee != null && s.monthly_fee !== '' ? String(s.monthly_fee) : '',
      enrollment_date: s.billing_type === 'monthly' ? enrSlice : pkgAnchor,
      billing_timing: s.billing_timing === 'prepaid' ? 'prepaid' : 'postpaid',
      payment_plan: s.payment_plan === 'partial' ? 'partial' : 'full',
      subject_id: s.subject_id ? String(s.subject_id) : '',
      group_id: s.group_id ? String(s.group_id) : '',
      first_lesson_date: s.billing_type === 'monthly' ? enrSlice : pkgAnchor,
      teacher_schedule_id: '',
      lesson_weekdays: normalizeWeekdays(s.lesson_weekdays),
      lesson_times: normalizeLessonTimes(s.lesson_times),
      parent_name: s.parent_name || '',
      parent_phone: s.parent_phone || '',
    })
    setEditModal(true)
  }

  const saveEdit = async () => {
    if (!editId) {
      toast('Qeydiyyat tapılmadı — səhifəni yeniləyin', 'error')
      return
    }
    if (!editForm.full_name?.trim() || !editForm.phone?.trim()) {
      toast('Ad və telefon mütləqdir', 'error')
      return
    }
    if (!editForm.lesson_weekdays?.length) {
      toast('Ən azı bir dərs günü seçin', 'error')
      return
    }
    const editPkg = editForm.billing_type === '8_lessons' || editForm.billing_type === '12_lessons'
    const editMonthly = editForm.billing_type === 'monthly'
    if (editMonthly && !editForm.enrollment_date) {
      toast('Aylıq üçün ayın ankor gününü seçin', 'error')
      return
    }
    if (editPkg && !editForm.first_lesson_date) {
      toast('Paket üçün ilk dərs tarixini seçin', 'error')
      return
    }
    const enrollmentPatch = editPkg ? editForm.first_lesson_date : editForm.enrollment_date
    setLoading(true)
    try {
      const patchBody = {
        full_name: editForm.full_name,
        phone: editForm.phone,
        billing_type: editForm.billing_type,
        referral_notes: editForm.referral_notes,
        monthly_fee: editForm.monthly_fee,
        enrollment_date: enrollmentPatch,
        billing_timing: editForm.billing_timing || 'postpaid',
        payment_plan: editForm.payment_plan || 'full',
        subject_id: editForm.subject_id || null,
        group_id: editForm.group_id || null,
        lesson_weekdays: editForm.lesson_weekdays,
        lesson_times: editForm.lesson_times || {},
        parent_name: editForm.parent_name,
        parent_phone: editForm.parent_phone,
      }
      if (editForm.billing_type === '8_lessons' || editForm.billing_type === '12_lessons') {
        patchBody.first_lesson_date = editForm.first_lesson_date || null
      } else if (editMonthly) {
        patchBody.first_lesson_date = editForm.enrollment_date || null
      }
      await api.patch('/students/enrollment/' + encodeURIComponent(editId), patchBody)
      toast('Melumatlari yenilendi!')
      setEditModal(false)
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally {
      setLoading(false)
    }
  }

  const closeAddModal = () => {
    setAddModal(false)
    setForm(emptyForm)
  }

  const openLessonsModal = (s) => {
    const eid = s.enrollment_id
    const name = s.full_name || 'Tələbə'
    setLessonsModal({ studentName: name, enrollmentId: eid, lessons: [], loading: true, error: null })
    void (async () => {
      try {
        const d = await api.get(`/students/enrollment/${encodeURIComponent(eid)}/lessons`)
        setLessonsModal((prev) =>
          prev?.enrollmentId === eid
            ? { ...prev, lessons: Array.isArray(d.lessons) ? d.lessons : [], loading: false, error: null }
            : prev
        )
      } catch (err) {
        setLessonsModal((prev) =>
          prev?.enrollmentId === eid
            ? { ...prev, lessons: [], loading: false, error: err?.message || 'Yüklənmədi' }
            : prev
        )
      }
    })()
  }

  const deleteStudent = async (enrollmentId, name) => {
    if (!window.confirm(name + ' silinsin?')) return
    try {
      await api.delete('/students/enrollment/' + enrollmentId)
      toast('Telebe silindi')
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl break-words">Tələbələrim</h1>
          <p className="text-gray-500 text-sm mt-1">
            {listLoading ? '…' : `${students.length} telebe`}
          </p>
        </div>
        <Button
          className="w-full sm:w-auto shrink-0 justify-center"
          onClick={() => {
            setForm(emptyForm)
            setAddModal(true)
          }}
        >
          + Telebe Elave Et
        </Button>
      </div>

      <div className="space-y-3">
        {listLoading && <ListSkeleton message="Tələbələr yüklənir…" />}
        {!listLoading && listError && (
          <Card className="p-6 text-center border border-amber-500/30 bg-amber-500/5">
            <p className="text-amber-200/90 text-sm mb-3">{listError}</p>
            <p className="text-gray-500 text-xs mb-4">Şəbəkə və ya server gecikməsi ola bilər.</p>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              Yenidən yüklə
            </Button>
          </Card>
        )}
        {!listLoading && !listError &&
          students.map((s) => (
          <Card key={s.enrollment_id} className="p-4 min-w-0 overflow-hidden">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {s.full_name?.split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white truncate">{s.full_name}</div>
                  <div className="text-xs text-gray-400 flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                    {s.phone && <span className="break-all">{s.phone}</span>}
                    {lessonDaysShort(s.lesson_weekdays) && (
                      <span className="text-indigo-300/90 w-full sm:w-auto">
                        Dərslər: {lessonDaysShort(s.lesson_weekdays)}
                      </span>
                    )}
                  </div>
                  {s.track_subject_name ? (
                    <div className="text-[11px] text-gray-500 mt-1 truncate" title={s.track_group_name || ''}>
                      Sahə: <span className="text-gray-300">{s.track_subject_name}</span>
                      {s.track_group_name ? (
                        <span className="text-gray-500"> · {s.track_group_name}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                <div className="text-left sm:text-right">
                  <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-lg font-semibold inline-block">
                    {s.billing_type === 'monthly'
                      ? 'Davamlı (aylıq)'
                      : (() => {
                          const used = s.calendar_used_lessons ?? s.lesson_count ?? 0
                          const total =
                            s.calendar_total_lessons ??
                            (BILLING_OPTS.find((o) => o.value === s.billing_type)?.label || s.billing_type)
                          return `${used}/${total}`
                        })()}
                  </span>
                  {s.avg_score && <div className="text-xs text-gray-400 mt-1">Orta: {s.avg_score}%</div>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => openLessonsModal(s)}>
                    Dərslər
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openEdit(s)}>
                    Redakte
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteStudent(s.enrollment_id, s.full_name)}>
                    Sil
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {!listLoading && !listError && !students.length && (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg mb-2">Telebe yoxdur</p>
            <p className="text-sm">Yuxaridan telebe elave edin</p>
          </div>
        )}
      </div>

      <Modal open={addModal} onClose={closeAddModal} title="Yeni Telebe Elave Et">
        <StudentFormFields
          data={form}
          setData={setForm}
          scheduleMeta={enrollMeta}
          mode="add"
          onRefreshSlots={null}
          toast={toast}
          teachingSubjects={teachingSubjects}
          onCreateSubject={createTeachingSubject}
          onCreateGroup={createTeachingGroup}
        />
        <div className="flex gap-3 mt-4">
          <Button onClick={addStudent} loading={loading} className="flex-1 justify-center">
            Elave Et
          </Button>
          <Button variant="secondary" onClick={closeAddModal} className="flex-1 justify-center">
            Legv et
          </Button>
        </div>
      </Modal>

      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Telebeyi Redakte Et"
      >
        <StudentFormFields
          data={editForm}
          setData={setEditForm}
          mode="edit"
          toast={toast}
          teachingSubjects={teachingSubjects}
          onCreateSubject={createTeachingSubject}
          onCreateGroup={createTeachingGroup}
        />
        <div className="flex gap-3 mt-4">
          <Button onClick={saveEdit} loading={loading} className="flex-1 justify-center">
            Yadda Saxla
          </Button>
          <Button variant="secondary" onClick={() => setEditModal(false)} className="flex-1 justify-center">
            Legv et
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(lessonsModal)}
        onClose={() => setLessonsModal(null)}
        title={lessonsModal ? `${lessonsModal.studentName} — tarixlər üzrə` : 'Dərslər'}
        size="sm"
      >
        {lessonsModal?.loading ? (
          <ListSkeleton message="Dərslər yüklənir…" />
        ) : lessonsModal?.error ? (
          <p className="text-sm text-amber-200/90">{lessonsModal.error}</p>
        ) : !lessonsModal?.lessons?.length ? (
          <p className="text-sm text-gray-500">Hələ tarixli dərs qeydi yoxdur.</p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Cəmi <span className="text-indigo-200 font-semibold">{lessonsModal.lessons.length}</span> dərs
            </p>
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {lessonsModal.lessons.map((l) => (
                <li
                  key={l.id}
                  className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/80 px-3 py-2 text-sm text-gray-200 font-mono"
                >
                  {fmtAzBakuLessonRow(l)}
                </li>
              ))}
            </ul>
          </>
        )}
        <Button
          type="button"
          variant="secondary"
          className="w-full mt-5 justify-center"
          onClick={() => setLessonsModal(null)}
        >
          Bağla
        </Button>
      </Modal>
    </div>
  )
}
