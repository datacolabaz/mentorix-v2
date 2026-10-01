import Modal from '../common/Modal'
import Button from '../common/Button'

export default function BillingLimitTopUpModal({ open, onClose, planTitle = 'Premium', onManageStorage }) {
  return (
    <Modal open={open} onClose={onClose} title={`${planTitle} — limit dolub`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-token-textMain leading-relaxed">
          Bulud yaddaşı limitiniz dolub. Əlavə yaddaş alın və ya köhnə faylları silib yer açın.
        </p>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="primary" className="w-full justify-center" onClick={onManageStorage}>
            Əlavə yaddaş al
          </Button>
          <Button type="button" variant="secondary" className="w-full justify-center" onClick={onClose}>
            Bağla
          </Button>
        </div>
      </div>
    </Modal>
  )
}
