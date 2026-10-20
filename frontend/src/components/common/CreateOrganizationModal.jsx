import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Modal from './Modal'
import Button from './Button'

export const ORG_TYPE_OPTIONS = [
  { id: 'education_center', label: 'Tədris mərkəzi' },
  { id: 'school', label: 'Məktəb' },
  { id: 'company', label: 'Şirkət' },
  { id: 'other', label: 'Digər' },
]

const fieldClass =
  'mt-1 w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm text-token-textMain focus:outline-none focus:ring-2 focus:ring-primary/30'

/**
 * «Təşkilat yarat»: sends a request only. The organization itself is created by a platform admin on approval
 * (POST /organization-requests/:id/approve) — nothing is granted from here.
 */
export default function CreateOrganizationModal({ open, onClose, onCreated, previous = null }) {
  const [name, setName] = useState('')
  const [orgType, setOrgType] = useState('education_center')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(previous?.name || '')
    setOrgType('education_center')
    setDescription('')
    setError('')
  }, [open, previous?.name])

  const trimmed = name.trim()
  const valid = trimmed.length >= 2 && trimmed.length <= 160

  const submit = async (e) => {
    e?.preventDefault?.()
    if (!valid || busy) return
    setBusy(true)
    setError('')
    try {
      const d = await api.post('/organization-requests', {
        name: trimmed,
        org_type: orgType,
        description: description.trim() || undefined,
      })
      onCreated?.(d?.request || null)
    } catch (err) {
      setError(err?.message || 'Sorğu göndərilmədi. Yenidən cəhd edin.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose?.()}
      title="Təşkilat yarat"
      size="sm"
      closeLabel="Bağla"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => onClose?.()}>
            Ləğv et
          </Button>
          <Button loading={busy} disabled={!valid} onClick={() => void submit()}>
            Sorğu göndər
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" data-testid="create-organization-form">
        <p className="text-sm text-token-textMuted leading-relaxed">
          Sorğunuzu platforma admini yoxlayır. Təsdiqdən sonra «Kabinetlərim» bölməsində təşkilat kabineti açılacaq. Mövcud
          kabinetləriniz dəyişmir.
        </p>
        {previous?.status === 'rejected' ? (
          <p className="rounded-xl bg-error-subtle px-3 py-2 text-xs text-error">
            Əvvəlki sorğu rədd edilib{previous.review_reason ? `: ${previous.review_reason}` : '.'}
          </p>
        ) : null}
        <label className="block text-sm font-medium text-token-textMain">
          Təşkilatın adı
          <input
            className={fieldClass}
            value={name}
            maxLength={160}
            autoFocus
            required
            onChange={(e) => setName(e.target.value)}
            placeholder="Məs.: Gələcək Akademiyası"
          />
        </label>
        <label className="block text-sm font-medium text-token-textMain">
          Növü
          <select className={fieldClass} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
            {ORG_TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-token-textMain">
          Qısa təsvir <span className="font-normal text-token-textMuted">(istəyə bağlı)</span>
          <textarea
            className={fieldClass}
            rows={3}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}
