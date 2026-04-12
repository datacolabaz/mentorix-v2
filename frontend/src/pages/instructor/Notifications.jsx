import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const LEVEL = {
  critical: { cls: 'border-red-500/40 bg-red-500/10', badge: 'bg-red-500/20 text-red-400', icon: '🔴' },
  warning: { cls: 'border-yellow-500/40 bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-400', icon: '🟡' },
}

export default function InstructorNotifications() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get('/notifications/instructor')
      .then((d) => {
        if (!cancelled) setAlerts(d.alerts || [])
      })
      .catch(() => {
        if (!cancelled) setAlerts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl break-words">Bildirişlər</h1>
        <p className="text-gray-400 text-sm mt-1">SMS və saxlama limitləri</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Yüklənir...</div>
      ) : alerts.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center max-w-lg mx-auto">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-display font-bold text-lg text-white break-words px-2">
            Hər şey qaydasındadır
          </div>
          <p className="text-gray-400 text-sm mt-2 px-2">
            Limitləriniz 80%-dən çox dolmayıb
          </p>
        </Card>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {alerts.map((alert, i) => (
            <div key={i} className={`border rounded-2xl p-4 sm:p-5 ${LEVEL[alert.level].cls}`}>
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <span className="text-2xl shrink-0">{LEVEL[alert.level].icon}</span>
                <div className="flex-1 min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-semibold mb-2 ${LEVEL[alert.level].badge}`}>
                    {alert.level === 'critical' ? 'Kritik' : 'Xəbərdarlıq'}
                  </span>
                  <p className="text-gray-300 text-sm break-words">{alert.message}</p>
                  <p className="text-gray-500 text-xs mt-1">{alert.type === 'sms' ? '📱 SMS' : '💾 Storage'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
