import { Link, useSearchParams } from 'react-router-dom'
import Card from '../../components/common/Card'

function formatAccount(digits) {
  const s = String(digits || '').replace(/\D/g, '')
  if (s.length !== 12) return s || '—'
  return `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8, 12)}`
}

export default function PaymentPending() {
  const [params] = useSearchParams()
  const account = params.get('account') || ''
  const amount = params.get('amount')
  const product = params.get('product') || 'plan'

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Card className="p-6 space-y-4 border-amber-500/30 bg-amber-500/5">
        <h1 className="font-display font-bold text-xl text-token-textMain">Ödəniş gözləmədədir</h1>
        <p className="text-sm text-token-textMuted leading-relaxed">
          {product === 'sms'
            ? 'SMS paketi üçün köçürmə qeydə alındı. Admin təsdiqlədikdən sonra SMS balansınıza əlavə olunacaq.'
            : 'Paket üçün köçürmə qeydə alındı. Admin təsdiqlədikdən sonra paketiniz aktivləşəcək.'}
        </p>
        {amount ? (
          <p className="text-sm">
            <span className="text-token-textMuted">Məbləğ: </span>
            <span className="font-bold text-token-textMain">{amount} AZN</span>
          </p>
        ) : null}
        <div className="rounded-xl border border-amber-500/25 bg-token-surfaceCard/60 p-4">
          <div className="text-xs uppercase tracking-wider text-token-textMuted mb-2">Köçürmə hesabı (12 rəqəm)</div>
          <div className="font-mono text-xl tracking-widest font-bold text-token-textMain select-all">
            {formatAccount(account)}
          </div>
        </div>
        <p className="text-xs text-token-textMuted">
          Köçürməni etdikdən sonra adminə müraciət edin. Statusu Tənzimləmələr → Ödəniş tarixçəsində izləyə bilərsiniz.
        </p>
        <Link
          to="/instructor/settings"
          className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-[#041018]"
        >
          Tənzimləmələrə qayıt
        </Link>
      </Card>
    </div>
  )
}
