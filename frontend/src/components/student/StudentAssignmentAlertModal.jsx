import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { bumpStudentAlerts } from '../../hooks/useStudentAlerts'

const ASSIGNMENT_TYPES = new Set([
  'assignment_new',
  'assignment_reminder',
  'assignment_overdue',
  'assignment_reviewed',
  'assignment_submitted',
])

const DISMISS_KEY = 'mx_assignment_alert_dismissed'

function parseMeta(meta) {
  if (!meta) return {}
  if (typeof meta === 'object') return meta
  try {
    return JSON.parse(meta)
  } catch {
    return {}
  }
}

function typeLabel(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'assignment_new') return 'Yeni tapşırıq'
  if (t === 'assignment_reviewed') return 'Yoxlanıldı'
  if (t === 'assignment_reminder') return 'Xatırlatma'
  if (t === 'assignment_overdue') return 'Gecikib'
  return 'Tapşırıq'
}

export default function StudentAssignmentAlertModal() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api.get('/notifications/student')
      const list = (Array.isArray(d.notifications) ? d.notifications : []).filter(
        (n) => !n.is_read && ASSIGNMENT_TYPES.has(String(n.type || '').toLowerCase()),
      )
      setItems(list)
      if (list.length === 0) {
        setOpen(false)
        return
      }
      let dismissed = []
      try {
        dismissed = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]')
      } catch {
        dismissed = []
      }
      const unseen = list.filter((n) => !dismissed.includes(n.id))
      setOpen(unseen.length > 0)
    } catch {
      setItems([])
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onRefresh = () => void load()
    window.addEventListener('mx:student-alerts-changed', onRefresh)
    return () => window.removeEventListener('mx:student-alerts-changed', onRefresh)
  }, [load])

  const dismissSession = () => {
    try {
      const prev = JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]')
      const ids = items.map((n) => n.id)
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...new Set([...prev, ...ids])]))
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  const markRead = async (id) => {
    try {
      await api.patch('/notifications/student/' + encodeURIComponent(id) + '/read')
      bumpStudentAlerts()
      setItems((prev) => prev.filter((n) => n.id !== id))
    } catch {
      /* ignore */
    }
  }

  const markAllRead = async () => {
    setMarking(true)
    try {
      await api.post('/notifications/student/read-all')
      bumpStudentAlerts()
      setItems([])
      setOpen(false)
    } finally {
      setMarking(false)
    }
  }

  const goAssignments = async () => {
    for (const n of items) {
      if (!n.is_read) await markRead(n.id)
    }
    setOpen(false)
    navigate('/student/assignments')
  }

  const headline = useMemo(() => {
    if (items.length === 1) return 'Yeni tapşırıq bildirişi'
    return `${items.length} tapşırıq bildirişi`
  }, [items.length])

  return (
    <Modal open={open} onClose={dismissSession} title={headline} size="md" zIndex={10200}>
      <div className="space-y-4 -mt-2">
        <p className="text-sm text-gray-400">
          Müəlliminiz ev tapşırığı göndərib. Aşağıdakı mesajları oxuyub Tapşırıqlarım bölməsinə keçə bilərsiniz.
        </p>
        <ul className="space-y-3 max-h-[min(50vh,20rem)] overflow-y-auto pr-1">
          {items.map((n) => {
            const meta = parseMeta(n.meta)
            return (
              <li
                key={n.id}
                className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-left"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-lg" aria-hidden>
                    📋
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-violet-200">
                    {typeLabel(n.type)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white break-words">{n.title || 'Tapşırıq'}</p>
                {n.body ? (
                  <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap break-words">{n.body}</p>
                ) : null}
                {meta.instructor_name ? (
                  <p className="text-xs text-gray-500 mt-2">Müəllim: {meta.instructor_name}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void markRead(n.id)}>
                    Oxunmuş et
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-white/10">
          <Button variant="secondary" onClick={dismissSession}>
            Bağla
          </Button>
          <Button variant="secondary" loading={marking} onClick={() => void markAllRead()}>
            Hamısını oxunmuş et
          </Button>
          <Button onClick={() => void goAssignments()}>Tapşırıqlara keç</Button>
        </div>
      </div>
    </Modal>
  )
}
