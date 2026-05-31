import Modal from '../common/Modal'
import Button from '../common/Button'

export default function BillingLimitTopUpModal({
  open,
  onClose,
  planTitle = 'Premium',
  smsReached,
  storageReached,
  onBuySms,
  onManageStorage,
}) {
  return (
    <Modal open={open} onClose={onClose} title={`${planTitle} — limit dolub`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-token-textMain leading-relaxed">
          {smsReached && storageReached
            ? 'SMS və yaddaş limitiniz dolub. Aşağı paketə keçmək lazım deyil — cari paketinizdə limiti artırın.'
            : smsReached
              ? 'Aylıq SMS limitiniz dolub. Davam etmək üçün əlavə SMS paketi alın.'
              : 'Yaddaş limitiniz dolub. Yeni fayl üçün yer açın və ya faylları azaldın.'}
        </p>
        <div className="flex flex-col gap-2">
          {smsReached ? (
            <Button type="button" variant="primary" className="w-full justify-center" onClick={onBuySms}>
              SMS al
            </Button>
          ) : null}
          {storageReached ? (
            <Button
              type="button"
              variant={smsReached ? 'secondary' : 'primary'}
              className="w-full justify-center"
              onClick={onManageStorage}
            >
              Əlavə yaddaş al
            </Button>
          ) : null}
          <Button type="button" variant="secondary" className="w-full justify-center" onClick={onClose}>
            Bağla
          </Button>
        </div>
      </div>
    </Modal>
  )
}
