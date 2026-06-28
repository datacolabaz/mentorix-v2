import { useCallback, useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import { materialFileKind, materialFileOpenUrl } from '../../lib/materialFileUrl'
import { formatMaterialsBytes } from '../../lib/materialsPlanLimits'

export default function LibraryMaterialPickerModal({ open, onClose, onSelect, selectedIds = [] }) {
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState([])
  const [q, setQ] = useState('')
  const selected = new Set(selectedIds.map(String))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      const res = await api.get(`/materials${params}`)
      if (res?.success) setMaterials(res.materials || [])
    } catch {
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  return (
    <Modal open={open} onClose={onClose} title="Kitabxanadan seç" size="lg" scrollBody>
      <div className="space-y-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
          placeholder="Ad, tag və ya qrup ilə axtar…"
          className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white"
        />
        {loading ? (
          <p className="text-sm text-gray-500 text-center py-8">Yüklənir…</p>
        ) : !materials.length ? (
          <p className="text-sm text-gray-500 text-center py-8">Material tapılmadı</p>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {materials.map((m) => {
              const picked = selected.has(String(m.id))
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={picked}
                  onClick={() => {
                    onSelect?.(m)
                    onClose?.()
                  }}
                  className={[
                    'w-full text-left rounded-xl border px-3 py-3 transition-colors',
                    picked
                      ? 'border-primary/50 bg-primary/10 opacity-60 cursor-not-allowed'
                      : 'border-white/10 hover:border-primary/40 hover:bg-primary/5',
                  ].join(' ')}
                >
                  <div className="font-medium text-sm text-white">{m.title}</div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    {materialFileKind(m.file_type, m.file_url)} · {formatMaterialsBytes(m.file_size)}
                    {m.group_name ? ` · ${m.group_name}` : ''}
                  </div>
                  {m.tags?.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {m.tags.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </button>
              )
            })}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Bağla
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function libraryMaterialAsExamFile(material) {
  return {
    id: `lib-${material.id}`,
    libraryId: material.id,
    name: material.title,
    url: material.file_url,
    fromLibrary: true,
    openUrl: materialFileOpenUrl(material.file_url),
  }
}
