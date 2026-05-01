import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { BILLING_STATUS_QUERY_KEY } from '../../hooks/useBillingStatus'

export default function PaymentFail() {
  const [sp] = useSearchParams()
  const orderId = sp.get('orderId')
  const toast = useToast()
  const qc = useQueryClient()

  useEffect(() => {
    qc.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
    toast('Ödəniş alınmadı. Yenidən cəhd edin.', 'error')
  }, [qc, toast])

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <Card hover className="p-6 border-rose-500/30 bg-rose-500/5">
        <div className="text-sm font-bold text-rose-200">Payment failed</div>
        <div className="text-token-textMain mt-2">
          {orderId ? (
            <span className="text-sm text-token-textMuted">Order: <span className="font-mono text-token-textMain">{orderId}</span></span>
          ) : (
            <span className="text-sm text-token-textMuted">—</span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => (window.location.href = '/instructor')}>
            Panelə qayıt
          </Button>
          <Button variant="primary" onClick={() => (window.location.href = '/instructor/settings')}>
            Yenidən upgrade
          </Button>
        </div>
      </Card>
    </div>
  )
}

