import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import LibraryMaterialPickerModal from '../instructor/LibraryMaterialPickerModal'
import PlatformIcon from './PlatformIcon'
import api from '../../lib/api'
import { detectPlatform, validateResourceLink } from '../../lib/meetingUrl'
import {
  MAX_MATERIALS,
  RECURRENCE_TYPES,
  REMINDER_OFFSETS,
  WEEKDAYS,
  buildLessonPayload,
  emptyLessonForm,
  lessonErrorFields,
  lessonToForm,
  validateLessonForm,
} from '../../lib/liveLessons'

const INPUT =
  'w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm text-token-textMain outline-none focus:border-primary/50'
const PLATFORMS = ['google_meet', 'zoom', 'other']
const URL_PLACEHOLDER = {
  google_meet: 'https://meet.google.com/abc-defg-hij',
  zoom: 'https://us02web.zoom.us/j/1234567890',
  other: 'https://…',
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs text-red-500">
      {message}
    </p>
  )
}

/**
 * Create / edit a live lesson held on the teacher's own Google Meet, Zoom or other HTTPS link.
 * `initialGroupId` preselects a group (e.g. when opened from Teaching groups).
 */
export default function LiveLessonFormModal({ open, onClose, onSaved, lesson = null, initialGroupId = '' }) {
  const { t } = useTranslation()
  const toast = useToast()
  const isEdit = Boolean(lesson)
  const [form, setForm] = useState(() => emptyLessonForm())
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [groups, setGroups] = useState([])
  const [students, setStudents] = useState([])
  const [connections, setConnections] = useState(null)
  const [scope, setScope] = useState('single')
  const [newLink, setNewLink] = useState({ title: '', url: '' })
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setScope('single')
    setNewLink({ title: '', url: '' })
    setForm(isEdit ? lessonToForm(lesson) : { ...emptyLessonForm(), group_id: initialGroupId || '' })
    if (isEdit) return
    let alive = true
    Promise.all([
      api.get('/tasks/groups').catch(() => ({ groups: [] })),
      api.get('/students').catch(() => ({ students: [] })),
      api.get('/teacher-connections').catch(() => ({ connections: null })),
    ]).then(([g, s, c]) => {
      if (!alive) return
      setGroups(Array.isArray(g.groups) ? g.groups : [])
      const seen = new Set()
      setStudents(
        (Array.isArray(s.students) ? s.students : []).filter((st) => st?.id && !seen.has(st.id) && seen.add(st.id)),
      )
      setConnections(c.connections || null)
    })
    return () => {
      alive = false
    }
  }, [open, isEdit, lesson, initialGroupId])

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }
  const setRecurrence = (patch) => setForm((f) => ({ ...f, recurrence: { ...f.recurrence, ...patch } }))

  const connected = useMemo(() => {
    const c = connections?.[form.platform]
    return c?.connected ? c : null
  }, [connections, form.platform])

  useEffect(() => {
    if (!connected && form.link_mode === 'oauth') setForm((f) => ({ ...f, link_mode: 'manual' }))
  }, [connected, form.link_mode])

  const onUrlChange = (value) => {
    set('meeting_url', value)
    const guess = detectPlatform(value)
    if ((guess === 'google_meet' || guess === 'zoom') && guess !== form.platform) set('platform', guess)
  }

  const addLink = () => {
    const v = validateResourceLink(newLink.url)
    if (!v.ok) {
      setErrors((e) => ({ ...e, materials: v.error }))
      return
    }
    if (form.materials.length >= MAX_MATERIALS) return
    set('materials', [...form.materials, { type: 'link', title: newLink.title.trim(), url: v.url }])
    setNewLink({ title: '', url: '' })
  }

  const submit = async (e) => {
    e?.preventDefault?.()
    const clientErrors = validateLessonForm(form, { isEdit })
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }
    setSaving(true)
    try {
      const body = buildLessonPayload(form, { isEdit })
      const res = isEdit
        ? await api.patch(`/live-lessons/${encodeURIComponent(lesson.id)}`, { ...body, scope })
        : await api.post('/live-lessons', body)
      const count = Array.isArray(res.occurrences) ? res.occurrences.length : 1
      toast(isEdit ? t('liveLessons.updated') : count > 1 ? t('liveLessons.createdSeries', { n: count }) : t('liveLessons.created'))
      onSaved?.(res)
      onClose?.()
    } catch (err) {
      const { message, fields } = lessonErrorFields(err)
      if (err?.code === 'NEEDS_CONNECTION') fields.meeting_url = message
      setErrors(fields)
      toast(message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
        {t('common.cancel')}
      </Button>
      <Button type="submit" form="live-lesson-form" loading={saving}>
        {isEdit ? t('liveLessons.save') : t('liveLessons.create')}
      </Button>
    </div>
  )

  const r = form.recurrence

  return (
    <>
      <Modal
        open={open}
        onClose={() => !saving && onClose?.()}
        title={isEdit ? t('liveLessons.editTitle') : t('liveLessons.createTitle')}
        size="lg"
        scrollBody
        footer={footer}
        closeLabel={t('common.close')}
      >
        <form id="live-lesson-form" className="space-y-5" onSubmit={submit} noValidate>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.title')} *</span>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={255}
              placeholder={t('liveLessons.fields.titlePlaceholder')}
              aria-invalid={Boolean(errors.title)}
              aria-describedby="ll-title-err"
              className={INPUT}
            />
            <FieldError id="ll-title-err" message={errors.title} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.description')}</span>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              maxLength={5000}
              className={INPUT}
            />
          </label>

          {!isEdit ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.target')} *</legend>
              <div className="flex gap-2" role="radiogroup">
                {['group', 'student'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={form.target === k}
                    onClick={() => set('target', k)}
                    className={`rounded-xl border px-3 py-1.5 text-sm ${
                      form.target === k
                        ? 'border-primary/60 bg-primary/10 text-token-textMain'
                        : 'border-[color:var(--border-subtle)] text-token-textMuted hover:text-token-textMain'
                    }`}
                  >
                    {t(`liveLessons.fields.target_${k}`)}
                  </button>
                ))}
              </div>
              {form.target === 'group' ? (
                <select
                  value={form.group_id}
                  onChange={(e) => set('group_id', e.target.value)}
                  aria-label={t('liveLessons.fields.target_group')}
                  aria-invalid={Boolean(errors.target)}
                  className={INPUT}
                >
                  <option value="">{t('liveLessons.fields.pickGroup')}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.subject_name ? `${g.subject_name} · ${g.name}` : g.name}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={form.student_id}
                  onChange={(e) => set('student_id', e.target.value)}
                  aria-label={t('liveLessons.fields.target_student')}
                  aria-invalid={Boolean(errors.target)}
                  className={INPUT}
                >
                  <option value="">{t('liveLessons.fields.pickStudent')}</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email || s.id}
                    </option>
                  ))}
                </select>
              )}
              <FieldError message={errors.target} />
            </fieldset>
          ) : (
            <p className="text-sm text-token-textMuted">
              {lesson.group_name || lesson.student_name ? `${t('liveLessons.fields.target')}: ${lesson.group_name || lesson.student_name}` : null}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.date')} *</span>
              <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={INPUT} aria-invalid={Boolean(errors.starts_at)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.startTime')} *</span>
              <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} className={INPUT} aria-invalid={Boolean(errors.starts_at)} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.endTime')} *</span>
              <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} className={INPUT} aria-invalid={Boolean(errors.ends_at)} />
            </label>
          </div>
          <p className="-mt-3 text-[11px] text-token-textMuted">{t('liveLessons.fields.bakuTime')}</p>
          <FieldError message={errors.starts_at || errors.ends_at} />

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.platform')} *</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={form.platform === p}
                  onClick={() => set('platform', p)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm ${
                    form.platform === p
                      ? 'border-primary/60 bg-primary/10 text-token-textMain'
                      : 'border-[color:var(--border-subtle)] text-token-textMuted hover:text-token-textMain'
                  }`}
                >
                  <PlatformIcon platform={p} className="h-7 w-7" />
                  {t(`liveLessons.platforms.${p}`)}
                </button>
              ))}
            </div>
          </fieldset>

          {!isEdit && connected ? (
            <div className="space-y-1.5 rounded-xl border border-[color:var(--border-subtle)] p-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="ll-link-mode" checked={form.link_mode === 'manual'} onChange={() => set('link_mode', 'manual')} />
                {t('liveLessons.fields.linkManual')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="ll-link-mode" checked={form.link_mode === 'oauth'} onChange={() => set('link_mode', 'oauth')} />
                {t('liveLessons.fields.linkOauth', { email: connected.account_email || t(`liveLessons.platforms.${form.platform}`) })}
              </label>
            </div>
          ) : null}

          {form.link_mode !== 'oauth' ? (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.meetingUrl')} *</span>
              <input
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={form.meeting_url}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder={URL_PLACEHOLDER[form.platform]}
                maxLength={500}
                aria-invalid={Boolean(errors.meeting_url)}
                aria-describedby="ll-url-hint ll-url-err"
                className={INPUT}
              />
              <span id="ll-url-hint" className="block text-[11px] text-token-textMuted">
                {t('liveLessons.fields.meetingUrlHint')}
              </span>
              <FieldError id="ll-url-err" message={errors.meeting_url} />
            </label>
          ) : (
            <FieldError message={errors.meeting_url} />
          )}

          {!isEdit ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.recurrence')}</legend>
              <select value={r.type} onChange={(e) => setRecurrence({ type: e.target.value })} className={INPUT} aria-label={t('liveLessons.fields.recurrence')}>
                {RECURRENCE_TYPES.map((k) => (
                  <option key={k} value={k}>
                    {t(`liveLessons.recurrence.${k}`)}
                  </option>
                ))}
              </select>
              {r.type === 'custom' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAYS.map((d) => {
                      const on = (r.days || []).includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setRecurrence({ days: on ? r.days.filter((x) => x !== d) : [...(r.days || []), d] })}
                          className={`rounded-lg border px-2.5 py-1 text-xs ${
                            on ? 'border-primary/60 bg-primary/10 text-token-textMain' : 'border-[color:var(--border-subtle)] text-token-textMuted'
                          }`}
                        >
                          {t(`liveLessons.weekdays.${d}`)}
                        </button>
                      )
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-token-textMuted">
                    {t('liveLessons.recurrence.every')}
                    <select value={r.interval_weeks} onChange={(e) => setRecurrence({ interval_weeks: Number(e.target.value) })} className="rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceMain px-2 py-1 text-sm text-token-textMain">
                      {[1, 2, 3, 4].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    {t('liveLessons.recurrence.weeks')}
                  </label>
                </div>
              ) : null}
              {r.type !== 'none' ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-token-textMuted">{t('liveLessons.recurrence.count')}</span>
                    <input type="number" min={2} max={52} value={r.count} onChange={(e) => setRecurrence({ count: e.target.value, until: '' })} className={INPUT} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-token-textMuted">{t('liveLessons.recurrence.until')}</span>
                    <input type="date" value={r.until} onChange={(e) => setRecurrence({ until: e.target.value, count: '' })} className={INPUT} />
                  </label>
                  <p className="text-[11px] text-token-textMuted sm:col-span-2">{t('liveLessons.recurrence.hint')}</p>
                </div>
              ) : null}
              <FieldError message={errors.recurrence} />
            </fieldset>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.reminder')}</span>
              <select value={form.reminder_offset_minutes} onChange={(e) => set('reminder_offset_minutes', Number(e.target.value))} className={INPUT}>
                {REMINDER_OFFSETS.map((m) => (
                  <option key={m} value={m}>
                    {t(`liveLessons.reminders.${m}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-token-textMain">
              <input type="checkbox" checked={form.notify_email} onChange={(e) => set('notify_email', e.target.checked)} />
              {t('liveLessons.fields.notifyEmail')}
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-token-textMuted">{t('liveLessons.fields.materials')}</legend>
            {form.materials.length ? (
              <ul className="space-y-1.5">
                {form.materials.map((m, i) => (
                  <li key={`${m.material_id || m.url}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--border-subtle)] px-3 py-1.5 text-sm">
                    <span className="min-w-0 truncate text-token-textMain">{m.title || m.url}</span>
                    <button
                      type="button"
                      onClick={() => set('materials', form.materials.filter((_, j) => j !== i))}
                      className="text-xs text-token-textMuted hover:text-red-500"
                    >
                      {t('liveLessons.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {form.materials.length < MAX_MATERIALS ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={newLink.title} onChange={(e) => setNewLink((l) => ({ ...l, title: e.target.value }))} placeholder={t('liveLessons.fields.linkTitle')} className={`${INPUT} sm:w-1/3`} />
                <input type="url" value={newLink.url} onChange={(e) => setNewLink((l) => ({ ...l, url: e.target.value }))} placeholder="https://" className={INPUT} />
                <Button type="button" variant="secondary" onClick={addLink} disabled={!newLink.url.trim()}>
                  {t('liveLessons.add')}
                </Button>
              </div>
            ) : null}
            <button type="button" onClick={() => setLibraryOpen(true)} className="text-xs font-medium text-primary hover:underline">
              {t('liveLessons.fields.fromLibrary')}
            </button>
            <FieldError message={errors.materials} />
          </fieldset>

          {isEdit && lesson.series_id ? (
            <fieldset className="space-y-1.5 rounded-xl border border-[color:var(--border-subtle)] p-3 text-sm">
              <legend className="px-1 text-xs font-medium text-token-textMuted">{t('liveLessons.scope.title')}</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="ll-scope" checked={scope === 'single'} onChange={() => setScope('single')} />
                {t('liveLessons.scope.single')}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="ll-scope" checked={scope === 'following'} onChange={() => setScope('following')} />
                {t('liveLessons.scope.following')}
              </label>
            </fieldset>
          ) : null}

          <p className="text-[11px] text-token-textMuted">{t('liveLessons.privacyNote')}</p>
        </form>
      </Modal>
      <LibraryMaterialPickerModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        selectedIds={form.materials.filter((m) => m.material_id).map((m) => m.material_id)}
        onSelect={(m) => {
          if (form.materials.length >= MAX_MATERIALS) return
          set('materials', [...form.materials, { type: 'material', material_id: m.id, title: m.title }])
        }}
      />
    </>
  )
}
