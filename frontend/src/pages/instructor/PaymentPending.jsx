import { Link, useSearchParams } from 'react-router-dom'
import Card from '../../components/common/Card'
import { formatBankCardDisplay } from '../../lib/billingPaymentLabels'
import BillingReceiptWhatsAppButton from '../../components/instructor/BillingReceiptWhatsAppButton'

export default function PaymentPending() {
  const [params] = useSearchParams()
  const account = params.get('account') || ''
  const amount = params.get('amount')
  const product = params.get('product') || 'plan'

  const pendingMessage =
    product === 'sms'
      ? 'SMS paketi üçün köçürmə qeydə alındı. Qəbzi WhatsApp ilə göndərdikdən sonra admin yoxlayacaq və SMS balansınıza əlavə olunacaq.'
      : product === 'storage'
        ? 'Yaddaş paketi üçün köçürmə qeydə alındı. Qəbzi WhatsApp ilə göndərdikdən sonra admin yoxlayacaq və yaddaş limitiniz artırılacaq.'
        : 'Paket üçün köçürmə qeydə alındı. Qəbzi WhatsApp ilə göndərdikdən sonra admin yoxlayacaq və paketiniz aktivləşdiriləcək.'

  return (
    <div className="p-6 max-w-lg mx-auto">
      <Card className="p-6 space-y-4 border-amber-500/30 bg-amber-500/5">
        <h1 className="font-display font-bold text-xl text-token-textMain">Ödəniş gözləmədədir</h1>
        <p className="text-sm text-token-textMuted leading-relaxed">{pendingMessage}</p>
        {amount ? (
          <p className="text-sm">
            <span className="text-token-textMuted">Məbləğ: </span>
            <span className="font-bold text-token-textMain">{amount} AZN</span>
          </p>
        ) : null}
        <div className="rounded-xl border border-amber-500/25 bg-token-surfaceCard/60 p-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-token-textMuted">Bank kartı nömrəsi (16 rəqəm)</div>
          <div className="font-mono text-xl tracking-widest font-bold text-token-textMain select-all">
            {formatBankCardDisplay(account)}
          </div>
        </div>
        <p className="text-xs text-token-textMuted leading-relaxed">
          Ödənişdən sonra qəbzi WhatsApp üzərindən{' '}
          <span className="text-token-textMain font-medium">+994 55 377 57 70</span> nömrəsinə göndərin. Təsdiqdən
          sonra paket aktivləşdiriləcək.
        </p>
        <BillingReceiptWhatsAppButton amountAzn={amount} product={product} />
        <Link
          to="/instructor/settings"
          className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-token-textMain hover:bg-white/5"
        >
          Tənzimləmələrə qayıt
        </Link>
      </Card>
    </div>
  )
}
