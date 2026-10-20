import { useEffect, useState } from 'react'
import Modal from '../../common/Modal'
import Button from '../../common/Button'
import GroupPackageFields from '../GroupPackageFields'

export const fieldCls =
  'h-11 w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 text-sm text-token-textMain placeholder:text-token-textMuted outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20'

/** «Sahə yarat»: one labelled field. Keeps the typed name when saving fails. */
export function CreateSubjectModal({ open, onClose, onSubmit, busy }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setName('')
      setError('')
    }
  }, [open])
  const submit = async (e) => {
    e?.preventDefault?.()
    if (busy) return
    const v = name.trim()
    if (!v) {
      setError('Sahənin adını yazın.')
      return
    }
    setError('')
    const res = await onSubmit(v)
    if (res?.error) setError(res.error)
  }
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Sahə yarat"
      size="sm"
      closeLabel="Bağla"
      manageFocus
      zIndex={10050}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Ləğv et
          </Button>
          <Button loading={busy} disabled={busy} onClick={() => void submit()}>
            Sahə yarat
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-2" noValidate>
        <label htmlFor="create-subject-name" className="block text-sm font-medium text-token-textMain">
          Sahənin adı
        </label>
        <input
          id="create-subject-name"
          data-autofocus
          className={fieldCls}
          value={name}
          maxLength={200}
          placeholder="Məs.: Riyaziyyat, Python"
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby="create-subject-hint"
        />
        <p id="create-subject-hint" className="text-xs text-token-textMuted">
          Sahənin içində qruplar yaradıb hər qrupa ayrıca paket və cədvəl təyin edəcəksiniz.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  )
}

/**
 * Create («+ Qrup») and edit («Paket və cədvəl») use the same existing form: name + GroupPackageFields.
 * The subject is fixed by the section that opened it. Values stay in place when saving fails.
 */
export function GroupFormModal({ state, onChange, pkg, onPkgChange, error, busy, onSave, onClose }) {
  const open = Boolean(state)
  const isEdit = state?.mode === 'edit'
  const name = isEdit ? state?.group?.name || '' : state?.name || ''
  const setName = (v) => onChange((m) => (m ? (m.mode === 'edit' ? { ...m, group: { ...m.group, name: v } } : { ...m, name: v }) : m))
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={isEdit ? 'Paket və cədvəl' : 'Yeni qrup'}
      size="lg"
      zIndex={10050}
      closeLabel="Bağla"
      manageFocus
      scrollBody
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Ləğv et
          </Button>
          <Button loading={busy} disabled={busy} onClick={() => void onSave()}>
            {isEdit ? 'Yadda saxla' : 'Qrupu yarat'}
          </Button>
        </div>
      }
    >
      {open ? (
        <div className="space-y-4">
          <p className="text-sm text-token-textMuted">
            Sahə: <span className="font-semibold text-token-textMain">{state.subjectName || '—'}</span>
          </p>
          {!isEdit ? (
            <p className="rounded-xl bg-canvas-subtle px-3 py-2 text-xs text-token-textMuted">
              Paket (8/12 dərs), qiymət və cədvəli bir dəfə təyin edin. Dəvət linki ilə qoşulan tələbə bu şərtləri görür və
              razılaşır; qoşulmanı siz «Sorğular»da təsdiqləyirsiniz.
            </p>
          ) : null}
          {error ? (
            <div className="rounded-xl bg-error-subtle px-4 py-3 text-sm text-error" role="alert">
              <strong className="font-semibold">Xəta:</strong> {error}
            </div>
          ) : null}
          <div>
            <label htmlFor="group-form-name" className="mb-1.5 block text-sm font-medium text-token-textMain">
              Qrup adı
            </label>
            <input
              id="group-form-name"
              data-autofocus
              className={fieldCls}
              maxLength={200}
              value={name}
              placeholder="Məs.: 11-A, Python axşam"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <GroupPackageFields value={pkg} onChange={onPkgChange} />
        </div>
      ) : null}
    </Modal>
  )
}

/**
 * Delete confirmation that names the object and the server's real consequences.
 * `blockedReason` turns it into an explanation without a delete button (rule A: subjects with students).
 */
export function DeleteConfirmModal({ target, busy, error, onConfirm, onClose }) {
  const open = Boolean(target)
  const blocked = Boolean(target?.blockedReason)
  const isSubject = target?.type === 'subject'
  const groups = Array.isArray(target?.groupNames) ? target.groupNames : []
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={blocked ? (isSubject ? 'Sahəni silmək olmur' : 'Qrupu silmək olmur') : isSubject ? 'Sahəni sil' : 'Qrupu sil'}
      size="sm"
      zIndex={10060}
      closeLabel="Bağla"
      manageFocus
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onClose} data-autofocus>
            {blocked ? 'Anladım' : 'Ləğv et'}
          </Button>
          {!blocked ? (
            <Button variant="danger" loading={busy} disabled={busy} onClick={() => void onConfirm()}>
              {isSubject ? 'Sahəni sil' : 'Qrupu sil'}
            </Button>
          ) : null}
        </div>
      }
    >
      {open ? (
        <div className="space-y-3 text-sm text-token-textMain" data-testid="delete-confirm">
          {blocked ? (
            <p>{target.blockedReason}</p>
          ) : isSubject ? (
            <>
              <p>
                <strong>«{target.name}»</strong> sahəsi silinəcək.
              </p>
              {groups.length ? (
                <p>
                  İçindəki {groups.length} qrup da silinəcək: <strong>{groups.join(', ')}</strong>. Bu qrupların çatları, dəvət
                  kodları və müddətli linkləri də silinir.
                </p>
              ) : (
                <p>Sahədə qrup yoxdur.</p>
              )}
            </>
          ) : (
            <p>
              <strong>«{target.name}»</strong> qrupu silinəcək. Qrupun çatı, dəvət kodu və müddətli linkləri də silinir.
            </p>
          )}
          {!blocked ? <p className="text-xs text-token-textMuted">Bu əməliyyat geri qaytarılmır.</p> : null}
          {error ? (
            <p role="alert" className="rounded-xl bg-error-subtle px-3 py-2 text-sm text-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  )
}
