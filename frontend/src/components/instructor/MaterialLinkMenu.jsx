import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import { useToast } from '../common/Toast'

const LINK_ACTIONS = [
  { type: 'exam', label: 'İmtahana əlavə et', icon: '📝' },
  { type: 'assignment', label: 'Tapşırığa əlavə et', icon: '📋' },
  { type: 'lesson', label: 'Dərsə əlavə et', icon: '📅' },
  { type: 'student', label: 'Tələbəyə göndər', icon: '👤' },
  { type: 'group', label: 'Qrupa göndər', icon: '👥' },
]

function targetLabel(type, item) {
  if (!item) return ''
  if (type === 'exam') return item.title || 'İmtahan'
  if (type === 'assignment') return item.title || 'Tapşırıq'
  if (type === 'lesson') {
    const g = item.group_name ? ` · ${item.group_name}` : ''
    return `Dərs ${item.lesson_number || '?'}${g}`
  }
  if (type === 'student') return item.full_name || item.name || 'Tələbə'
  if (type === 'group') return item.name || 'Qrup'
  return item.title || item.name || ''
}

export default function MaterialLinkMenu({ material, onLinked, className = '' }) {
  const toast = useToast()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [picker, setPicker] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const loadTargets = useCallback(async (type) => {
    setLoading(true)
    setItems([])
    try {
      if (type === 'exam') {
        const d = await api.get('/exams')
        setItems(Array.isArray(d.exams) ? d.exams : [])
      } else if (type === 'assignment') {
        const d = await api.get('/tasks')
        setItems(Array.isArray(d.tasks) ? d.tasks : [])
      } else if (type === 'student') {
        const d = await api.get('/students')
        setItems(Array.isArray(d.students) ? d.students : [])
      } else if (type === 'group' || type === 'lesson') {
        const d = await api.get('/materials/options')
        setItems(type === 'group' ? d.options?.groups || [] : d.options?.lessons || [])
      }
    } catch (e) {
      toast(e?.message || 'Siyahı yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  const openPicker = (type) => {
    setOpen(false)
    setPicker(type)
    void loadTargets(type)
  }

  const submitLink = async (targetId) => {
    if (!material?.id || !picker) return
    setLinking(true)
    try {
      const res = await api.post(`/materials/${material.id}/link`, {
        target_type: picker,
        target_id: targetId,
      })
      if (res?.success) {
        toast('Material bağlandı', 'success')
        setPicker(null)
        onLinked?.(res.material)
      }
    } catch (e) {
      toast(e?.message || 'Bağlama alınmadı', 'error')
    } finally {
      setLinking(false)
    }
  }

  const pickerMeta = LINK_ACTIONS.find((a) => a.type === picker)

  return (
    <>
      <div className={`relative ${className}`} ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-2 rounded-lg text-xs text-token-textMain border border-[color:var(--border-subtle)] hover:bg-white/5 whitespace-nowrap"
        >
          Bağla ▾
        </button>
        {open ? (
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-[color:var(--border-subtle)] bg-[#1a1a1a] shadow-xl py-1">
            {LINK_ACTIONS.map((action) => (
              <button
                key={action.type}
                type="button"
                onClick={() => openPicker(action.type)}
                className="w-full text-left px-3 py-2 text-xs text-gray-200 hover:bg-white/5 flex items-center gap-2"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Modal
        open={Boolean(picker)}
        onClose={() => !linking && setPicker(null)}
        title={pickerMeta ? pickerMeta.label : 'Seçin'}
        size="md"
        scrollBody
      >
        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-gray-500 py-6 text-center">Yüklənir…</p>
          ) : !items.length ? (
            <p className="text-sm text-gray-500 py-6 text-center">Siyahı boşdur</p>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={linking}
                onClick={() => void submitLink(item.id)}
                className="w-full text-left rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
              >
                {targetLabel(picker, item)}
              </button>
            ))
          )}
          <div className="pt-2 flex justify-end">
            <Button variant="ghost" onClick={() => setPicker(null)} disabled={linking}>
              Ləğv et
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
