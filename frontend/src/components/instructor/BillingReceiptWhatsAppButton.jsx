import { billingReceiptWhatsAppUrl } from '../../lib/billingPaymentLabels'

export default function BillingReceiptWhatsAppButton({
  amountAzn,
  product = 'plan',
  className = '',
  fullWidth = true,
}) {
  return (
    <a
      href={billingReceiptWhatsAppUrl({ amountAzn, product })}
      target="_blank"
      rel="noopener noreferrer"
      className={[
        'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#041018] transition-colors',
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      📱 Qəbzi WhatsApp ilə göndər
    </a>
  )
}
