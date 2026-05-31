import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { bumpStudentAlerts } from '../../hooks/useStudentAlerts'

function typeMeta(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'assignment_new') {
    return { icon: '📋', label: 'Yeni tapşırıq', accent: 'border-violet-500/35 bg-violet-500/10' }
  }
  if (t === 'assignment_reviewed') {
    return { icon: '✅', label: 'Yoxlanıldı', accent: 'border-emerald-500/35 bg-emerald-500/10' }
  }
  if (t === 'assignment_reminder') {
    return { icon: '⏰', label: 'Xatırlatma', accent: 'border-amber-500/35 bg-amber-500/10' }
  }
  if (t === 'assignment_overdue') {
    return { icon: '⚠️', label: 'Gecikib', accent: 'border-rose-500/35 bg-rose-500/10' }
  }
  return { icon: '🔔', label: 'Bildiriş', accent: 'border-indigo-500/20 bg-[#1a1740]/20' }
}

function parseMeta(meta) {
  if (!meta) return {}
  if (typeof meta === 'object') return meta
  try {
    return JSON.parse(meta)
  } catch {
    return {}
  }
}

export default function StudentNotifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/notifications/student')
      setNotifications(Array.isArray(d.notifications) ? d.notifications : [])
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const markRead = async (id) => {
    try {
      await api.patch('/notifications/student/' + encodeURIComponent(id) + '/read')
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
      bumpStudentAlerts()
    } catch {
      /* ignore */
    }
  }

  const markAllRead = async () => {
    setMarking(true)
    try {
      await api.post('/notifications/student/read-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
      bumpStudentAlerts()
    } finally {
      setMarking(false)
    }
  }

  const openNotification = async (n) => {
    if (!n.is_read) await markRead(n.id)
    const meta = parseMeta(n.meta)
    const t = String(n.type || '').toLowerCase()
    if (t.startsWith('assignment')) {
      navigate('/student/assignments')
      return
    }
    if (meta.href) navigate(meta.href)
  }

  const unread = notifications.filter((n) => !n.is_read).length

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-2xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 pl-20 sm:pl-0">
        <div>
          <h1 className="font-display font-bold text-2xl break-words text-token-textMain">Bildirişlər</h1>
          <p className="text-token-textMuted text-sm mt-1">
            Tapşırıq və digər yeniliklər burada görünür
            {unread > 0 ? (
              <span className="text-violet-300 font-medium"> · {unread} oxunmamış</span>
            ) : null}
          </p>
        </div>
        {unread > 0 ? (
          <Button size="sm" variant="secondary" loading={marking} onClick={() => void markAllRead()}>
            Hamısını oxunmuş et
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Yüklənir...</div>
      ) : notifications.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">📭</div>
          <div className="font-display font-bold text-lg text-token-textMain">Hazırda bildiriş yoxdur</div>
          <p className="text-sm text-token-textMuted mt-2">
            Yeni tapşırıq təyin olunanda burada və{' '}
            <Link to="/student/assignments" className="text-violet-300 hover:underline">
              Tapşırıqlarım
            </Link>{' '}
            bölməsində görünəcək.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const tm = typeMeta(n.type)
            const meta = parseMeta(n.meta)
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => void openNotification(n)}
                className={[
                  'w-full text-left rounded-2xl border p-4 sm:p-5 transition-colors',
                  tm.accent,
                  !n.is_read ? 'ring-1 ring-violet-400/30' : 'opacity-90',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0" aria-hidden>
                    {tm.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white break-words">{n.title || 'Bildiriş'}</span>
                      {!n.is_read ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-200 bg-violet-500/25 px-2 py-0.5 rounded-full">
                          Yeni
                        </span>
                      ) : null}
                      <span className="text-[10px] text-gray-500 uppercase">{tm.label}</span>
                    </div>
                    <p className="text-gray-300 text-sm mt-2 whitespace-pre-wrap break-words">{n.body}</p>
                    {meta.instructor_name ? (
                      <p className="text-xs text-gray-500 mt-2">Müəllim: {meta.instructor_name}</p>
                    ) : null}
                    <p className="text-xs text-gray-500 mt-2">
                      {n.created_at ? new Date(n.created_at).toLocaleString('az-AZ') : ''}
                    </p>
                    {String(n.type || '').startsWith('assignment') ? (
                      <p className="text-xs text-violet-300 mt-2 font-medium">Tapşırıqlara keç →</p>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
