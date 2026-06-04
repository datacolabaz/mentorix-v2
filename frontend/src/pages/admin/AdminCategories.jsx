import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'
const lbl = 'block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2'

export default function AdminCategories() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/categories')
      setCategories(Array.isArray(res?.categories) ? res.categories : [])
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return categories
    return categories.filter((c) => {
      const hay = [c.id, c.slug, c.name_az, c.parent_name_az, c.search_aliases]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(term)
    })
  }, [categories, q])

  const openEdit = (c) => {
    setEdit({
      id: c.id,
      name_az: c.name_az || '',
      search_aliases: c.search_aliases || '',
      is_popular: Boolean(c.is_popular),
      parent_name_az: c.parent_name_az,
      is_virtual_category: c.is_virtual_category,
    })
  }

  const saveEdit = async () => {
    if (!edit?.id) return
    setSaving(true)
    try {
      const res = await api.patch(`/admin/categories/${edit.id}`, {
        name_az: edit.name_az,
        search_aliases: edit.search_aliases,
        is_popular: edit.is_popular,
      })
      if (res?.success) {
        toast('Kateqoriya yeniləndi', 'success')
        setEdit(null)
        await load()
      }
    } catch (e) {
      toast(e?.message || 'Saxlanılmadı', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Axtarış kateqoriyaları</h1>
        <p className="text-sm text-gray-400 mt-1 max-w-2xl leading-relaxed">
          Tələbə axtarışında görünən fənn adları və sinonimlər (məs. «data analysis» → Data Analitika). Yalnız
          real kateqoriyaları redaktə edin; virtual qovluqlara toxunmayın.
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kateqoriya axtar…"
          className={inp}
        />
        {loading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-white/10">
                  <th className="py-2 pr-3">Ad (AZ)</th>
                  <th className="py-2 pr-3">Sinonimlər</th>
                  <th className="py-2 pr-3">Populyar</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-white">{c.name_az}</div>
                      <div className="text-[11px] text-gray-500">
                        {c.parent_name_az ? `${c.parent_name_az} · ` : ''}
                        {c.id}
                        {c.is_virtual_category ? ' · virtual' : ''}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400 text-xs max-w-[240px] truncate">
                      {c.search_aliases || '—'}
                    </td>
                    <td className="py-2.5 pr-3">{c.is_popular ? '✓' : '—'}</td>
                    <td className="py-2.5 text-right">
                      {!c.is_virtual_category ? (
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Redaktə
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length ? (
              <p className="text-sm text-gray-500 py-4 text-center">Nəticə yoxdur</p>
            ) : null}
          </div>
        )}
      </Card>

      <Modal open={Boolean(edit)} onClose={() => setEdit(null)} title="Kateqoriya redaktə" size="md">
        {edit ? (
          <div className="space-y-4">
            {edit.parent_name_az ? (
              <p className="text-xs text-gray-500">
                Qrup: <span className="text-gray-300">{edit.parent_name_az}</span> · ID: {edit.id}
              </p>
            ) : null}
            <div>
              <label className={lbl}>Ad (Azərbaycan dilində)</label>
              <input
                className={inp}
                value={edit.name_az}
                onChange={(e) => setEdit((x) => ({ ...x, name_az: e.target.value }))}
              />
            </div>
            <div>
              <label className={lbl}>Axtarış sinonimləri</label>
              <textarea
                className={`${inp} min-h-[88px]`}
                value={edit.search_aliases}
                onChange={(e) => setEdit((x) => ({ ...x, search_aliases: e.target.value }))}
                placeholder="data analysis, data analitika, data analytics"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Vergüllə ayırın. Tələbə ingiliscə yazanda da bu kateqoriya tapılacaq.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={edit.is_popular}
                onChange={(e) => setEdit((x) => ({ ...x, is_popular: e.target.checked }))}
                className="accent-indigo-500 rounded"
              />
              Populyar siyahıda göstər
            </label>
            <div className="flex gap-2 pt-2">
              <Button type="button" loading={saving} onClick={() => void saveEdit()} className="flex-1 justify-center">
                Saxla
              </Button>
              <Button type="button" variant="secondary" onClick={() => setEdit(null)} className="flex-1 justify-center">
                Ləğv
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
