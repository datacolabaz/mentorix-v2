import { useEffect, useState } from 'react'
import api from '../../lib/api'
import LevelBadge from '../public/LevelBadge'

export default function UserSkillProgressPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await api.get('/public/certified-exams/me/skill-progress')
        if (!cancelled) setRows(Array.isArray(d?.progress) ? d.progress : [])
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return null
  if (!rows.length) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-token-textMuted">Bacarıq səviyyələrim</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map((row) => (
          <div
            key={row.category_id}
            className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceAlt px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-token-textMain truncate">
                {row.parent_name ? `${row.parent_name} · ${row.name}` : row.name}
              </p>
              <p className="text-[10px] text-token-textMuted mt-0.5">
                Yeniləndi: {row.updated_at ? new Date(row.updated_at).toLocaleDateString('az-AZ') : '—'}
              </p>
            </div>
            <LevelBadge level={row.current_level} />
          </div>
        ))}
      </div>
    </section>
  )
}
