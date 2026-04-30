import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'

export default function StudentNotifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get('/notifications/student')
      .then((d) => {
        if (!cancelled) setNotifications(d.notifications || [])
      })
      .catch(() => {
        if (!cancelled) setNotifications([])
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
        <h1 className="font-display font-bold text-2xl break-words pl-16 sm:pl-0">Bildirişlər</h1>
        <p className="text-gray-400 text-sm mt-1">Sizdən ötürülmüş bildirişlər</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Yüklənir...</div>
      ) : notifications.length === 0 ? (
        <Card className="p-8 text-center max-w-lg mx-auto">
          <div className="text-4xl mb-4">📭</div>
          <div className="font-display font-bold text-lg text-white">Hazırda bildiriş yoxdur</div>
        </Card>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {notifications.map((n) => (
            <div key={n.id} className="border border-indigo-500/15 rounded-2xl p-4 sm:p-5 bg-[#1a1740]/20">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white break-words">{n.title || 'Bildiriş'}</div>
                  <div className="text-gray-300 text-sm mt-2 whitespace-pre-wrap break-words">{n.body}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                  </div>
                </div>
                {n.is_read ? (
                  <span className="text-xs text-gray-500 shrink-0">Oxunub</span>
                ) : (
                  <span className="text-xs text-yellow-300 shrink-0">Yeni</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

