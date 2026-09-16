import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

const MENU_WIDTH = 220
const MENU_Z_INDEX = 9999

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

export default function MaterialLinkMenu({ material, onLinked, onOpenChange, className = '' }) {
  const toast = useToast()
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null)
  const [picker, setPicker] = useState(null)
  const [items, setItems] = useState([])
  const [filteredItems, setFilteredItems] = useState([])
  const [selectedGroupIds, setSelectedGroupIds] = useState([])
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)

  const updateMenuPosition = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = rect.right - MENU_WIDTH
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8))
    const spaceBelow = window.innerHeight - rect.bottom - 8
    const estimatedHeight = LINK_ACTIONS.length * 36 + 8
    const openUp = spaceBelow < estimatedHeight && rect.top > estimatedHeight
    setMenuStyle({
      position: 'fixed',
      left,
      width: MENU_WIDTH,
      zIndex: MENU_Z_INDEX,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    })
  }, [])

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    updateMenuPosition()
    const onReflow = () => updateMenuPosition()
    window.addEventListener('resize', onReflow)
    window.addEventListener('scroll', onReflow, true)
    return () => {
      window.removeEventListener('resize', onReflow)
      window.removeEventListener('scroll', onReflow, true)
    }
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const inButton = buttonRef.current?.contains(e.target)
      const inMenu = menuRef.current?.contains(e.target)
      if (!inButton && !inMenu) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const loadTargets = useCallback(async (type) => {
    setLoading(true)
    setItems([])
    setFilteredItems([])
    try {
      if (type === 'exam') {
        const d = await api.get('/exams')
        const data = Array.isArray(d.exams) ? d.exams : []
        setItems(data)
        setFilteredItems(data)
      } else if (type === 'assignment') {
        const d = await api.get('/tasks')
        const data = Array.isArray(d.tasks) ? d.tasks : []
        setItems(data)
        setFilteredItems(data)
      } else if (type === 'student') {
        const d = await api.get('/students')
        const data = Array.isArray(d.students) ? d.students : []
        setItems(data)
        setFilteredItems(data)
      } else if (type === 'group' || type === 'lesson') {
        const d = await api.get('/materials/options')
        const data = type === 'group' ? d.options?.groups || [] : d.options?.lessons || []
        setItems(data)
        setFilteredItems(data)
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
    setSelectedGroupIds(type === 'group' ? (material?.groups || []).map((group) => group.id) : [])
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

  const submitGroups = async () => {
    if (!selectedGroupIds.length) {
      toast('Ən azı bir qrup seçin', 'error')
      return
    }
    await submitLink(selectedGroupIds)
  }

  const pickerMeta = LINK_ACTIONS.find((a) => a.type === picker)

  const dropdown =
    open && menuStyle
      ? createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="rounded-xl border border-white/15 bg-[#1a1a1a] shadow-[0_16px_40px_rgba(0,0,0,0.55)] py-1"
            role="menu"
          >
            {LINK_ACTIONS.map((action) => (
              <button
                key={action.type}
                type="button"
                role="menuitem"
                onClick={() => openPicker(action.type)}
                className="w-full text-left px-3 py-2 text-xs text-gray-100 hover:bg-white/10 flex items-center gap-2"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null

  return (
    <>
      <div className={className}>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="px-3 py-2 rounded-lg text-xs text-token-textMain border border-[color:var(--border-subtle)] hover:bg-white/5 whitespace-nowrap"
        >
          Bağla ▾
        </button>
      </div>
      {dropdown}

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
          ) : !filteredItems.length ? (
            <p className="text-sm text-gray-500 py-6 text-center">Siyahı boşdur</p>
          ) : (
            <div className="space-y-2">
              {picker === 'group' && (
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Qrup axtar..."
                    className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2.5 text-sm text-token-textMain outline-none focus:border-primary/40"
                    onChange={(e) => {
                      const query = e.target.value.toLowerCase()
                      const filtered = items.filter((item) => 
                        targetLabel(picker, item).toLowerCase().includes(query)
                      )
                      setFilteredItems(filtered)
                    }}
                  />
                </div>
              )}
              {filteredItems.map((item) => picker === 'group' ? (
                <label
                  key={item.id}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-[color:var(--border-subtle)] px-3 py-2.5 text-sm text-token-textMain hover:border-primary/40 hover:bg-primary/5"
                >
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={selectedGroupIds.includes(item.id)}
                    disabled={linking}
                    onChange={() => setSelectedGroupIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])}
                  />
                  <span>{targetLabel(picker, item)}</span>
                </label>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  disabled={linking}
                  onClick={() => void submitLink(item.id)}
                  className="w-full text-left rounded-xl border border-[color:var(--border-subtle)] px-3 py-2.5 text-sm text-token-textMain hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  {targetLabel(picker, item)}
                </button>
              ))}
            </div>
          )}
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPicker(null)} disabled={linking}>
              Ləğv et
            </Button>
            {picker === 'group' && filteredItems.length ? (
              <Button onClick={() => void submitGroups()} loading={linking} disabled={!selectedGroupIds.length}>
                {selectedGroupIds.length > 1 ? `${selectedGroupIds.length} qrupa göndər` : 'Qrupa göndər'}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>
    </>
  )
}
