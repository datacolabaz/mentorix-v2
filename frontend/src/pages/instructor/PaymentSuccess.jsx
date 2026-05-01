import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { BILLING_STATUS_QUERY_KEY } from '../../hooks/useBillingStatus'

export default function PaymentSuccess() {
  const [sp] = useSearchParams()
  const orderId = sp.get('orderId')
  const toast = useToast()
  const qc = useQueryClient()

  useEffect(() => {
    qc.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
    toast('Ödəniş uğurludur. Plan yeniləndi.', 'success')
  }, [qc, toast])

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <Card hover className="p-6 border-emerald-500/30 bg-emerald-500/5">
        <div className="text-sm font-bold text-emerald-200">Payment success</div>
        <div className="text-token-textMain mt-2">
          {orderId ? (
            <span className="text-sm text-token-textMuted">Order: <span className="font-mono text-token-textMain">{orderId}</span></span>
          ) : (
            <span className="text-sm text-token-textMuted">—</span>
          )}
        </div>
        <div className="mt-4">
          <Button variant="primary" onClick={() => (window.location.href = '/instructor')}>
            Dashboard-a qayıt
          </Button>
        </div>
      </Card>
    </div>
  )
}

