import Modal from '../common/Modal'
import Button from '../common/Button'

const PLANS = [
  { id: 'basic', title: 'BASIC', price: '15 AZN/ay', highlight: false, items: ['20 students', '1GB storage', '30 SMS'] },
  { id: 'pro', title: 'PRO', price: '29 AZN/ay', highlight: true, items: ['100 students', '5GB storage', '200 SMS'] },
  { id: 'business', title: 'BUSINESS', price: '49 AZN/ay', highlight: false, items: ['Unlimited students', '20GB storage', '500 SMS'] },
]

export default function UpgradeModal({ open, onClose, onSelectPlan }) {
  return (
    <Modal open={open} onClose={onClose} title="Upgrade" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-token-textMuted">
          Plan seçin. Ödəniş inteqrasiyası (Stripe/iyzico) növbəti mərhələdə qoşulacaq; indi bir kliklə “upgrade tələbini” göndərə bilərsiniz.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={[
                'rounded-2xl border p-4',
                p.highlight
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/40',
              ].join(' ')}
            >
              <div className="text-sm font-bold text-token-textMain">{p.title}</div>
              <div className="text-xs text-token-textMuted mt-1">{p.price}</div>
              <ul className="mt-3 space-y-1 text-xs text-token-textMain">
                {p.items.map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="text-token-textMuted">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Button className="w-full justify-center" variant={p.highlight ? 'primary' : 'secondary'} onClick={() => onSelectPlan(p.id)}>
                  {p.highlight ? 'Upgrade to PRO' : 'Choose'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

