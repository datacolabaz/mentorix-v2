import Modal from '../common/Modal'
import Button from '../common/Button'

export default function LimitReachedModal({
  open,
  onClose,
  onPrimary,
  serverMessage,
  primaryLabel = 'Paketlərə bax',
}) {
  return (
    <Modal open={open} onClose={onClose} title="Limitə çatdınız" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-token-textMain leading-relaxed">
          {serverMessage && String(serverMessage).trim()
            ? serverMessage
            : 'Davam etmək üçün paket seçməlisiniz.'}
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button type="button" variant="secondary" className="w-full sm:w-auto justify-center" onClick={onClose}>
            Bağla
          </Button>
          <Button type="button" variant="primary" className="w-full sm:w-auto justify-center" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
