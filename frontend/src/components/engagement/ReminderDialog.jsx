import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../common/Button'
import ActivityDialog from './ActivityDialog'
import { StatusBadge } from './EngagementParts'
import { previewEngagementReminder, sendEngagementReminder } from './engagementApi'
import { statusMeta } from '../../lib/activityCards'
import { formatDateTime } from '../../lib/formatDateTime'

const STEPS = ['select', 'confirm', 'result']

function StepIndicator({ step }) {
  const { t } = useTranslation()
  const labels = { select: t('activity.reminder.stepSelect'), confirm: t('activity.reminder.stepConfirm'), result: t('activity.reminder.stepResult') }
  return (
    <ol className="mb-4 flex flex-wrap gap-2 text-[11px] font-semibold">
      {STEPS.map((s) => (
        <li
          key={s}
          aria-current={s === step ? 'step' : undefined}
          className={`rounded-lg border px-2 py-0.5 ${
            s === step ? 'border-primary bg-primary/15 text-token-textMain' : 'border-[color:var(--border-subtle)] text-token-textMuted'
          }`}
        >
          {labels[s]}
        </li>
      ))}
    </ol>
  )
}

/**
 * Əl ilə xatırlatma: 1) alıcıları seç (önizləmə serverdən: uyğunluq, son 6 saat) → 2) təsdiq (say, siyahı, mesaj) → 3) nəticə.
 * Göndərmə yalnız 2-ci addımdakı düymə ilə olur; server tərəfi kilid + soyuma ilə təkrar göndərməni bloklayır.
 *
 * candidateIds: null — bütün uyğun tələbələr; massiv — yalnız bu tələbələr (hesabatda seçilənlər).
 */
export default function ReminderDialog({ open, type, entityId, entityTitle, candidateIds = null, onClose, onSent }) {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState('select')
  const [preview, setPreview] = useState({ loading: false, error: '', data: null })
  const [chosen, setChosen] = useState(() => new Set())
  const [confirmPreview, setConfirmPreview] = useState({ loading: false, error: '', data: null })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [sendError, setSendError] = useState('')
  const sentOnce = useRef(false)
  const candidatesRef = useRef(candidateIds)

  const loadPreview = useCallback(async () => {
    setPreview({ loading: true, error: '', data: null })
    try {
      const data = await previewEngagementReminder(type, entityId, candidatesRef.current)
      setPreview({ loading: false, error: '', data })
      setChosen(new Set((data?.recipients || []).map((r) => r.student_id)))
    } catch (e) {
      setPreview({ loading: false, error: e?.message || t('activity.reminder.previewError'), data: null })
    }
  }, [type, entityId, t])

  useEffect(() => {
    if (!open) return
    candidatesRef.current = candidateIds
    setStep('select')
    setResult(null)
    setSendError('')
    setConfirmPreview({ loading: false, error: '', data: null })
    sentOnce.current = false
    void loadPreview()
  }, [open, loadPreview])

  const recipients = preview.data?.recipients || []
  const recently = preview.data?.recently_reminded || []
  const notEligible = preview.data?.not_eligible || []
  const chosenIds = recipients.filter((r) => chosen.has(r.student_id)).map((r) => r.student_id)

  const toConfirm = async () => {
    setStep('confirm')
    setConfirmPreview({ loading: true, error: '', data: null })
    try {
      const data = await previewEngagementReminder(type, entityId, chosenIds)
      setConfirmPreview({ loading: false, error: '', data })
    } catch (e) {
      setConfirmPreview({ loading: false, error: e?.message || t('activity.reminder.previewError'), data: null })
    }
  }

  const finalRecipients = confirmPreview.data?.recipients || []

  const send = async () => {
    if (sending || sentOnce.current || !finalRecipients.length) return
    sentOnce.current = true
    setSending(true)
    setSendError('')
    try {
      const r = await sendEngagementReminder(type, entityId, finalRecipients.map((x) => x.student_id))
      setResult(r || {})
      setStep('result')
      onSent?.(r)
    } catch (e) {
      sentOnce.current = false
      setSendError(e?.message || t('activity.reminder.error'))
    } finally {
      setSending(false)
    }
  }

  const toggle = (sid) =>
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })

  const langName = (l) => t(`activity.reminder.languages.${l}`, l)
  const time = (iso) => formatDateTime(iso, i18n.language)

  let body = null
  let footer = null

  if (step === 'select') {
    body = preview.loading ? (
      <p role="status" className="text-sm text-token-textMuted">
        {t('activity.reminder.checking')}
      </p>
    ) : preview.error ? (
      <div className="space-y-3">
        <p className="text-sm text-red-700 [.theme-dark_&]:text-red-300">{preview.error}</p>
        <Button size="sm" variant="secondary" onClick={() => void loadPreview()}>
          {t('activity.common.retry')}
        </Button>
      </div>
    ) : (
      <div className="space-y-4">
        <p className="text-xs text-token-textMuted">{t('activity.reminder.manualOnly')}</p>
        {preview.data?.closed ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 [.theme-dark_&]:text-amber-300">
            {t('activity.reminder.closedNote')}
          </p>
        ) : null}
        {recipients.length ? (
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">{t('activity.reminder.selectHint')}</legend>
            <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-token-textMuted">
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={chosenIds.length === recipients.length}
                onChange={() =>
                  setChosen(chosenIds.length === recipients.length ? new Set() : new Set(recipients.map((r) => r.student_id)))
                }
              />
              {t('activity.reminder.allEligible')} ({recipients.length})
            </label>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[color:var(--border-subtle)] p-2">
              {recipients.map((r) => (
                <li key={r.student_id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-blue-500" checked={chosen.has(r.student_id)} onChange={() => toggle(r.student_id)} />
                    <span className="min-w-0 flex-1 truncate">{r.full_name}</span>
                    <StatusBadge meta={statusMeta(type, r)} />
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : (
          <p className="text-sm text-token-textMuted">{t('activity.reminder.noRecipients')}</p>
        )}
        {recently.length ? (
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-token-textMuted">
              {t('activity.reminder.recentlyTitle', { hours: preview.data?.cooldown_hours ?? 6 })} ({recently.length})
            </p>
            <ul className="space-y-0.5 text-sm text-token-textMuted">
              {recently.map((r) => (
                <li key={r.student_id} className="flex justify-between gap-2">
                  <span className="truncate">{r.full_name}</span>
                  <span className="shrink-0 text-[11px]">{t('activity.reminder.nextAllowed', { time: time(r.next_allowed_at) })}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {notEligible.length ? (
          <p className="text-xs text-token-textMuted">
            {t('activity.reminder.notEligibleTitle')}: {notEligible.length}
          </p>
        ) : null}
      </div>
    )
    footer = (
      <>
        <Button size="sm" variant="ghost" onClick={onClose}>
          {t('activity.reminder.cancel')}
        </Button>
        <Button size="sm" disabled={!chosenIds.length || preview.loading} onClick={() => void toConfirm()}>
          {t('activity.reminder.next')}
        </Button>
      </>
    )
  } else if (step === 'confirm') {
    const messages = confirmPreview.data?.messages || []
    body = confirmPreview.loading ? (
      <p role="status" className="text-sm text-token-textMuted">
        {t('activity.reminder.checking')}
      </p>
    ) : confirmPreview.error ? (
      <p className="text-sm text-red-700 [.theme-dark_&]:text-red-300">{confirmPreview.error}</p>
    ) : (
      <div className="space-y-4">
        <p className="text-base font-bold">{t('activity.reminder.recipientsCount', { count: finalRecipients.length })}</p>
        {confirmPreview.data?.recently_reminded?.length ? (
          <p className="text-xs text-amber-800 [.theme-dark_&]:text-amber-300">
            {t('activity.reminder.skipped', { count: confirmPreview.data.recently_reminded.length })}
          </p>
        ) : null}
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-token-textMuted">{t('activity.reminder.recipientsTitle')}</p>
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-[color:var(--border-subtle)] p-2 text-sm">
            {finalRecipients.map((r) => (
              <li key={r.student_id} className="truncate">
                {r.full_name}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-token-textMuted">{t('activity.reminder.previewTitle')}</p>
          <div className="space-y-2">
            {messages
              .filter((m) => m.count > 0)
              .map((m) => (
                <figure key={m.locale} className="rounded-xl border border-[color:var(--border-subtle)] bg-black/[0.03] [.theme-dark_&]:bg-white/[0.04] p-3">
                  <figcaption className="mb-1 text-[11px] text-token-textMuted">
                    {t('activity.reminder.previewLang', { lang: langName(m.locale), count: m.count })}
                  </figcaption>
                  <p className="text-sm font-semibold break-words">{m.title}</p>
                  <p className="text-sm break-words">{m.body}</p>
                </figure>
              ))}
          </div>
        </div>
        {sendError ? (
          <p role="alert" className="text-sm text-red-700 [.theme-dark_&]:text-red-300">
            {sendError}
          </p>
        ) : null}
      </div>
    )
    footer = (
      <>
        <Button size="sm" variant="ghost" disabled={sending} onClick={() => setStep('select')}>
          {t('activity.reminder.back')}
        </Button>
        <Button
          size="sm"
          loading={sending}
          disabled={sending || confirmPreview.loading || !finalRecipients.length}
          onClick={() => void send()}
        >
          {sending ? t('activity.reminder.sending') : t('activity.reminder.confirm', { count: finalRecipients.length })}
        </Button>
      </>
    )
  } else {
    const r = result || {}
    const lines = [
      r.sent ? { key: 'sent', text: t('activity.reminder.sent', { count: r.sent }), tone: 'text-emerald-700 [.theme-dark_&]:text-emerald-300', icon: '✓' } : null,
      r.failed ? { key: 'failed', text: t('activity.reminder.failed', { count: r.failed }), tone: 'text-red-700 [.theme-dark_&]:text-red-300', icon: '!' } : null,
      r.skipped_recent
        ? { key: 'skipped', text: t('activity.reminder.skipped', { count: r.skipped_recent }), tone: 'text-amber-800 [.theme-dark_&]:text-amber-300', icon: '⏳' }
        : null,
      r.not_eligible ? { key: 'ne', text: t('activity.reminder.notEligible', { count: r.not_eligible }), tone: 'text-token-textMuted', icon: '–' } : null,
    ].filter(Boolean)
    body = (
      <div role="status" className="space-y-2">
        {lines.length ? (
          lines.map((l) => (
            <p key={l.key} className={`text-sm font-semibold ${l.tone}`}>
              <span aria-hidden="true">{l.icon} </span>
              {l.text}
            </p>
          ))
        ) : (
          <p className="text-sm text-token-textMuted">{t('activity.reminder.nothingSent')}</p>
        )}
      </div>
    )
    footer = (
      <Button size="sm" onClick={onClose}>
        {t('activity.reminder.done')}
      </Button>
    )
  }

  return (
    <ActivityDialog
      open={open}
      title={`${t('activity.reminder.title')}${entityTitle ? ` — ${entityTitle}` : ''}`}
      onClose={onClose}
      busy={sending}
      footer={footer}
    >
      <StepIndicator step={step} />
      {body}
    </ActivityDialog>
  )
}
