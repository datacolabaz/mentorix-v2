import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const LEVEL = {
  critical: { cls: 'border-red-500/40 bg-red-500/10', badge: 'bg-red-500/20 text-red-400', icon: '🔴' },
  warning: { cls: 'border-yellow-500/40 bg-yellow-500/10', badge: 'bg-yellow-500/20 text-yellow-400', icon: '🟡' },
}

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/notifications/admin')
      .then(d => setNotifications(d.notifications || []))
      .finally(() => setLoading(false))
  }, [])

  const allAlerts = notifications.flatMap(n => n.alerts.map(a => ({ ...a, instructor: n.instructor })))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl">Bildirişlər</h1>
        <p className="text-token-textMuted text-sm mt-1">Müəllim limit xəbərdarlıqları</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-token-textMuted">Yüklənir...</div>
      ) : allAlerts.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-display font-bold text-lg text-token-textMain">Hər şey qaydasındadır</div>
          <p className="text-token-textMuted text-sm mt-2">Heç bir müəllimin limiti 80%-dən çox deyil</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {allAlerts.map((alert, i) => (
            <div key={i} className={`border rounded-2xl p-5 ${LEVEL[alert.level].cls}`}>
              <div className="flex items-start gap-4">
                <span className="text-2xl">{LEVEL[alert.level].icon}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-display font-bold text-token-textMain">{alert.instructor.full_name}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${LEVEL[alert.level].badge}`}>
                      {alert.level === 'critical' ? 'Kritik' : 'Xəbərdarlıq'}
                    </span>
                    <span className="text-xs text-token-textMuted">{alert.type === 'sms' ? '📱 SMS' : '💾 Storage'}</span>
                  </div>
                  <p className="text-token-textMain text-sm">{alert.message}</p>
                  <p className="text-token-textMuted text-xs mt-1">{alert.instructor.email}</p>
                </div>
              </div>
            </d