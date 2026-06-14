import Modal from './Modal'
import Button from './Button'

/** Mərkəzdə açılan təsdiq dialoqu (browser confirm əvəzinə). */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Təsdiq',
  message,
  confirmLabel = 'Bəli',
  cancelLabel = 'Xeyr',
  loading = false,
  danger = false,
}) {
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={title}
      size="sm"
      footer={
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={() => onConfirm()}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-token-textMuted leading-relaxed whitespace-pre-wrap">{message}</p>
    </Modal>
  )
}
