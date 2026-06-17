import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format, isValid, parseISO } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import StatusBadge from '../../components/common/StatusBadge'
import PresenceDot from '../../components/common/PresenceDot'
import { useToast } from '../../components/common/Toast'
import { WEEKDAYS } from './Schedule'
import { addMinutesToHm, fmtAzBakuLessonRow } from '../../lib/lessonWeekGrid'
import { alignFirstLessonYmd } from '../../lib/firstLessonDate'
import { readCache, writeCache } from '../../lib/cache'
import useUiStore from '../../hooks/useUi'
import PortalMenu from '../../components/common/PortalMenu'
import PhoneInput from '../../components/auth/PhoneInput'
import {
  findGroupById,
  findGroupByName,
  findSubjectById,
  findTeachingGroupById,
  normalizeTeachingSubjects,
} from '../../lib/teachingSubjects'
import { BILLING_STATUS_QUERY_KEY, useBillingStatus } from '../../hooks/useBillingStatus'
import { canUseDirectChat } from '../../lib/subscriptionPlanGuards'
import StudentDirectChatButton from '../../components/chat/StudentDirectChatButton'
import DirectChatUpgradeModal from '../../components/chat/DirectChatUpgradeModal'
import StudentGroupTransferModal from '../../components/instructor/StudentGroupTransferModal'
import { groupPackagePayload } from '../../components/instructor/GroupPackageFields'
import { canonicalAzPhoneE164 } from '../../lib/azPhone'
import {
  isSystemTeachingSubjectName,
  resolveStudentGroupLabel,
  resolveStudentSubjectLabel,
  studentMatchesAudienceFilter,
} from '../../lib/participantGroupLabels'

const PENDING_SETUP_TOAST_KEY = 'mx_instructor_pending_setup_toast_v1'

function studentHasContactPhone(s) {
  return Boolean(canonicalAzPhoneE164(s?.phone || s?.phone_number || ''))
}

function isLightEnrollmentSource(source) {
  const s = String(source || '').trim().toLowerCase()
  return s === 'exam' || s === 'task'
}

function findTeachingGroupMeta(subjects, groupId) {
  return findTeachingGroupById(subjects, groupId)
}

function readPendingSetupToastSeen() {
  try {
    const raw = sessionStorage.getItem(PENDING_SETUP_TOAST_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function markPendingSetupToastSeen(enrollmentIds) {
  try {
    const prev = readPendingSetupToastSeen()
    const merged = [...new Set([...prev, ...enrollmentIds.map(String)])]
    sessionStorage.setItem(PENDING_SETUP_TOAST_KEY, JSON.stringify(merged))
  } catch {
    /* ignore */
  }
}

function splitFullName(full) {
  const t = String(full || '').trim()
  if (!t) return { first_name: '', last_name: '' }
  const i = t.indexOf(' ')
  if (i < 0) return { first_name: t, last_name: '' }
  return { first_name: t.slice(0, i), last_name: t.slice(i + 1).trim() }
}

function joinFullName(first, last) {
  return `${String(first || '').trim()} ${String(last || '').trim()}`.trim()
}

function focusFieldNearest(e) {
  const t = e.target
  if (!t?.matches?.('input, textarea, select')) return
  requestAnimationFrame(() => {
    try {
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } catch {
      /* ignore */
    }
  })
}

/** Ad/soyad: ayrı sahələr və ya tək sətirdə «Ad Soyad». */
function resolveStudentNames(data) {
  let firstName = String(data?.first_name || splitFullName(data?.full_name).first_name).trim()
  let lastName = String(data?.last_name || splitFullName(data?.full_name).last_name).trim()
  if (firstName && !lastName) {
    const split = splitFullName(firstName)
    if (split.last_name) {
      firstName = split.first_name
      lastName = split.last_name
    }
  }
  return { firstName, lastName }
}

const DEFAULT_LESSON_TIME = '15:00'

const BILLING_OPTS = [
  { value: '8_lessons', label: '8 Ders' },
  { value: '12_lessons', label: '12 Ders' },
]

const emptyForm = {
  first_name: '',
  last_name: '',
  phone_number: '',
  full_name: '',
  phone: '',
  email: '',
  billing_type: '8_lessons',
  referral_notes: '',
  referral_source_id: '',
  initial_payment_status: 'unpaid',
  payment_due_date: '',
  discount_percent: '',
  teacher_notes: '',
  monthly_fee: '',
  enrollment_date: '',
  billing_timing: 'postpaid',
  payment_plan: 'full',
  first_lesson_date: '',
  lesson_weekdays: [],
  lesson_times: {},
  lesson_end_times: {},
  teacher_schedule_id: '',
  parent_name: '',
  parent_phone: '',
  subject_id: '',
  group_id: '',
  course_id: '',
  notifications_enabled: true,
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

function normalizeLessonEndTimes(raw, lessonTimes) {
  const lt = lessonTimes || {}
  const out = {}
  const parsed = normalizeLessonTimes(raw)
  for (const [k, v] of Object.entries(parsed)) {
    const start = lt[k] || lt[String(k)] || DEFAULT_LESSON_TIME
    const end = fmtSlotTime(v)
    if (!end) continue
    if (parseToMinutesSafe(end) <= parseToMinutesSafe(start)) {
      out[String(k)] = addMinutesToHm(start, 60)
    } else {
      out[String(k)] = end
    }
  }
  for (const k of Object.keys(lt)) {
    if (!out[k]) out[k] = addMinutesToHm(lt[k], 60)
  }
  return out
}

function parseToMinutesSafe(t) {
  const s = fmtSlotTime(t)
  const [h, m] = s.split(':').map((x) => parseInt(x, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
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

/** UI ödəniş sxemi → billing_timing + payment_plan (8/12 üçün eyni) */
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

const inp = 'w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/40'

/** Komponent fayl səviyyəsində olmalıdır — parent içində təyin etsək hər render yeni tip olur və input fokusunu itirir */
function StudentFormFields({
  data,
  setData,
  scheduleMeta,
  mode,
  onRefreshSlots,
  toast,
  teachingSubjects = [],
  referralSources = [],
  onCreateSubject,
  onCreateGroup,
  lockStudentPhone = false,
  onSendProfileCompletionEmail,
  sendProfileEmailBusy = false,
  lightSetup = false,
}) {
  const [subjectDraft, setSubjectDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [createOpen, setCreateOpen] = useState(null) // 'subject' | 'group' | null
  const [createName, setCreateName] = useState('')

  const safeSubjects = useMemo(
    () => normalizeTeachingSubjects(teachingSubjects),
    [teachingSubjects],
  )

  const selectedSubject = useMemo(
    () => findSubjectById(safeSubjects, data.subject_id),
    [safeSubjects, data.subject_id],
  )

  const subjectNames = useMemo(
    () =>
      safeSubjects.map((s) => String(s.name || '').trim()).filter(Boolean),
    [safeSubjects],
  )
  const groupNames = useMemo(
    () =>
      (selectedSubject?.groups || [])
        .filter((g) => g?.id)
        .map((g) => String(g.name || '').trim())
        .filter(Boolean),
    [selectedSubject?.groups],
  )

  const openCreate = (kind, preset) => {
    setCreateOpen(kind)
    setCreateName(String(preset || '').trim())
  }

  const alignFirstFromEnrollment = (p, lesson_weekdays, lesson_times) => {
    const anchor = p.enrollment_date || ''
    if (!anchor) return p
    const first_lesson_date = alignFirstLessonYmd(
      anchor,
      lesson_weekdays ?? p.lesson_weekdays,
      lesson_times ?? p.lesson_times,
    )
    return { ...p, first_lesson_date }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ad *</label>
          <input
            className={inp}
            placeholder="Əli"
            value={data.first_name ?? splitFullName(data.full_name).first_name}
            onChange={(e) => {
              const first_name = e.target.value
              setData((p) => ({
                ...p,
                first_name,
                full_name: joinFullName(first_name, p.last_name ?? splitFullName(p.full_name).last_name),
              }))
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Soyad *</label>
          <input
            className={inp}
            placeholder="Hüseynov"
            value={data.last_name ?? splitFullName(data.full_name).last_name}
            onChange={(e) => {
              const last_name = e.target.value
              setData((p) => ({
                ...p,
                last_name,
                full_name: joinFullName(p.first_name ?? splitFullName(p.full_name).first_name, last_name),
              }))
            }}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Tələbə telefonu *
        </label>
        {lockStudentPhone ? (
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 space-y-3">
            <p className="text-xs text-amber-100/95 leading-relaxed">
              Telefon tələbənin özü link vasitəsilə təsdiqləməlidir — müəllim daxil edə bilməz. Gmail ünvanına
              tamamlama linki göndərin; tələbə ad, soyad və telefonu doldurduqdan sonra quraşdırmanı davam edə
              bilərsiniz.
            </p>
            {onSendProfileCompletionEmail ? (
              <Button
                type="button"
                size="sm"
                loading={sendProfileEmailBusy}
                onClick={() => void onSendProfileCompletionEmail()}
              >
                Profil tamamlama linki göndər (email)
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <PhoneInput
              value={data.phone_number || data.phone || ''}
              onChange={(v) => setData((p) => ({ ...p, phone_number: v, phone: v }))}
              persistLoginDefaults={false}
              required
            />
            <p className="text-[10px] text-gray-500 mt-1.5">
              Ödəniş xatırlatması və qrup kodları bu nömrəyə SMS/WhatsApp ilə göndərilir (müəllim hesabından
              ayrıdır).
            </p>
          </>
        )}
      </div>

      {mode === 'add' || mode === 'edit' ? (
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Email (istəyə bağlı)
          </label>
          <input
            className={inp}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="student@gmail.com"
            value={data.email || ''}
            onChange={(e) => setData((p) => ({ ...p, email: e.target.value }))}
          />
          <p className="text-[10px] text-gray-500 mt-1.5">
            <span className="text-indigo-200/90 font-medium">İstəyə bağlı:</span> tələbə panelinə email ilə daxil ola
            bilsin. Boş buraxılsa, yalnız müəllim tərəfindən idarə olunur.
            {mode === 'edit' ? (
              <>
                {' '}
                <span className="text-gray-400">
                  Qeyd: tələbə Google ilə artıq giriş edibsə, email dəyişikliyi server tərəfindən bloklanır.
                </span>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {lightSetup ? (
        <p className="text-xs text-indigo-200/90 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-3 py-2.5 leading-relaxed">
          Bu tələbə imtahan və ya tapşırıq linki ilə qoşulub — yalnız ad, soyad və telefon kifayətdir. Paket/cədvəl
          tələb olunmur; «Sorğular» bölməsindən təsdiqləyin.
        </p>
      ) : null}

      {!lightSetup ? (
      <div className="rounded-xl border border-white/10 bg-surface-2/40 p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-200 uppercase tracking-wider">1. Qeydiyyat növü *</p>
        <p className="text-[10px] text-gray-400 leading-relaxed">
          <span className="text-gray-200">Dərs sayı ilə</span> — 8 və ya 12 dərsli paket, tarixlər paket üzrə avtomatik planlanır.
        </p>
        <select
          className={inp}
          value={data.billing_type}
          onChange={(e) => {
            const v = e.target.value
            setData((p) => {
              const fl = p.first_lesson_date || p.enrollment_date || ''
              return { ...p, billing_type: v, first_lesson_date: fl, enrollment_date: fl }
            })
          }}
        >
          {BILLING_OPTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === '8_lessons' ? '8 dərs paketi (dərs sayı ilə)' : '12 dərs paketi (dərs sayı ilə)'}
            </option>
          ))}
        </select>
      </div>
      ) : null}

      {!lightSetup ? (
      <label className="flex items-center gap-2 text-sm text-gray-200 select-none">
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-500"
          checked={Boolean(data.notifications_enabled)}
          onChange={(e) => setData((p) => ({ ...p, notifications_enabled: e.target.checked }))}
        />
        Ödəniş bitməsi barədə bildiriş göndərilsin
      </label>
      ) : null}

      {!lightSetup ? (
      <>
        <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">2. Paket: ilk dərs tarixi *</p>
          {mode === 'setup' && data.enrollment_date && paymentDateHint(data.enrollment_date) ? (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Qoşulma tarixi:{' '}
              <span className="text-gray-300 font-medium">{paymentDateHint(data.enrollment_date)}</span> — dərs günü
              olmaya bilər; ilk dərs avtomatik növbəti uyğun dərs gününə keçirilir.
            </p>
          ) : (
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Paket qeydiyyatında təqvim bir tarixdən başlayır. Tarix dərs günü deyilsə, sistem ən yaxın uyğun dərs
              gününə keçirir və 8 və ya 12 dərs sırası qurur.
            </p>
          )}
          {mode !== 'setup' ? (
            <p className="text-[10px] text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 leading-relaxed">
              Redaktədə dəyişəndə yalnız 1-ci dövrün planı və həmin dövrün davamiyyəti yenilənir. Artıq növbəti paket
              dövrünə keçilibsə, tarix dəyişməyi server bloklaya bilər.
            </p>
          ) : null}
          <input
            className={inp}
            type="date"
            value={data.first_lesson_date}
            onChange={(e) => {
              const v = e.target.value
              setData((p) => {
                if (mode === 'setup') {
                  const first_lesson_date = alignFirstLessonYmd(v, p.lesson_weekdays, p.lesson_times)
                  return { ...p, first_lesson_date }
                }
                return { ...p, first_lesson_date: v, enrollment_date: v }
              })
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
          <p className="text-[10px] text-gray-500 mt-1.5">Paket üzrə istinad məbləği; abunə tipli sabit ödəniş deyil.</p>
        </div>
      </>
      ) : null}

      {!lightSetup ? (
      <>
      <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-2">
        <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Həftənin dərs günləri *</p>
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Paketdə tarixlər bu günlərə və aşağıdakı saatlara uyğun avtomatik düzülür.
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
                    const lesson_times = { ...(p.lesson_times || {}) }
                    const lesson_end_times = { ...(p.lesson_end_times || {}) }
                    if (cur.has(d.v)) {
                      cur.delete(d.v)
                      delete lesson_times[String(d.v)]
                      delete lesson_times[d.v]
                      delete lesson_end_times[String(d.v)]
                      delete lesson_end_times[d.v]
                    } else {
                      cur.add(d.v)
                      const key = String(d.v)
                      if (!lesson_times[key] && !lesson_times[d.v]) lesson_times[key] = DEFAULT_LESSON_TIME
                      lesson_end_times[key] = addMinutesToHm(lesson_times[key], 60)
                    }
                    const lesson_weekdays = [...cur].sort((a, b) => a - b)
                    const next = { ...p, lesson_weekdays, lesson_times, lesson_end_times }
                    return mode === 'setup' ? alignFirstFromEnrollment(next, lesson_weekdays, lesson_times) : next
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
            Ödəniş modeli *
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
            və tarixçədə qırmızı ilə göstərilir. Hissəlidə hər ödəniş ayrıca qeyd olunur və qalıq borc dərhal hesablanır.
          </p>
        </div>
      </div>
      {Array.isArray(teachingSubjects) && (
        <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-3">
          <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Sahə və qrup</p>
          {!teachingSubjects.length ? (
            <p className="text-[11px] text-gray-500">
              Hələ tədris sahəsi yoxdur — aşağıdan «+ Yeni» ilə yaradın və ya{' '}
              <a href="/instructor/teaching-groups" className="text-blue-300 hover:underline">
                Kurslar və qruplar
              </a>{' '}
              səhifəsinə keçin.
            </p>
          ) : null}
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
                      const match = safeSubjects.find((s) => s && normName(s.name) === normName(v))
                      if (match) {
                        setSubjectDraft('')
                        setData((p) => ({ ...p, subject_id: match.id, group_id: '' }))
                      } else {
                        setData((p) => ({ ...p, subject_id: '', group_id: '' }))
                      }
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
                        ? String(findGroupById(selectedSubject, data.group_id)?.name || '')
                        : '')
                    }
                    onChange={(e) => {
                      const v = e.target.value
                      setGroupDraft(v)
                      const groups = selectedSubject?.groups || []
                      const match = findGroupByName(selectedSubject, v) || groups.find((g) => g && normName(g.name) === normName(v))
                      if (match) {
                        setGroupDraft('')
                        setData((p) => ({ ...p, group_id: match.id }))
                      } else {
                        setData((p) => ({ ...p, group_id: '' }))
                      }
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
          <p className="text-[10px] text-gray-500">
            Seçilmiş dərs günləri üçün saatları qeyd edin. Paket qeydiyyatında yuxarıdakı ilk dərs tarixindən başlayaraq 8 və ya 12 tarixli dərs sırası avtomatik yaradılacaq.
          </p>
          <div className="space-y-2">
            {WEEKDAYS.filter((d) => (data.lesson_weekdays?.length ? data.lesson_weekdays.includes(d.v) : false)).map((d) => (
              <div key={d.v} className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/15 bg-[#13112e]/60 px-3 py-2">
                <div className="text-xs text-gray-300 font-semibold shrink-0">{d.full}</div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-gray-500">Başlanğıc</label>
                  <input
                    type="time"
                    className="bg-[#13112e] border border-indigo-500/20 rounded-xl px-2 py-2 text-white text-sm outline-none focus:border-indigo-400"
                    value={(data.lesson_times && (data.lesson_times[d.v] || data.lesson_times[String(d.v)])) || ''}
                    onChange={(e) => {
                      const key = String(d.v)
                      const start = e.target.value
                      const lesson_times = { ...(data.lesson_times || {}), [key]: start }
                      const lesson_end_times = { ...(data.lesson_end_times || {}) }
                      const curEnd = lesson_end_times[key]
                      if (!curEnd || parseToMinutesSafe(curEnd) <= parseToMinutesSafe(start)) {
                        lesson_end_times[key] = addMinutesToHm(start, 60)
                      }
                      setData((p) => {
                        const next = { ...p, lesson_times, lesson_end_times }
                        return mode === 'setup'
                          ? alignFirstFromEnrollment(next, p.lesson_weekdays, lesson_times)
                          : next
                      })
                    }}
                  />
                  <label className="text-[10px] text-gray-500">Bitmə</label>
                  <input
                    type="time"
                    className="bg-[#13112e] border border-indigo-500/20 rounded-xl px-2 py-2 text-white text-sm outline-none focus:border-indigo-400"
                    value={(data.lesson_end_times && (data.lesson_end_times[d.v] || data.lesson_end_times[String(d.v)])) || ''}
                    onChange={(e) => {
                      const lesson_end_times = { ...(data.lesson_end_times || {}), [String(d.v)]: e.target.value }
                      setData((p) => ({ ...p, lesson_end_times }))
                    }}
                  />
                </div>
              </div>
            ))}
            {!data.lesson_weekdays?.length && (
              <p className="text-xs text-gray-500">Əvvəlcə dərs günlərini seçin.</p>
            )}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/60 p-3 space-y-3">
        <p className="text-xs font-semibold text-indigo-200/90 uppercase tracking-wider">Marketinq</p>
        {referralSources.length > 0 && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Mənbə</label>
            <select
              className={inp}
              value={data.referral_source_id || ''}
              onChange={(e) => setData((p) => ({ ...p, referral_source_id: e.target.value }))}
            >
              <option value="">— Seçin —</option>
              {referralSources.filter(Boolean).map((rs) => (
                <option key={rs.id} value={rs.id}>
                  {rs?.name ?? '—'}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Qeyd (ixtiyari)</label>
          <input
            className={inp}
            placeholder="Instagram, tövsiyə..."
            value={data.referral_notes}
            onChange={(e) => setData((p) => ({ ...p, referral_notes: e.target.value }))}
          />
        </div>
      </div>

      {(mode === 'setup' || mode === 'add' || mode === 'edit') && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-3">
          <p className="text-xs font-semibold text-emerald-200/90 uppercase tracking-wider">Ödəniş statusu</p>
          <select
            className={inp}
            value={data.initial_payment_status || 'unpaid'}
            onChange={(e) => setData((p) => ({ ...p, initial_payment_status: e.target.value }))}
          >
            <option value="unpaid">Ödənilməyib</option>
            <option value="partial">Hissəli</option>
            <option value="paid">Ödənilib</option>
          </select>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ödəniş son tarixi (ixtiyari)</label>
            <input
              type="date"
              className={inp}
              value={data.payment_due_date || ''}
              onChange={(e) => setData((p) => ({ ...p, payment_due_date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Endirim % (ixtiyari)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              className={inp}
              value={data.discount_percent}
              onChange={(e) => setData((p) => ({ ...p, discount_percent: e.target.value }))}
            />
          </div>
        </div>
      )}

      {(mode === 'setup' || mode === 'edit') && (
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Müəllim qeydi (ixtiyari)
          </label>
          <textarea
            className={`${inp} min-h-[72px] resize-y`}
            placeholder="Daxili qeydlər..."
            value={data.teacher_notes || ''}
            onChange={(e) => setData((p) => ({ ...p, teacher_notes: e.target.value }))}
          />
        </div>
      )}
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
      </>
      ) : null}
    </div>
  )
}

export default function InstructorStudents() {
  const [students, setStudents] = useState([])
  const [editModal, setEditModal] = useState(false)
  const [joinPendingCount, setJoinPendingCount] = useState(0)
  const [setupModal, setSetupModal] = useState(false)
  const [setupForm, setSetupForm] = useState(emptyForm)
  const [setupEnrollmentId, setSetupEnrollmentId] = useState(null)
  const [setupFieldErrors, setSetupFieldErrors] = useState(null)
  const [setupPhoneLocked, setSetupPhoneLocked] = useState(false)
  const [sendProfileEmailBusy, setSendProfileEmailBusy] = useState(false)
  const [referralSources, setReferralSources] = useState([])
  const [editForm, setEditForm] = useState(emptyForm)
  const [editOriginal, setEditOriginal] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editStudentId, setEditStudentId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState(null)
  const [lessonsModal, setLessonsModal] = useState(null)
  const [restoreModal, setRestoreModal] = useState(null) // { enrollmentId, studentName, items, selected:Set, loading, error }
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { enrollmentId, studentName }
  const [deleteBusy, setDeleteBusy] = useState(false)
  // Slot cədvəli tələbə qeydiyyatı üçün artıq tələb olunmur (dərslər tarixlərlə avtomatik yaradılır)
  const [enrollMeta] = useState({ loading: false, requiresScheduleSlot: false, availableSlots: [] })
  const [teachingSubjects, setTeachingSubjects] = useState([])
  const toast = useToast()
  const navigate = useNavigate()
  const [subjectFilter, setSubjectFilter] = useState('')
  const [audienceFilter, setAudienceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [openGroups, setOpenGroups] = useState(() => new Set())
  const [actionMenuId, setActionMenuId] = useState(null)
  const [directChatUpgrade, setDirectChatUpgrade] = useState(null)
  const [transferModal, setTransferModal] = useState(null)
  const [dragOverGroupKey, setDragOverGroupKey] = useState(null)
  const [draggingStudentId, setDraggingStudentId] = useState(null)
  const [emptyGroupPrompt, setEmptyGroupPrompt] = useState(null)
  const [emptyGroupDeleteBusy, setEmptyGroupDeleteBusy] = useState(false)
  const [groupRenameModal, setGroupRenameModal] = useState(null)
  const [groupRenameBusy, setGroupRenameBusy] = useState(false)
  const { theme } = useUiStore()
  const actionAnchorsRef = useRef(new Map())
  const queryClient = useQueryClient()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const blocked = Boolean(billing?.should_block)
  const directChatActive = canUseDirectChat(billing) && !blocked

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
      .then((d) => setTeachingSubjects(normalizeTeachingSubjects(d.subjects)))
      .catch(() => setTeachingSubjects([]))
    void api
      .get('/students/referral-sources')
      .then((d) => setReferralSources(Array.isArray(d.sources) ? d.sources : []))
      .catch(() => setReferralSources([]))
  }, [])

  const isPendingSetup = (s) =>
    String(s?.enrollment_status || '').toLowerCase() === 'pending_setup'

  const isPendingApproval = (s) =>
    String(s?.enrollment_status || '').toLowerCase() === 'pending_approval'

  /** Qrup/sahə (CRM) — cədvəl/paket tamamlanmayıb. İmtahan/tapşırıq: Sorğular bölməsi. */
  const needsSetup = (s) => {
    if (isPendingApproval(s)) return false
    if (isLightEnrollmentSource(s?.enrollment_source)) return false
    if (isPendingSetup(s)) return true
    const days = normalizeWeekdays(s?.lesson_weekdays)
    if (!days.length) return true
    if (!s?.configured_at && String(s?.enrollment_status || '').toLowerCase() === 'active') {
      return true
    }
    return false
  }

  const createTeachingSubject = async (name) => {
    const d = await api.post('/instructor/teaching/subjects', { name })
    const s = d?.subject
    if (!s?.id) throw new Error(d?.message || 'Sahə yaradılmadı')
    setTeachingSubjects((prev) => normalizeTeachingSubjects([...(Array.isArray(prev) ? prev : []), { ...s, groups: [] }]))
    return s
  }

  const createTeachingGroup = async (subjectId, name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) throw new Error('Qrup adı boş ola bilməz')
    const subject = findSubjectById(teachingSubjects, subjectId)
    const existing = findGroupByName(subject, trimmed)
    if (existing?.id) return existing
    const d = await api.post('/instructor/teaching/groups', { subject_id: subjectId, name: trimmed })
    const g = d?.group
    if (!g?.id) throw new Error(d?.message || 'Qrup yaradılmadı')
    setTeachingSubjects((prev) =>
      normalizeTeachingSubjects(prev).map((s) => {
        if (String(s.id) !== String(subjectId)) return s
        const groups = (Array.isArray(s.groups) ? s.groups : []).filter(Boolean)
        const already = groups.some((x) => String(x.id) === String(g.id))
        return already ? s : { ...s, groups: [...groups, g] }
      }),
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

  useEffect(() => {
    const refresh = () => {
      api
        .get('/instructor/join-requests/count')
        .then((d) => setJoinPendingCount(Number(d?.count ?? 0) || 0))
        .catch(() => setJoinPendingCount(0))
    }
    refresh()
    window.addEventListener('mx:join-requests-changed', refresh)
    return () => window.removeEventListener('mx:join-requests-changed', refresh)
  }, [])

  const openCompleteSetup = async (s) => {
    closeStudentMenu()
    if (isLightEnrollmentSource(s?.enrollment_source)) {
      toast(
        'Bu tələbə imtahan və ya tapşırıq linki ilə qoşulub — paket/cədvəl lazım deyil. «Sorğular» bölməsindən təsdiqləyin.',
        'info',
      )
      return
    }
    let row = s
    try {
      const d = await api.get('/students')
      const next = d.students || []
      setStudents(next)
      writeCache(CACHE_KEY, { students: next })
      row = next.find((x) => x.enrollment_id === s.enrollment_id) || s
      if (isLightEnrollmentSource(row?.enrollment_source)) {
        toast(
          'Bu tələbə imtahan və ya tapşırıq linki ilə qoşulub — paket/cədvəl lazım deyil. «Sorğular» bölməsindən təsdiqləyin.',
          'info',
        )
        return
      }
    } catch {
      /* keep row */
    }
    const pkgAnchor =
      row.enrollment_start_date != null && row.enrollment_start_date !== ''
        ? String(row.enrollment_start_date).slice(0, 10)
        : row.enrolled_at
          ? String(row.enrolled_at).slice(0, 10)
          : ''
    const lwd = normalizeWeekdays(row.lesson_weekdays)
    const lt = normalizeLessonTimes(row.lesson_times)
    const let_ = normalizeLessonEndTimes(row.lesson_end_times, lt)
    const firstFromApi =
      row.first_lesson_date != null && String(row.first_lesson_date).trim() !== ''
        ? String(row.first_lesson_date).slice(0, 10)
        : ''
    const firstLesson =
      firstFromApi || (pkgAnchor ? alignFirstLessonYmd(pkgAnchor, lwd, lt) : '')
    setSetupEnrollmentId(row.enrollment_id)
    const phoneRaw = row.phone || row.phone_number || ''
    setSetupPhoneLocked(!studentHasContactPhone(row))
    const setupNames = splitFullName(row.full_name)
    setSetupForm({
      ...emptyForm,
      first_name: setupNames.first_name,
      last_name: setupNames.last_name,
      full_name: row.full_name || '',
      phone: row.phone || row.phone_number || '',
      phone_number: row.phone_number || row.phone || '',
      email: row.email || '',
      billing_type: row.billing_type || '8_lessons',
      subject_id: row.subject_id || '',
      group_id: row.group_id || '',
      referral_notes: row.referral_notes || '',
      referral_source_id: row.referral_source_id || '',
      initial_payment_status: row.initial_payment_status || 'unpaid',
      payment_due_date: row.payment_due_date ? String(row.payment_due_date).slice(0, 10) : '',
      discount_percent: row.discount_percent != null ? String(row.discount_percent) : '',
      teacher_notes: row.teacher_notes || '',
      monthly_fee: row.monthly_fee != null ? String(row.monthly_fee) : '',
      parent_name: row.parent_name || '',
      parent_phone: row.parent_phone || '',
      enrollment_date: pkgAnchor,
      first_lesson_date: firstLesson || pkgAnchor,
      lesson_weekdays: lwd,
      lesson_times: lt,
      lesson_end_times: let_,
      billing_timing: row.billing_timing || 'postpaid',
      payment_plan: row.payment_plan || 'full',
      notifications_enabled: row.notifications_enabled !== false,
    })
    setSetupModal(true)
  }

  const collectSetupMissingFields = () => {
    const missing = []
    const setupFirst = String(setupForm.first_name || splitFullName(setupForm.full_name).first_name).trim()
    const setupLast = String(setupForm.last_name || splitFullName(setupForm.full_name).last_name).trim()
    const setupPhoneRaw = String(setupForm.phone_number || setupForm.phone || '').trim()
    if (!setupFirst) missing.push('Ad')
    if (!setupLast) missing.push('Soyad')
    if (!canonicalAzPhoneE164(setupPhoneRaw)) {
      missing.push(
        setupPhoneLocked
          ? 'Tələbə telefonu (email ilə profil linki göndərin — tələbə özü doldurmalıdır)'
          : 'Tələbə telefonu (düzgün AZ mobil, məs. +994 50 123 45 67)',
      )
    }
    if (!String(setupForm.first_lesson_date || '').trim()) {
      missing.push('Paket: ilk dərs tarixi')
    }
    if (!Array.isArray(setupForm.lesson_weekdays) || setupForm.lesson_weekdays.length === 0) {
      missing.push('Ən azı bir dərs günü')
    }
    return missing
  }

  const saveCompleteSetup = async () => {
    if (!setupEnrollmentId) return
    const missing = collectSetupMissingFields()
    if (missing.length) {
      setSetupFieldErrors(missing)
      return
    }
    setSetupFieldErrors(null)
    const setupFirst = String(setupForm.first_name || splitFullName(setupForm.full_name).first_name).trim()
    const setupLast = String(setupForm.last_name || splitFullName(setupForm.full_name).last_name).trim()
    const setupPhone = canonicalAzPhoneE164(
      String(setupForm.phone_number || setupForm.phone || '').trim(),
    )
    setLoading(true)
    try {
      const body = {
        full_name: joinFullName(setupFirst, setupLast),
        email: setupForm.email || null,
        billing_type: setupForm.billing_type,
        enrollment_date: setupForm.enrollment_date || setupForm.first_lesson_date,
        first_lesson_date: setupForm.first_lesson_date,
        lesson_weekdays: setupForm.lesson_weekdays,
        lesson_times: setupForm.lesson_times,
        lesson_end_times: setupForm.lesson_end_times,
        billing_timing: setupForm.billing_timing,
        payment_plan: setupForm.payment_plan,
        initial_payment_status: setupForm.initial_payment_status,
        payment_due_date: setupForm.payment_due_date || null,
        discount_percent: setupForm.discount_percent || null,
        teacher_notes: setupForm.teacher_notes,
        referral_notes: setupForm.referral_notes,
        referral_source_id: setupForm.referral_source_id || null,
        parent_name: setupForm.parent_name,
        parent_phone: setupForm.parent_phone,
        monthly_fee: setupForm.monthly_fee,
        subject_id: setupForm.subject_id || null,
        group_id: setupForm.group_id || null,
        notifications_enabled: setupForm.notifications_enabled,
      }
      if (setupPhone && !setupPhoneLocked) body.phone = setupPhone
      await api.post(`/students/enrollment/${encodeURIComponent(setupEnrollmentId)}/complete-setup`, body)
      toast('Quraşdırma tamamlandı — tələbə aktivdir')
      setSetupModal(false)
      setSetupEnrollmentId(null)
      await load(true)
    } catch (err) {
      if (err?.code === 'PROFILE_INCOMPLETE' || err?.code === 'STUDENT_MUST_COMPLETE_PROFILE') {
        setSetupFieldErrors([
          err?.message || 'Tələbə profili tam deyil — email ilə link göndərin.',
        ])
      } else {
        toast(err?.message || 'Xəta', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  const sendSetupProfileCompletionEmail = async () => {
    if (!setupEnrollmentId) return
    setSendProfileEmailBusy(true)
    try {
      const r = await api.post(
        `/students/enrollment/${encodeURIComponent(setupEnrollmentId)}/send-profile-completion-email`,
      )
      toast(r?.message || 'Email göndərildi', 'success')
      try {
        const d = await api.get('/students')
        const next = d.students || []
        setStudents(next)
        writeCache(CACHE_KEY, { students: next })
        const refreshed = next.find((s) => s.enrollment_id === setupEnrollmentId)
        if (refreshed) {
          const p = refreshed.phone || refreshed.phone_number || ''
          setSetupPhoneLocked(!canonicalAzPhoneE164(p))
          setSetupForm((prev) => ({ ...prev, phone: p, phone_number: p }))
        }
      } catch {
        /* ignore refresh */
      }
    } catch (err) {
      toast(err?.message || 'Email göndərilmədi', 'error')
    } finally {
      setSendProfileEmailBusy(false)
    }
  }

  const openEdit = (s) => {
    setEditId(s.enrollment_id)
    setEditStudentId(s.id || s.student_id || null)
    const enrSlice =
      s.enrollment_start_date != null && s.enrollment_start_date !== ''
        ? String(s.enrollment_start_date).slice(0, 10)
        : ''
    const firstSlice =
      s.first_lesson_date != null && String(s.first_lesson_date).trim() !== ''
        ? String(s.first_lesson_date).slice(0, 10)
        : ''
    const pkgAnchor = firstSlice || enrSlice
    setEditOriginal({
      full_name: s.full_name || '',
      phone: s.phone || '',
      email: s.email || '',
      billing_type: s.billing_type || '8_lessons',
      monthly_fee: s.monthly_fee != null && s.monthly_fee !== '' ? String(s.monthly_fee) : '',
      enrollment_date: pkgAnchor,
      first_lesson_date: pkgAnchor,
      billing_timing: s.billing_timing === 'prepaid' ? 'prepaid' : 'postpaid',
      payment_plan: s.payment_plan === 'partial' ? 'partial' : 'full',
      subject_id: s.subject_id ? String(s.subject_id) : '',
      group_id: s.group_id ? String(s.group_id) : '',
      lesson_weekdays: normalizeWeekdays(s.lesson_weekdays),
      lesson_times: normalizeLessonTimes(s.lesson_times),
      lesson_end_times: normalizeLessonEndTimes(s.lesson_end_times, normalizeLessonTimes(s.lesson_times)),
      parent_name: s.parent_name || '',
      parent_phone: s.parent_phone || '',
      notifications_enabled: s.notifications_enabled !== false,
    })
    const editNames = splitFullName(s.full_name)
    setEditForm({
      first_name: editNames.first_name,
      last_name: editNames.last_name,
      full_name: s.full_name || '',
      phone: s.phone || s.phone_number || '',
      phone_number: s.phone_number || s.phone || '',
      email: s.email || '',
      billing_type: s.billing_type || '8_lessons',
      referral_notes: s.referral_notes || '',
      referral_source_id: s.referral_source_id || '',
      initial_payment_status: s.initial_payment_status || 'unpaid',
      payment_due_date: s.payment_due_date ? String(s.payment_due_date).slice(0, 10) : '',
      discount_percent: s.discount_percent != null ? String(s.discount_percent) : '',
      teacher_notes: s.teacher_notes || '',
      monthly_fee: s.monthly_fee != null && s.monthly_fee !== '' ? String(s.monthly_fee) : '',
      enrollment_date: pkgAnchor,
      billing_timing: s.billing_timing === 'prepaid' ? 'prepaid' : 'postpaid',
      payment_plan: s.payment_plan === 'partial' ? 'partial' : 'full',
      subject_id: s.subject_id ? String(s.subject_id) : '',
      group_id: s.group_id ? String(s.group_id) : '',
      first_lesson_date: pkgAnchor,
      teacher_schedule_id: '',
      lesson_weekdays: normalizeWeekdays(s.lesson_weekdays),
      lesson_times: normalizeLessonTimes(s.lesson_times),
      lesson_end_times: normalizeLessonEndTimes(s.lesson_end_times, normalizeLessonTimes(s.lesson_times)),
      parent_name: s.parent_name || '',
      parent_phone: s.parent_phone || '',
      notifications_enabled: s.notifications_enabled !== false,
    })
    setEditModal(true)
  }

  function bakuNowParts() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Baku',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date())
    const get = (t) => parts.find((p) => p.type === t)?.value
    const wdMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
    const dow = wdMap[get('weekday')] || 1
    const hour = parseInt(get('hour') || '0', 10) || 0
    const minute = parseInt(get('minute') || '0', 10) || 0
    return { dow, minutes: hour * 60 + minute }
  }

  function normalizeLessonTimesMap(raw) {
    if (!raw) return {}
    if (typeof raw === 'object') return raw
    try {
      const parsed = JSON.parse(String(raw))
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function nextWeeklyDistanceMinutes(s) {
    const days = normalizeWeekdays(s.lesson_weekdays)
    if (!days.length) return Number.POSITIVE_INFINITY
    const lt = normalizeLessonTimesMap(s.lesson_times)
    const now = bakuNowParts()
    const cur = (now.dow - 1) * 1440 + now.minutes
    let best = Number.POSITIVE_INFINITY
    for (const d of days) {
      const tRaw = lt?.[String(d)] ?? lt?.[d]
      const t = String(tRaw || '').slice(0, 5)
      if (!/^\d{2}:\d{2}$/.test(t)) continue
      const [hh, mm] = t.split(':').map((x) => parseInt(x, 10))
      const target = (d - 1) * 1440 + hh * 60 + mm
      const dist = (target - cur + 10080) % 10080
      best = Math.min(best, dist)
    }
    return best
  }

  const subjectOptions = useMemo(() => {
    const set = new Set()
    for (const s of students) {
      if (!studentMatchesAudienceFilter(s, audienceFilter)) continue
      const name = resolveStudentSubjectLabel(s)
      if (name && name !== 'Sahəsiz' && !isSystemTeachingSubjectName(name)) set.add(name)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [students, audienceFilter])

  const audienceStudents = useMemo(
    () => students.filter((s) => studentMatchesAudienceFilter(s, audienceFilter)),
    [students, audienceFilter],
  )

  const pendingStudents = useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    return students.filter((s) => {
      if (!needsSetup(s)) return false
      if (!q) return true
      const name = String(s?.full_name || '').toLowerCase()
      const phone = String(s?.phone || '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    })
  }, [students, search])

  useEffect(() => {
    if (listLoading || pendingStudents.length === 0) return
    const ids = pendingStudents.map((s) => String(s.enrollment_id)).filter(Boolean)
    const seen = readPendingSetupToastSeen()
    const newIds = ids.filter((id) => !seen.includes(id))
    if (!newIds.length) return

    const newPending = pendingStudents.filter((s) => newIds.includes(String(s.enrollment_id)))
    const needsPhone = newPending.some((s) => !studentHasContactPhone(s))
    toast(
      needsPhone
        ? `${newPending.length} yeni tələbə quraşdırma gözləyir. Telefonu yoxdursa profil linki göndərin; telefon tamam olanda «Quraşdırmanı tamamla» ilə paket/cədvəl təyin edin — sonra siyahıdan silinəcək.`
        : `${newPending.length} tələbənin telefonu hazırdır — «Quraşdırmanı tamamla» ilə paket və cədvəli təyin edin; tamamladıqdan sonra bu xəbərdarlıq getməyəcək.`,
      'info',
    )
    markPendingSetupToastSeen(newIds)
  }, [listLoading, pendingStudents, toast])

  const awaitingStudentPhone = useMemo(
    () => pendingStudents.some((s) => !studentHasContactPhone(s)),
    [pendingStudents],
  )

  useEffect(() => {
    if (!awaitingStudentPhone) return undefined
    const poll = () => void load(true)
    const id = window.setInterval(poll, 20000)
    const onFocus = () => poll()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') poll()
    })
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [awaitingStudentPhone])

  const grouped = useMemo(() => {
    const byKey = new Map()

    // Ensure group list matches "Kurslar və qruplar" (includes empty groups).
    for (const subj of normalizeTeachingSubjects(teachingSubjects)) {
      for (const gr of Array.isArray(subj.groups) ? subj.groups : []) {
        if (!gr?.id) continue
        const gid = String(gr.id)
        const key = `gid:${gid}`
        if (byKey.has(key)) continue
        byKey.set(key, {
          key,
          subject: String(subj.name || '').trim() || 'Sahəsiz',
          group: String(gr.name || '').trim() || 'Qrup',
          group_id: gid,
          subject_id: subj.id || null,
          is_system_group: false,
          students: [],
          nextDistMin: Number.POSITIVE_INFINITY,
          avgScore: null,
          payMix: { prepaid: 0, installment: 0, postpaid: 0 },
        })
      }
    }

    for (const s of audienceStudents) {
      if (needsSetup(s)) continue
      const subject = resolveStudentSubjectLabel(s)
      const group = resolveStudentGroupLabel(s)
      const gid = s.group_id ? String(s.group_id) : ''
      const key = gid ? `gid:${gid}` : `legacy:${subject}__${group}`
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          subject,
          group,
          group_id: gid || null,
          subject_id: s.subject_id || null,
          is_system_group: Boolean(s.is_system_group),
          students: [],
          nextDistMin: Number.POSITIVE_INFINITY,
          avgScore: null,
          payMix: { prepaid: 0, installment: 0, postpaid: 0 },
        })
      }
      const g = byKey.get(key)
      g.students.push(s)
      g.nextDistMin = Math.min(g.nextDistMin, nextWeeklyDistanceMinutes(s))
      // lightweight “quick stats” (defensive; may be missing on backend)
      const scoreRaw = s?.avg_score ?? s?.exam_avg_score ?? s?.last_score_pct ?? s?.score_pct
      const score = Number(scoreRaw)
      if (Number.isFinite(score)) {
        const prev = g.avgScore == null ? { sum: 0, n: 0 } : g.avgScore
        g.avgScore = { sum: prev.sum + Math.max(0, Math.min(100, score)), n: prev.n + 1 }
      }
      if (s?.payment_plan === 'partial') g.payMix.installment += 1
      else if (s?.billing_timing === 'prepaid') g.payMix.prepaid += 1
      else g.payMix.postpaid += 1
    }
    const arr = [...byKey.values()]
    for (const g of arr) {
      g.students.sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || '')))
      if (g.avgScore && g.avgScore.n) {
        g.avgScore = Math.round(g.avgScore.sum / g.avgScore.n)
      } else {
        g.avgScore = null
      }
    }
    arr.sort((a, b) => {
      if (a.nextDistMin !== b.nextDistMin) return a.nextDistMin - b.nextDistMin
      return `${a.subject}__${a.group}`.localeCompare(`${b.subject}__${b.group}`)
    })
    return arr
  }, [audienceStudents, teachingSubjects])

  const visibleGroups = useMemo(() => {
    if (!subjectFilter) return grouped
    return grouped.filter((g) => g.subject === subjectFilter)
  }, [grouped, subjectFilter])

  const filteredGroups = useMemo(() => {
    const q = String(search || '').trim().toLowerCase()
    if (!q) return visibleGroups
    return visibleGroups
      .map((g) => {
        const groupMatch =
          String(g.group || '').toLowerCase().includes(q) ||
          String(g.subject || '').toLowerCase().includes(q)
        const next = (Array.isArray(g.students) ? g.students : []).filter((s) => {
          const name = String(s?.full_name || '').toLowerCase()
          const phone = String(s?.phone || '').toLowerCase()
          const email = String(s?.email || '').toLowerCase()
          return name.includes(q) || phone.includes(q) || email.includes(q)
        })
        return { ...g, students: groupMatch ? g.students : next, _groupMatch: groupMatch }
      })
      .filter((g) => (g._groupMatch ? true : g.students.length > 0))
      .map(({ _groupMatch, ...rest }) => rest)
  }, [visibleGroups, search])

  const initials = (name) =>
    String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '—'

  const paymentBadge = (s) => {
    const plan = s?.payment_plan === 'partial' ? 'installment' : 'full'
    const timing = s?.billing_timing === 'prepaid' ? 'prepaid' : 'postpaid'
    if (plan === 'installment') return { variant: 'due', label: 'Hissəli' }
    if (timing === 'prepaid') return { variant: 'paid', label: 'Öncədən' }
    return { variant: 'pending', label: 'Sonradan' }
  }

  const lessonProgress = (s) => {
    const used = Number(s?.calendar_used_lessons ?? s?.lesson_count ?? 0) || 0
    const total = Number(s?.calendar_total_lessons ?? 0) || 0
    if (!total) return null
    const pct = Math.max(0, Math.min(100, Math.round((used / total) * 100)))
    return { used, total, pct }
  }

  const packLabelForStudent = (s) => {
    const bt = String(s?.billing_type || '').trim()
    if (bt === '8_lessons') return '8 dərs'
    if (bt === '12_lessons') return '12 dərs'
    if (bt === 'monthly') return 'Aylıq'
    return null
  }

  const STUDENT_LIST_GRID =
    'sm:grid sm:gap-x-3 sm:gap-y-2 sm:grid-cols-[1.25rem_minmax(0,1fr)_2.25rem_9rem_5.5rem_4.5rem_2.25rem]'
  const STUDENT_ROW_GRID =
    'grid grid-cols-[minmax(0,1fr)_auto] sm:col-span-full sm:grid-cols-subgrid items-center gap-x-2 sm:gap-x-0'

  const badgeTone = (variant) => {
    if (theme === 'dark') return ''
    // Light theme: make badges readable on white surfaces
    if (variant === 'paid') return 'bg-emerald-500/12 text-emerald-700 border-emerald-600/20'
    if (variant === 'due') return 'bg-amber-500/12 text-amber-700 border-amber-600/20'
    if (variant === 'pending') return 'bg-sky-500/12 text-sky-700 border-sky-600/20'
    if (variant === 'danger') return 'bg-red-500/12 text-red-700 border-red-600/20'
    return 'bg-black/5 text-gray-700 border-black/10'
  }

  const fmtNextLesson = (distMin) => {
    if (!Number.isFinite(distMin) || distMin === Number.POSITIVE_INFINITY) return '—'
    if (distMin < 60) return `${distMin} dəq`
    const h = Math.floor(distMin / 60)
    const m = distMin % 60
    return m ? `${h}s ${m}dəq` : `${h}s`
  }

  const closeStudentMenu = () => setActionMenuId(null)

  const canDragStudent = (s) => {
    if (blocked) return false
    if (isLightEnrollmentSource(s?.enrollment_source)) return false
    if (isPendingApproval(s)) return false
    if (Boolean(s?.is_system_group)) return false
    if (!s?.enrollment_id || !s?.group_id) return false
    return audienceFilter === 'all' || audienceFilter === 'group'
  }

  const canDropOnGroup = (g, student) => {
    if (!student || !g?.group_id) return false
    if (g.is_system_group) return false
    if (String(g.group_id) === String(student.group_id || '')) return false
    return true
  }

  const handleStudentDragStart = (e, student) => {
    if (!canDragStudent(student)) {
      e.preventDefault()
      return
    }
    closeStudentMenu()
    setDraggingStudentId(student.enrollment_id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(student.enrollment_id))
    try {
      e.dataTransfer.setData(
        'application/x-mentorix-student',
        JSON.stringify({ enrollment_id: student.enrollment_id }),
      )
    } catch {
      /* ignore */
    }
  }

  const handleStudentDragEnd = () => {
    setDraggingStudentId(null)
    setDragOverGroupKey(null)
  }

  const handleGroupDragOver = (e, g, studentHint = null) => {
    const enrollmentId = studentHint?.enrollment_id || draggingStudentId
    if (!enrollmentId) return
    const student =
      studentHint ||
      audienceStudents.find((s) => String(s.enrollment_id) === String(enrollmentId))
    if (!student || !canDropOnGroup(g, student)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverGroupKey(g.key)
  }

  const handleGroupDragLeave = (e, g) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    if (dragOverGroupKey === g.key) setDragOverGroupKey(null)
  }

  const openTransferModal = (student, targetGroupMeta, sourceGroupLabel) => {
    if (!student || !targetGroupMeta?.group) return
    setTransferModal({
      student,
      sourceGroupId: student.group_id,
      sourceGroupLabel: sourceGroupLabel || resolveStudentGroupLabel(student),
      targetGroupId: targetGroupMeta.group.id,
      targetGroupLabel: targetGroupMeta.group.name,
      targetGroup: targetGroupMeta.group,
      targetSubjectId: targetGroupMeta.subject?.id,
    })
  }

  const handleGroupDrop = (e, g) => {
    e.preventDefault()
    setDragOverGroupKey(null)
    setDraggingStudentId(null)
    const enrollmentId =
      e.dataTransfer.getData('text/plain') ||
      (() => {
        try {
          const raw = e.dataTransfer.getData('application/x-mentorix-student')
          return raw ? JSON.parse(raw)?.enrollment_id : null
        } catch {
          return null
        }
      })()
    const student = audienceStudents.find((s) => String(s.enrollment_id) === String(enrollmentId))
    if (!student || !canDropOnGroup(g, student)) return
    const targetGroupId = g.group_id
    if (!targetGroupId) {
      toast('Hədəf qrupun identifikatoru tapılmadı', 'error')
      return
    }
    const meta = findTeachingGroupMeta(teachingSubjects, targetGroupId)
    if (!meta) {
      toast('Hədəf qrup tapılmadı — siyahını yeniləyin', 'error')
      return
    }
    if (String(meta.group.id) !== String(targetGroupId)) {
      toast('Qrup uyğunsuzluğu — səhifəni yeniləyin', 'error')
      return
    }
    openTransferModal(student, meta, resolveStudentGroupLabel(student))
    if (!openGroups.has(g.key)) {
      setOpenGroups((prev) => new Set(prev).add(g.key))
    }
  }

  const reloadTeachingSubjects = useCallback(async () => {
    try {
      const d = await api.get('/instructor/teaching')
      setTeachingSubjects(normalizeTeachingSubjects(d.subjects))
    } catch {
      /* ignore */
    }
  }, [])

  const handleTransferSuccess = (res) => {
    toast('Tələbə uğurla köçürüldü', 'success')
    void load(true)
    const empty = res?.source_group?.is_empty ? res.source_group : null
    if (empty?.id) {
      setEmptyGroupPrompt({
        groupId: empty.id,
        groupName: empty.name || res?.source_group_name || 'Qrup',
      })
    }
  }

  const confirmDeleteEmptyGroup = async () => {
    if (!emptyGroupPrompt?.groupId) return
    setEmptyGroupDeleteBusy(true)
    try {
      await api.delete(`/instructor/teaching/groups/${encodeURIComponent(emptyGroupPrompt.groupId)}`)
      toast(`«${emptyGroupPrompt.groupName}» qrupu silindi`, 'success')
      setEmptyGroupPrompt(null)
      setOpenGroups((prev) => {
        const next = new Set(prev)
        next.delete(`gid:${emptyGroupPrompt.groupId}`)
        return next
      })
      await reloadTeachingSubjects()
      await load(true)
    } catch (e) {
      toast(e?.message || 'Qrup silinmədi', 'error')
    } finally {
      setEmptyGroupDeleteBusy(false)
    }
  }

  const canManageEmptyGroup = (g) =>
    Boolean(g?.group_id) &&
    !g?.is_system_group &&
    (g.students?.length || 0) === 0 &&
    (audienceFilter === 'all' || audienceFilter === 'group')

  const openRenameGroup = (g) => {
    if (!g?.group_id) return
    const meta = findTeachingGroupMeta(teachingSubjects, g.group_id)
    setGroupRenameModal({
      groupId: g.group_id,
      groupName: g.group,
      groupRecord: meta?.group || null,
    })
  }

  const promptDeleteGroup = (g) => {
    if (!g?.group_id) return
    setEmptyGroupPrompt({
      groupId: g.group_id,
      groupName: g.group || 'Qrup',
    })
  }

  const saveGroupRename = async () => {
    if (!groupRenameModal?.groupId) return
    const trimmed = String(groupRenameModal.groupName || '').trim()
    if (!trimmed) {
      toast('Qrup adı boş ola bilməz', 'error')
      return
    }
    const meta = findTeachingGroupMeta(teachingSubjects, groupRenameModal.groupId)
    const dup = findGroupByName(meta?.subject, trimmed)
    if (dup && String(dup.id) !== String(groupRenameModal.groupId)) {
      toast('Bu sahədə eyni adlı qrup artıq mövcuddur', 'error')
      return
    }
    setGroupRenameBusy(true)
    try {
      const body = groupRenameModal.groupRecord
        ? groupPackagePayload(groupRenameModal.groupRecord, trimmed)
        : { name: trimmed }
      await api.patch(`/instructor/teaching/groups/${encodeURIComponent(groupRenameModal.groupId)}`, body)
      toast('Qrup adı yeniləndi', 'success')
      setGroupRenameModal(null)
      await reloadTeachingSubjects()
      await load(true)
    } catch (e) {
      toast(e?.message || 'Qrup adı yenilənmədi', 'error')
    } finally {
      setGroupRenameBusy(false)
    }
  }

  const openDirectChat = (s) => {
    closeStudentMenu()
    if (!s?.id) return
    if (blocked) {
      toast(billing?.messages?.banner || 'Məhdudiyyətə görə çat deaktivdir', 'error')
      return
    }
    if (!canUseDirectChat(billing)) {
      setDirectChatUpgrade({ studentName: s.full_name || 'Tələbə' })
      return
    }
    const name = s.full_name || 'Tələbə'
    const qs = new URLSearchParams({
      peerId: s.id,
      peerName: name,
    })
    navigate(`/instructor/direct-chat?${qs.toString()}`)
  }

  const saveEdit = async () => {
    if (!editId) {
      toast('Qeydiyyat tapılmadı — səhifəni yeniləyin', 'error')
      return
    }
    const editFirst = String(editForm.first_name || splitFullName(editForm.full_name).first_name).trim()
    const editLast = String(editForm.last_name || splitFullName(editForm.full_name).last_name).trim()
    const editPhone = String(editForm.phone_number || editForm.phone || '').trim()
    if (!editFirst || !editLast || !editPhone) {
      toast('Ad, soyad və telefon mütləqdir', 'error')
      return
    }
    const editFullName = joinFullName(editFirst, editLast)
    if (!editForm.lesson_weekdays?.length) {
      toast('Ən azı bir dərs günü seçin', 'error')
      return
    }
    const original = editOriginal || {}
    const editPkg = editForm.billing_type === '8_lessons' || editForm.billing_type === '12_lessons'
    // Telefon kimi sadə dəyişikliklərdə mövcud başlanğıc tarixi varsa bloklama.
    const effectiveEnrollment =
      editForm.enrollment_date || original.enrollment_date || ''
    const effectiveFirstLesson =
      editForm.first_lesson_date || original.first_lesson_date || ''
    if (editPkg && !effectiveFirstLesson) {
      toast('Paket üçün ilk dərs tarixini seçin', 'error')
      return
    }

    const emailTrim = String(editForm.email || '').trim().toLowerCase()
    const origEmailTrim = String(original.email || '').trim().toLowerCase()
    if (emailTrim !== origEmailTrim) {
      if (emailTrim) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
          toast('Email formatı düzgün deyil', 'error')
          return
        }
      }
    }

    const enrollmentPatch = effectiveFirstLesson || effectiveEnrollment

    if (emailTrim !== origEmailTrim) {
      if (!editStudentId) {
        toast('Tələbə ID tapılmadı — səhifəni yeniləyib yenidən cəhd edin', 'error')
        return
      }
    }

    setLoading(true)
    try {
      if (emailTrim !== origEmailTrim) {
        await api.patch(`/students/${encodeURIComponent(editStudentId)}/email`, { email: emailTrim || null })
      }

      // Yalnız dəyişən sahələri göndər (telefon update-də tarix validasiyası trigger olmasın).
      const patchBody = {}
      const setIfChanged = (k, v, ov) => {
        if (v == null && ov == null) return
        if (JSON.stringify(v) === JSON.stringify(ov)) return
        patchBody[k] = v
      }
      // Backend bəzi hallarda göndərilməyən string sahələri NULL kimi update edə bilir.
      // Ona görə ən azı bu ikisini həmişə göndəririk.
      patchBody.full_name = editFullName
      patchBody.phone = editPhone
      setIfChanged('billing_type', editForm.billing_type, original.billing_type)
      setIfChanged('referral_notes', editForm.referral_notes, original.referral_notes)
      setIfChanged('monthly_fee', editForm.monthly_fee, original.monthly_fee)
      setIfChanged('billing_timing', editForm.billing_timing || 'postpaid', original.billing_timing)
      setIfChanged('payment_plan', editForm.payment_plan || 'full', original.payment_plan)
      setIfChanged('notifications_enabled', Boolean(editForm.notifications_enabled), Boolean(original.notifications_enabled))
      setIfChanged('subject_id', editForm.subject_id || null, original.subject_id || null)
      setIfChanged('group_id', editForm.group_id || null, original.group_id || null)
      setIfChanged('lesson_weekdays', editForm.lesson_weekdays, original.lesson_weekdays)
      setIfChanged('lesson_times', editForm.lesson_times || {}, original.lesson_times || {})
      setIfChanged('lesson_end_times', editForm.lesson_end_times || {}, original.lesson_end_times || {})
      setIfChanged('parent_name', editForm.parent_name, original.parent_name)
      setIfChanged('parent_phone', editForm.parent_phone, original.parent_phone)
      // Köhnə qeydiyyatlarda tarix NULL ola bilər; boş string göndərsək backend valide etməyə çalışıb 400 qaytarır.
      if (enrollmentPatch) setIfChanged('enrollment_date', enrollmentPatch, original.enrollment_date || null)
      if (editForm.billing_type === '8_lessons' || editForm.billing_type === '12_lessons') {
        if (effectiveFirstLesson) setIfChanged('first_lesson_date', effectiveFirstLesson, original.first_lesson_date || null)
      } else if (editMonthly) {
        if (effectiveEnrollment) setIfChanged('first_lesson_date', effectiveEnrollment, original.first_lesson_date || null)
      }
      if (!Object.keys(patchBody).length) {
        toast('Dəyişiklik yoxdur', 'info')
        setEditModal(false)
        setEditStudentId(null)
        return
      }
      await api.patch('/students/enrollment/' + encodeURIComponent(editId), patchBody)
      toast('Melumatlari yenilendi!')
      setEditModal(false)
      setEditStudentId(null)
      load()
    } catch (err) {
      toast(err.message || 'Xeta', 'error')
    } finally {
      setLoading(false)
    }
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

  const openDeleteConfirm = (s) => {
    closeStudentMenu()
    setDeleteConfirm({
      enrollmentId: s.enrollment_id,
      studentName: String(s.full_name || 'Tələbə').trim() || 'Tələbə',
    })
  }

  const confirmDeleteStudent = async () => {
    if (!deleteConfirm?.enrollmentId || deleteBusy) return
    setDeleteBusy(true)
    try {
      const deleted = students.find((s) => String(s?.enrollment_id) === String(deleteConfirm.enrollmentId)) || null
      await api.delete('/students/enrollment/' + deleteConfirm.enrollmentId)
      toast('Tələbə silindi', 'success')
      setDeleteConfirm(null)
      // Refresh list immediately so we can decide whether the group is now empty.
      let nextStudents = []
      try {
        const d = await api.get('/students')
        nextStudents = d.students || []
        setStudents(nextStudents)
        writeCache(CACHE_KEY, { students: nextStudents })
      } catch {
        // fallback: best-effort
        await load(true)
      }

      const gid = deleted?.group_id ? String(deleted.group_id) : ''
      const isSystem = Boolean(deleted?.is_system_group)
      if (gid && !isSystem) {
        const remaining = (Array.isArray(nextStudents) ? nextStudents : [])
          .filter((s) => String(s?.group_id || '') === gid)
          .filter((s) => {
            const st = String(s?.enrollment_status || '').toLowerCase()
            return st !== 'rejected' && st !== 'left' && st !== 'archived'
          }).length
        if (remaining === 0) {
          const meta = findTeachingGroupMeta(teachingSubjects, gid)
          setEmptyGroupPrompt({
            groupId: gid,
            groupName: meta?.group?.name || resolveStudentGroupLabel(deleted) || 'Qrup',
          })
        }
      }
    } catch (err) {
      toast(err.message || 'Silinmədi', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const openRestoreModal = (s) => {
    const eid = s.enrollment_id
    const name = s.full_name || 'Tələbə'
    setRestoreModal({
      enrollmentId: eid,
      studentName: name,
      items: [],
      selected: new Set(),
      loading: true,
      error: null,
    })
    void (async () => {
      try {
        const d = await api.get(`/payments/enrollment/${encodeURIComponent(eid)}/restore-preview`)
        const items = Array.isArray(d.items) ? d.items : []
        setRestoreModal((prev) =>
          prev?.enrollmentId === eid ? { ...prev, items, loading: false, error: null } : prev
        )
      } catch (e) {
        setRestoreModal((prev) =>
          prev?.enrollmentId === eid ? { ...prev, items: [], loading: false, error: e?.message || 'Yüklənmədi' } : prev
        )
      }
    })()
  }

  const confirmRestore = async () => {
    if (!restoreModal?.enrollmentId) return
    const ids = [...(restoreModal.selected || new Set())]
    if (!ids.length) return toast('Heç nə seçilməyib', 'error')
    setRestoreModal((p) => (p ? { ...p, loading: true, error: null } : p))
    try {
      const d = await api.post(
        `/payments/enrollment/${encodeURIComponent(restoreModal.enrollmentId)}/restore-confirm`,
        { ids }
      )
      toast(`Əlavə olundu: ${d?.count || 0} ödəniş`, 'success')
      setRestoreModal(null)
      load(true)
    } catch (e) {
      setRestoreModal((p) => (p ? { ...p, loading: false, error: e?.message || 'Xəta' } : p))
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-xl sm:text-2xl break-words">Tələbələrim</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-xl">
            {listLoading
              ? '…'
              : `${audienceFilter === 'all' ? students.length : audienceStudents.length} tələbə`}{' '}
            · İmtahan/tapşırıq iştirakçıları üçün filtr · Qrup qoşulması{' '}
            <Link to="/instructor/join-requests" className="text-primary hover:underline font-medium">
              Sorğular
            </Link>
            -da görünür; qrup üçün{' '}
            <Link to="/instructor/teaching-groups" className="text-primary hover:underline font-medium">
              dəvət linki
            </Link>
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
          <Link
            to="/instructor/join-requests"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border border-primary/35 text-primary hover:bg-primary/10 transition-colors"
          >
            Sorğular
            {joinPendingCount > 0 ? (
              <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-black text-xs font-bold inline-flex items-center justify-center">
                {joinPendingCount > 99 ? '99+' : joinPendingCount}
              </span>
            ) : null}
          </Link>
          <Link
            to="/instructor/teaching-groups"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary text-black hover:brightness-110 transition-colors"
          >
            Dəvət linki
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-token-textMuted">
                ⌕
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Axtar… (ad, telefon və ya email)"
                className={[
                  'w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none',
                  'bg-token-surfaceCard/55 border border-[color:var(--border-subtle)]',
                  'text-token-textMain placeholder:text-token-textMuted',
                  'focus:border-primary/40 focus:ring-2 focus:ring-primary/15',
                  'transition-[box-shadow,border-color] duration-200',
                ].join(' ')}
              />
            </div>
          </div>
          <select
            className={[
              'w-full sm:w-56 rounded-xl px-3 py-2.5 text-sm outline-none',
              'bg-token-surfaceCard/55 border border-[color:var(--border-subtle)]',
              'text-token-textMain',
              'focus:border-primary/40 focus:ring-2 focus:ring-primary/15',
              'transition-[box-shadow,border-color] duration-200',
            ].join(' ')}
            value={audienceFilter}
            onChange={(e) => {
              setAudienceFilter(e.target.value)
              setSubjectFilter('')
            }}
          >
            <option value="all">Bütün tələbələr</option>
            <option value="group">Daimi qrup tələbələri (CRM)</option>
            <option value="exam">Qonaq imtahan iştirakçıları</option>
            <option value="task">Qonaq tapşırıq iştirakçıları</option>
          </select>
          <select
            className={[
              'w-full sm:w-56 rounded-xl px-3 py-2.5 text-sm outline-none',
              'bg-token-surfaceCard/55 border border-[color:var(--border-subtle)]',
              'text-token-textMain',
              'focus:border-primary/40 focus:ring-2 focus:ring-primary/15',
              'transition-[box-shadow,border-color] duration-200',
            ].join(' ')}
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="">Bütün sahələr</option>
            {subjectOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!listLoading && pendingStudents.length > 0 && (
        <Card className="mb-5 p-4 border border-amber-500/35 bg-amber-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-display font-bold text-base text-amber-100">
                Təyin gözləyən tələbələr
              </h2>
              <p className="text-xs text-amber-200/70 mt-1">
                Yalnız qrup/sahə linki ilə qoşulan tələbələr. İmtahan və tapşırıq linki ilə gələnlər «Sorğular»
                bölməsindədir — paket/cədvəl lazım deyil. Telefonu yoxdursa profil linki göndərin; paket/cədvəl
                təyin etdikdən sonra bu sətir yox olur.
              </p>
            </div>
            <StatusBadge variant="due">{pendingStudents.length} gözləyir</StatusBadge>
          </div>
          <div className="space-y-2">
            {pendingStudents.map((s) => (
              <div
                key={s.enrollment_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-black/20 px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-token-textMain flex items-center gap-2">
                    <PresenceDot user={s} size="md" />
                    {s.full_name}
                  </div>
                  <div className="text-xs text-token-textMuted mt-0.5">
                    {studentHasContactPhone(s) ? s.phone || s.phone_number : 'Telefon gözlənilir'} •{' '}
                    {resolveStudentGroupLabel(s)} •{' '}
                    {s.enrolled_at
                      ? new Date(s.enrolled_at).toLocaleDateString('az-AZ')
                      : '—'}
                  </div>
                  {studentHasContactPhone(s) ? (
                    <p className="text-[11px] text-emerald-300/90 mt-1">
                      Telefon hazırdır — paket və cədvəli təyin edib tamamlayın.
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-200/80 mt-1">
                      Tələbə hələ telefonu doldurmayıb — profil linki göndərin.
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={() => void openCompleteSetup(s)}>
                  Quraşdırmanı tamamla
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-2.5">
        {!listLoading && !listError && filteredGroups.length > 0 && (audienceFilter === 'all' || audienceFilter === 'group') ? (
          <p className="text-xs text-token-textMuted px-1 flex items-center gap-2">
            <span className="text-primary/80" aria-hidden>
              ⠿
            </span>
            Tələbəni başqa qrupun üzərinə sürükləyib buraxın — köçürmə təsdiq pəncərəsi açılacaq.
          </p>
        ) : null}
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
        {!listLoading &&
          !listError &&
          filteredGroups.map((g) => {
            const isOpen = openGroups.has(g.key)
            const groupStatus = isOpen ? { variant: 'paid', label: 'Aktiv' } : { variant: 'neutral', label: 'Bağlı' }
            const total = g.students.length
            const payTop =
              g.payMix.installment
                ? { variant: 'due', label: `Hissəli · ${g.payMix.installment}/${total}` }
                : g.payMix.prepaid
                  ? { variant: 'paid', label: `Öncədən · ${g.payMix.prepaid}/${total}` }
                  : { variant: 'pending', label: `Sonradan · ${g.payMix.postpaid}/${total}` }

            const toggleGroup = () => {
              closeStudentMenu()
              setOpenGroups((prev) => {
                const next = new Set(prev)
                if (next.has(g.key)) next.delete(g.key)
                else next.add(g.key)
                return next
              })
            }
            return (
              <Card
                key={g.key}
                hover
                onDragOver={(e) => handleGroupDragOver(e, g)}
                onDragLeave={(e) => handleGroupDragLeave(e, g)}
                onDrop={(e) => handleGroupDrop(e, g)}
                className={[
                  // NOTE: dropdown needs to escape card bounds (no clipping)
                  'p-0 overflow-visible border relative z-10 transition-[box-shadow,border-color,transform] duration-200',
                  'border-[color:var(--border-subtle)] hover:border-primary/20',
                  isOpen ? 'border-primary/25 bg-token-surfaceCard/20 z-20' : '',
                  dragOverGroupKey === g.key
                    ? 'border-primary/60 ring-2 ring-primary/35 scale-[1.01] shadow-lg shadow-primary/10'
                    : '',
                ].join(' ')}
              >
                <div className="relative">
                  <div
                    className={[
                      'w-full grid grid-cols-12 items-center gap-3 px-4 py-3.5 text-left',
                      'bg-token-surfaceCard/45 hover:bg-token-surfaceCard/60',
                      'transition-[background-color,transform] duration-200 ease-out',
                      'active:scale-[0.997]',
                    ].join(' ')}
                  >
                    {/* CLICK AREA (LEFT + CENTER) */}
                    <button
                      type="button"
                      className="col-span-12 sm:col-span-9 grid grid-cols-12 items-center gap-3 text-left min-w-0"
                      onClick={toggleGroup}
                      aria-expanded={isOpen}
                    >
                      {/* LEFT */}
                      <div className="col-span-12 sm:col-span-7 min-w-0">
                        <div className="text-[15px] sm:text-base font-semibold text-token-textMain truncate">
                          {g.group}
                        </div>
                        <div className="text-xs text-token-textMuted truncate">
                          {g.subject} · {g.students.length} tələbə
                        </div>
                      </div>

                      {/* CENTER */}
                      <div className="hidden sm:flex col-span-5 items-center gap-2 min-w-0 justify-end">
                        <StatusBadge
                          variant="neutral"
                          className={['shrink-0', badgeTone('neutral')].join(' ')}
                        >
                          Növbəti dərs:{' '}
                          <span
                            className={[
                              'ml-1 tabular-nums',
                              theme === 'dark' ? 'text-gray-100' : 'text-gray-900',
                            ].join(' ')}
                          >
                            {fmtNextLesson(g.nextDistMin)}
                          </span>
                        </StatusBadge>
                        <StatusBadge
                          variant={payTop.variant}
                          className={['shrink-0', badgeTone(payTop.variant)].join(' ')}
                        >
                          {payTop.label}
                        </StatusBadge>
                        {g.avgScore != null ? (
                          <StatusBadge
                            variant="pending"
                            className={['shrink-0', badgeTone('pending')].join(' ')}
                          >
                            Avg bal:{' '}
                            <span
                              className={[
                                'ml-1 tabular-nums',
                                theme === 'dark' ? 'text-gray-100' : 'text-gray-900',
                              ].join(' ')}
                            >
                              {g.avgScore}%
                            </span>
                          </StatusBadge>
                        ) : null}
                      </div>
                    </button>

                    {/* ACTIONS (RIGHT) */}
                    <div className="col-span-12 sm:col-span-3 flex items-center justify-between sm:justify-end gap-2">
                      <StatusBadge variant={groupStatus.variant} className={badgeTone(groupStatus.variant)}>
                        {groupStatus.label}
                      </StatusBadge>

                      {canManageEmptyGroup(g) ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            title="Qrup adını dəyiş"
                            className={[
                              'h-9 px-2.5 rounded-xl border text-xs font-semibold transition-colors',
                              'border-[color:var(--border-subtle)] bg-token-surfaceCard/35 hover:bg-token-surfaceCard/60 text-token-textMain',
                            ].join(' ')}
                            onClick={(e) => {
                              e.stopPropagation()
                              openRenameGroup(g)
                            }}
                          >
                            Ad
                          </button>
                          <button
                            type="button"
                            title="Boş qrupu sil"
                            className={[
                              'h-9 px-2.5 rounded-xl border text-xs font-semibold transition-colors',
                              'border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300',
                            ].join(' ')}
                            onClick={(e) => {
                              e.stopPropagation()
                              promptDeleteGroup(g)
                            }}
                          >
                            Sil
                          </button>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        className={[
                          'w-9 h-9 rounded-xl border flex items-center justify-center transition-transform duration-200',
                          'border-[color:var(--border-subtle)] bg-token-surfaceCard/35 hover:bg-token-surfaceCard/60',
                          isOpen ? 'rotate-180' : 'rotate-0',
                        ].join(' ')}
                        aria-label={isOpen ? 'Qrupu bağla' : 'Qrupu aç'}
                        onClick={toggleGroup}
                      >
                        <span className="text-token-textMain/80">⌄</span>
                      </button>
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div
                    className={[
                      'p-2.5 sm:p-3 bg-token-surfaceMain/40',
                      g.students.length ? STUDENT_LIST_GRID : '',
                    ].join(' ')}
                    onDragOver={(e) => handleGroupDragOver(e, g)}
                    onDrop={(e) => handleGroupDrop(e, g)}
                  >
                    {g.students.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-token-surfaceCard/25 px-4 py-5 text-center space-y-2">
                        <p className="text-sm text-token-textMuted">
                          Bu qrupda hələ tələbə yoxdur.
                        </p>
                        {canManageEmptyGroup(g) ? (
                          <p className="text-xs text-token-textMuted/90">
                            Başqa qrupdan tələbəni buraya sürükləyib buraxa, qrup adını dəyişə və ya qrupu silə bilərsiniz.
                          </p>
                        ) : (
                          <p className="text-xs text-token-textMuted/90">
                            Başqa qrupdan tələbəni buraya sürükləyib buraxa bilərsiniz.
                          </p>
                        )}
                      </div>
                    ) : null}
                    {g.students.map((s) => {
                      const p = lessonProgress(s)
                      const pay = paymentBadge(s)
                      const packLabel = packLabelForStudent(s)
                      const draggable = canDragStudent(s)
                      const isDragging = draggingStudentId === s.enrollment_id
                      return (
                        <div
                          key={s.enrollment_id}
                          draggable={draggable}
                          onDragStart={(e) => handleStudentDragStart(e, s)}
                          onDragEnd={handleStudentDragEnd}
                          className={[
                            'group',
                            STUDENT_ROW_GRID,
                            'rounded-xl px-3 py-2.5 mb-2 sm:mb-0',
                            'border border-[color:var(--border-subtle)]',
                            'bg-token-surfaceCard/40 hover:bg-token-surfaceCard/55',
                            'transition-[background-color,transform,border-color,opacity,box-shadow] duration-200',
                            'hover:-translate-y-[1px] hover:border-primary/15',
                            draggable ? 'cursor-grab active:cursor-grabbing' : '',
                            isDragging ? 'opacity-45 scale-[0.98] shadow-inner' : '',
                          ].join(' ')}
                        >
                          {draggable ? (
                            <span
                              className="hidden sm:flex shrink-0 w-5 items-center justify-center text-token-textMuted/50 group-hover:text-primary/70 select-none"
                              aria-hidden
                              title="Başqa qrupa sürükləyin"
                            >
                              ⠿
                            </span>
                          ) : (
                            <span className="hidden sm:block w-5 shrink-0" aria-hidden />
                          )}
                          <div className="min-w-0 flex items-center gap-3 col-start-1 sm:col-start-2 row-start-1">
                            <div
                              className={[
                                'w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-xs font-extrabold',
                                'bg-token-surfaceCard/55 border border-[color:var(--border-subtle)]',
                                'text-token-textMain',
                              ].join(' ')}
                              title={s.full_name}
                            >
                              {initials(s.full_name)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-token-textMain truncate flex items-center gap-2">
                                <PresenceDot user={s} />
                                {s.full_name}
                                {isPendingApproval(s) && (
                                  <StatusBadge variant="pending" className="text-[10px]">
                                    Sorğu gözləyir
                                  </StatusBadge>
                                )}
                                {needsSetup(s) && (
                                  <StatusBadge variant="due" className="text-[10px]">
                                    Quraşdırma lazım
                                  </StatusBadge>
                                )}
                              </div>
                              <div className="text-xs text-token-textMuted flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                {s.phone && <span className="break-all">{s.phone}</span>}
                                {lessonDaysShort(s.lesson_weekdays) ? (
                                  <span className="w-full sm:w-auto">Dərslər: {lessonDaysShort(s.lesson_weekdays)}</span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 sm:contents">
                            <div className="sm:col-start-3 flex justify-center shrink-0">
                              <StudentDirectChatButton
                                active={directChatActive}
                                locked={!directChatActive}
                                disabled={blocked}
                                onClick={() => openDirectChat(s)}
                                title={
                                  blocked
                                    ? 'Çat deaktivdir'
                                    : directChatActive
                                      ? `${s.full_name || 'Tələbə'} ilə fərdi çat`
                                      : 'Fərdi çat — paket tələb olunur'
                                }
                              />
                            </div>

                            <div className="hidden sm:flex sm:col-start-4 flex-col justify-center min-h-[1.625rem]">
                              {p ? (
                                <>
                                  <div className="h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                                    <div
                                      className="h-full bg-primary/70 transition-[width] duration-300"
                                      style={{ width: `${p.pct}%` }}
                                    />
                                  </div>
                                  <div className="mt-1 text-[11px] text-token-textMuted text-right tabular-nums">
                                    {`${p.pct}% (${p.used}/${p.total})`}
                                  </div>
                                </>
                              ) : null}
                            </div>

                            <div className="hidden sm:flex sm:col-start-5 items-center justify-center">
                              <StatusBadge variant={pay.variant}>{pay.label}</StatusBadge>
                            </div>

                            <div className="hidden sm:flex sm:col-start-6 items-center justify-center">
                              {packLabel ? (
                                <StatusBadge variant="neutral">{packLabel}</StatusBadge>
                              ) : (
                                <span className="invisible pointer-events-none" aria-hidden>
                                  <StatusBadge variant="neutral">8 dərs</StatusBadge>
                                </span>
                              )}
                            </div>

                            <div className="relative sm:col-start-7 w-9 shrink-0 justify-self-center">
                              <button
                                type="button"
                                className={[
                                  'w-9 h-9 rounded-xl border flex items-center justify-center',
                                  'border-[color:var(--border-subtle)] bg-token-surfaceCard/35 hover:bg-token-surfaceCard/60',
                                  'text-token-textMain/80',
                                ].join(' ')}
                                aria-label="Actions"
                                ref={(el) => {
                                  const k = String(s.enrollment_id)
                                  if (!k) return
                                  if (el) actionAnchorsRef.current.set(k, el)
                                  else actionAnchorsRef.current.delete(k)
                                }}
                                onClick={() =>
                                  setActionMenuId((prev) =>
                                    String(prev) === String(s.enrollment_id) ? null : s.enrollment_id
                                  )
                                }
                              >
                                ⋯
                              </button>

                              <PortalMenu
                                open={String(actionMenuId) === String(s.enrollment_id)}
                                onClose={closeStudentMenu}
                                anchorRef={{ current: actionAnchorsRef.current.get(String(s.enrollment_id)) }}
                                align="end"
                                width={176}
                              >
                                <div className="py-1">
                                  {needsSetup(s) && (
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/10 font-semibold"
                                      onClick={() => openCompleteSetup(s)}
                                    >
                                      Quraşdırmanı tamamla
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                                    onClick={() => {
                                      closeStudentMenu()
                                      openEdit(s)
                                    }}
                                  >
                                    Redaktə
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                                    onClick={() => {
                                      closeStudentMenu()
                                      openLessonsModal(s)
                                    }}
                                  >
                                    Dərslər
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
                                    onClick={() => {
                                      closeStudentMenu()
                                      openRestoreModal(s)
                                    }}
                                  >
                                    Köhnə ödənişlər
                                  </button>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm text-red-200 hover:bg-red-500/10"
                                    onClick={() => {
                                      closeStudentMenu()
                                      openDeleteConfirm(s)
                                    }}
                                  >
                                    Sil
                                  </button>
                                </div>
                              </PortalMenu>
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
        {!listLoading && !listError && !students.length && (
          <div className="text-center py-16 text-token-textMuted">
            <p className="text-lg mb-2 text-token-textMain">Tələbə yoxdur</p>
            <p className="text-sm">Yuxarıdan tələbə əlavə edin</p>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(setupFieldErrors?.length)}
        onClose={() => setSetupFieldErrors(null)}
        title="Tələb olunan sahələr"
        size="sm"
        zIndex={10200}
        footer={
          <div className="flex justify-center">
            <Button type="button" className="min-w-[120px] justify-center" onClick={() => setSetupFieldErrors(null)}>
              Tamam
            </Button>
          </div>
        }
      >
        <p className="text-sm text-center text-zinc-300 mb-3 leading-relaxed">
          Zəhmət olmasa quraşdırma formasında aşağıdakı sahələri doldurun:
        </p>
        <ul className="text-sm text-amber-200/95 space-y-1.5 list-disc pl-5">
          {setupFieldErrors?.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={setupModal}
        onClose={() => {
          if (loading) return
          setSetupModal(false)
          setSetupEnrollmentId(null)
        }}
        title="Quraşdırmanı tamamla"
        size="lg"
        scrollBody
        footer={
          <div className="flex gap-3">
            <Button onClick={saveCompleteSetup} loading={loading} className="flex-1 justify-center">
              Tamamla və aktiv et
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSetupModal(false)
                setSetupEnrollmentId(null)
              }}
              disabled={loading}
              className="flex-1 justify-center"
            >
              Legv et
            </Button>
          </div>
        }
      >
        <div
          className="min-h-[min(52vh,28rem)] [overflow-anchor:none]"
          onFocusCapture={focusFieldNearest}
        >
          <p className="text-xs text-gray-400 mb-4">
            Tələbə qoşulub, lakin qeydiyyat tam deyil. Paket, cədvəl, ödəniş və{' '}
            <strong className="text-gray-300">mobil telefon</strong> mütləqdir — sonra aktiv tələbə olacaq.
          </p>
          <StudentFormFields
            data={setupForm}
            setData={setSetupForm}
            mode="setup"
            toast={toast}
            teachingSubjects={teachingSubjects}
            referralSources={referralSources}
            onCreateSubject={createTeachingSubject}
            onCreateGroup={createTeachingGroup}
            lockStudentPhone={setupPhoneLocked}
            onSendProfileCompletionEmail={sendSetupProfileCompletionEmail}
            sendProfileEmailBusy={sendProfileEmailBusy}
          />
        </div>
      </Modal>

      <Modal
        open={editModal}
        onClose={() => {
          if (loading) return
          setEditModal(false)
          setEditStudentId(null)
        }}
        title="Tələbəni redaktə et"
        size="lg"
        scrollBody
        footer={
          <div className="flex gap-3">
            <Button onClick={saveEdit} loading={loading} className="flex-1 justify-center">
              Yadda saxla
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditModal(false)
                setEditStudentId(null)
              }}
              disabled={loading}
              className="flex-1 justify-center"
            >
              Ləğv et
            </Button>
          </div>
        }
      >
        <div
          className="min-h-[min(52vh,28rem)] [overflow-anchor:none]"
          onFocusCapture={focusFieldNearest}
        >
          <StudentFormFields
            data={editForm}
            setData={setEditForm}
            mode="edit"
            toast={toast}
            teachingSubjects={teachingSubjects}
            referralSources={referralSources}
            onCreateSubject={createTeachingSubject}
            onCreateGroup={createTeachingGroup}
          />
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

      <Modal
        open={Boolean(deleteConfirm)}
        onClose={() => !deleteBusy && setDeleteConfirm(null)}
        title="Tələbəni sil"
        size="sm"
        zIndex={400}
      >
        {deleteConfirm ? (
          <div className="space-y-5 text-sm">
            <p className="text-gray-300 leading-relaxed text-center px-1">
              <span className="font-semibold text-white">{deleteConfirm.studentName}</span> adlı tələbəni silmək
              istədiyinizdən əminsiniz?
            </p>
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Bu əməliyyat geri qaytarıla bilməz. Tələbə siyahıdan çıxacaq; qeydə alınmış nağd ödənişlər aylıq və illik
              hesabatda qalacaq.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-center pt-1">
              <Button
                type="button"
                variant="secondary"
                className="sm:min-w-[7.5rem] justify-center"
                disabled={deleteBusy}
                onClick={() => setDeleteConfirm(null)}
              >
                Ləğv et
              </Button>
              <Button
                type="button"
                variant="danger"
                className="sm:min-w-[7.5rem] justify-center"
                loading={deleteBusy}
                onClick={() => void confirmDeleteStudent()}
              >
                Sil
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(restoreModal)}
        onClose={() => setRestoreModal(null)}
        title={restoreModal ? `${restoreModal.studentName} — köhnə ödənişlər` : 'Köhnə ödənişlər'}
        size="sm"
      >
        {restoreModal?.loading ? (
          <ListSkeleton message="Hesablanır…" />
        ) : restoreModal?.error ? (
          <p className="text-sm text-amber-200/90">{restoreModal.error}</p>
        ) : !restoreModal?.items?.length ? (
          <p className="text-sm text-gray-500">Bərpa ediləcək köhnə dövr tapılmadı.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Aşağıdakı dövrləri seçin. Təsdiqləyərkən sistem onları tarixçəyə “completed” kimi əlavə edəcək.
            </p>
            <ul className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
              {restoreModal.items.map((it) => {
                const checked = restoreModal.selected?.has(it.id)
                return (
                  <li
                    key={it.id}
                    className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/80 px-3 py-2 text-sm text-gray-200"
                  >
                    <label className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-blue-500"
                          checked={Boolean(checked)}
                          onChange={(e) =>
                            setRestoreModal((prev) => {
                              if (!prev) return prev
                              const nextSel = new Set(prev.selected || [])
                              if (e.target.checked) nextSel.add(it.id)
                              else nextSel.delete(it.id)
                              return { ...prev, selected: nextSel }
                            })
                          }
                        />
                        <span className="truncate">{it.title}</span>
                      </div>
                      <span className="font-mono text-emerald-300 tabular-nums shrink-0">
                        {Number.isFinite(Number(it.amount)) ? `${Number(it.amount).toFixed(2)} ₼` : '—'}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <Button
              type="button"
              onClick={confirmRestore}
              loading={restoreModal.loading}
              className="w-full justify-center mt-3"
            >
              Seçilənləri təsdiqlə
            </Button>
          </div>
        )}
      </Modal>

      <StudentGroupTransferModal
        open={Boolean(transferModal)}
        onClose={() => setTransferModal(null)}
        transfer={transferModal}
        onSuccess={handleTransferSuccess}
        theme={theme}
      />

      <Modal
        open={Boolean(groupRenameModal)}
        onClose={() => !groupRenameBusy && setGroupRenameModal(null)}
        title="Qrup adını dəyiş"
        size="sm"
        zIndex={400}
        footer={
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end w-full">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setGroupRenameModal(null)}
              disabled={groupRenameBusy}
            >
              Ləğv et
            </Button>
            <Button type="button" onClick={() => void saveGroupRename()} loading={groupRenameBusy}>
              Yadda saxla
            </Button>
          </div>
        }
      >
        {groupRenameModal ? (
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Qrup adı
            </label>
            <input
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary border border-white/10 bg-white/[0.03] text-white"
              value={groupRenameModal.groupName}
              onChange={(e) =>
                setGroupRenameModal((prev) => (prev ? { ...prev, groupName: e.target.value } : prev))
              }
              placeholder="məs. DataAnalitika2"
              autoFocus
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(emptyGroupPrompt)}
        onClose={() => !emptyGroupDeleteBusy && setEmptyGroupPrompt(null)}
        title="Boş qrup"
        size="sm"
        zIndex={400}
      >
        {emptyGroupPrompt ? (
          <div className="space-y-5 text-sm">
            <p className="text-gray-300 leading-relaxed">
              <span className="font-semibold text-white">«{emptyGroupPrompt.groupName}»</span> qrupunda artıq
              tələbə qalmayıb. Bu qrupu silmək istəyirsiniz?
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Qrup silinərsə, dəvət linki və qrup paket şablonu da silinir. Tələbənin köçürüldüyü qrup və ödəniş
              tarixçəsi dəyişməz qalır.
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
              <Button
                type="button"
                variant="secondary"
                className="sm:min-w-[7.5rem] justify-center"
                disabled={emptyGroupDeleteBusy}
                onClick={() => setEmptyGroupPrompt(null)}
              >
                Saxla
              </Button>
              <Button
                type="button"
                variant="danger"
                className="sm:min-w-[7.5rem] justify-center"
                loading={emptyGroupDeleteBusy}
                onClick={() => void confirmDeleteEmptyGroup()}
              >
                Qrupu sil
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <DirectChatUpgradeModal
        open={Boolean(directChatUpgrade)}
        onClose={() => setDirectChatUpgrade(null)}
        studentName={directChatUpgrade?.studentName}
      />
    </div>
  )
}
