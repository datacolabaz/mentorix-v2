import api from './api'
import { validateMeetingUrl } from './meetingUrl'

export const REMINDER_OFFSETS = [15, 30, 60, 1440]
export const DEFAULT_REMINDER = 60
export const RECURRENCE_TYPES = ['none', 'weekly', 'weekdays', 'custom']
export const ATTENDANCE_STATUSES = ['attended', 'absent', 'late', 'excused']
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]
export const MAX_MATERIALS = 10

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000

/** Instant → { date: 'YYYY-MM-DD', time: 'HH:MM' } in Asia/Baku (UTC+4, no DST). */
export function bakuParts(value) {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return { date: '', time: '' }
  const iso = new Date(d.getTime() + BAKU_OFFSET_MS).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

export function emptyLessonForm(now = Date.now()) {
  const start = new Date(Math.ceil((now + 60 * 60 * 1000) / (30 * 60 * 1000)) * 30 * 60 * 1000)
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const s = bakuParts(start)
  return {
    title: '',
    description: '',
    target: 'group',
    group_id: '',
    student_id: '',
    date: s.date,
    start_time: s.time,
    end_time: bakuParts(end).time,
    platform: 'google_meet',
    link_mode: 'manual',
    meeting_url: '',
    reminder_offset_minutes: DEFAULT_REMINDER,
    notify_email: true,
    materials: [],
    recurrence: { type: 'none', count: '', until: '', days: [], interval_weeks: 1 },
  }
}

export function lessonToForm(lesson) {
  const s = bakuParts(lesson.starts_at)
  const e = lesson.ends_at ? bakuParts(lesson.ends_at) : { time: '' }
  return {
    ...emptyLessonForm(),
    title: lesson.title || '',
    description: lesson.description || '',
    target: lesson.student_id ? 'student' : 'group',
    group_id: lesson.group_id || '',
    student_id: lesson.student_id || '',
    date: s.date,
    start_time: s.time,
    end_time: e.time,
    platform: ['google_meet', 'zoom'].includes(lesson.platform) ? lesson.platform : 'other',
    meeting_url: lesson.join_url || '',
    reminder_offset_minutes: lesson.reminder_offset_minutes ?? DEFAULT_REMINDER,
    notify_email: lesson.notify_email !== false,
    materials: (lesson.materials || []).map((m) =>
      m.type === 'material' ? { type: 'material', material_id: m.id, title: m.title || '' } : { type: 'link', title: m.title || '', url: m.url },
    ),
  }
}

/**
 * Instant field-level feedback before the request. The server repeats every check and is the source of truth.
 * @returns {Record<string,string>} field → Azerbaijani message
 */
export function validateLessonForm(form, { isEdit = false, now = Date.now() } = {}) {
  const errors = {}
  if (!String(form.title || '').trim()) errors.title = 'Dərsin adını yazın.'
  if (!isEdit) {
    if (form.target === 'group' && !form.group_id) errors.target = 'Qrup seçin.'
    if (form.target === 'student' && !form.student_id) errors.target = 'Tələbə seçin.'
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date || '') || !/^\d{2}:\d{2}$/.test(form.start_time || '')) {
    errors.starts_at = 'Tarix və başlama saatını düzgün daxil edin.'
  } else {
    const start = new Date(`${form.date}T${form.start_time}:00+04:00`).getTime()
    if (start < now - 10 * 60 * 1000) errors.starts_at = 'Keçmiş vaxta dərs planlamaq olmaz.'
    if (!/^\d{2}:\d{2}$/.test(form.end_time || '')) errors.ends_at = 'Bitmə saatını daxil edin.'
    else {
      const end = new Date(`${form.date}T${form.end_time}:00+04:00`).getTime()
      const minutes = (end - start) / 60000
      if (minutes <= 0) errors.ends_at = 'Bitmə saatı başlama saatından sonra olmalıdır.'
      else if (minutes < 5 || minutes > 600) errors.ends_at = 'Dərsin müddəti 5 dəqiqə ilə 10 saat arasında olmalıdır.'
    }
  }
  if (form.link_mode !== 'oauth') {
    const v = validateMeetingUrl(form.meeting_url, form.platform)
    if (!v.ok) errors.meeting_url = v.error
  }
  const r = form.recurrence || {}
  if (!isEdit && r.type === 'custom' && !(r.days || []).length) errors.recurrence = 'Ən azı bir həftə günü seçin.'
  if ((form.materials || []).length > MAX_MATERIALS) errors.materials = `Ən çoxu ${MAX_MATERIALS} material əlavə etmək olar.`
  return errors
}

export function buildLessonPayload(form, { isEdit = false } = {}) {
  const body = {
    title: String(form.title || '').trim(),
    description: String(form.description || '').trim(),
    date: form.date,
    start_time: form.start_time,
    end_time: form.end_time,
    platform: form.platform,
    reminder_offset_minutes: Number(form.reminder_offset_minutes),
    notify_email: Boolean(form.notify_email),
    materials: (form.materials || []).map((m) =>
      m.type === 'material' ? { material_id: m.material_id } : { title: String(m.title || '').trim(), url: String(m.url || '').trim() },
    ),
  }
  if (form.link_mode === 'oauth' && !isEdit) body.create_via = 'oauth'
  else body.meeting_url = String(form.meeting_url || '').trim()
  if (!isEdit) {
    if (form.target === 'student') body.student_id = form.student_id
    else body.group_id = form.group_id
    const r = form.recurrence || { type: 'none' }
    if (r.type && r.type !== 'none') {
      body.recurrence = { type: r.type }
      if (r.until) body.recurrence.until = r.until
      else if (r.count) body.recurrence.count = Number(r.count)
      if (r.type === 'custom') {
        body.recurrence.days = r.days
        body.recurrence.interval_weeks = Number(r.interval_weeks) || 1
      }
    }
  }
  return body
}

/** Server error → { message, fields } where fields maps form fields to messages. */
export function lessonErrorFields(err) {
  const fields = {}
  if (err?.details && typeof err.details === 'object') Object.assign(fields, err.details)
  else if (Array.isArray(err?.fields) && err.fields[0]) fields[err.fields[0]] = err.message
  return { message: err?.message || 'Xəta baş verdi.', fields }
}

export async function downloadLessonIcs(lesson) {
  const blob = await api.get(`/live-lessons/${encodeURIComponent(lesson.id)}/calendar.ics`, { responseType: 'blob' })
  const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `mentorix-${lesson.room_code || lesson.id}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
