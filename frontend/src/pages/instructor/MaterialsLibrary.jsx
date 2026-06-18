import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import MaterialUploadModal from '../../components/instructor/MaterialUploadModal'
import MaterialsStorageBanner from '../../components/instructor/MaterialsStorageBanner'
import { materialFileKind, materialFileOpenUrl } from '../../lib/materialFileUrl'
import { formatMaterialsBytes, materialsUsagePercent } from '../../lib/materialsPlanLimits'
import useUiStore from '../../hooks/useUi'

function fileEmoji(material) {
  const kind = materialFileKind(material.file_type, material.file_url)
  if (kind === 'PDF') return '📄'
  if (kind === 'Word') return '📝'
  if (kind === 'Excel') return '📊'
  if (kind === 'PowerPoint') return '📽️'
  if (kind === 'Şəkil') return '🖼️'
  return '📎'
}

export default function InstructorMaterialsLibrary() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  const [loading, setLoading] = useState(true)
  const [materials, setMaterials] = useState([])
  const [quota, setQuota] = useState(null)
  const [filterGroup, setFilterGroup] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterGroup) params.set('group_id', filterGroup)
      if (filterSubject) params.set('subject_id', filterSubject)
      const qs = params.toString()
      const [listRes, quotaRes] = await Promise.all([
        api.get(`/materials${qs ? `?${qs}` : ''}`),
        api.get('/materials/quota'),
      ])
      if (listRes?.success) setMaterials(listRes.materials || [])
      if (quotaRes?.success) setQuota(quotaRes.quota)
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterGroup, filterSubject, toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (location.pathname.endsWith('/upload')) setUploadOpen(true)
  }, [location.pathname])

  const subjects = useMemo(() => {
    const map = new Map()
    for (const m of materials) {
      if (m.subject_id && m.subject_name) map.set(m.subject_id, m.subject_name)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [materials])

  const groups = useMemo(() => {
    const map = new Map()
    for (const m of materials) {
      if (m.group_id && m.group_name) map.set(m.group_id, m.group_name)
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }))
  }, [materials])

  const grouped = useMemo(() => {
    const bySubject = new Map()
    for (const m of materials) {
      const key = m.subject_name || 'Ümumi'
      if (!bySubject.has(key)) bySubject.set(key, [])
      bySubject.get(key).push(m)
    }
    return [...bySubject.entries()]
  }, [materials])

  const openUpload = () => {
    navigate('/instructor/materials/upload')
    setUploadOpen(true)
  }

  const closeUpload = () => {
    setUploadOpen(false)
    if (location.pathname.endsWith('/upload')) navigate('/instructor/materials', { replace: true })
  }

  const onUploadSuccess = (_material, nextQuota) => {
    if (nextQuota) setQuota(nextQuota)
    void load()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      const res = await api.delete(`/materials/${deleteTarget.id}`)
      if (res?.success) {
        toast('Material silindi')
        if (res.quota) setQuota(res.quota)
        setDeleteTarget(null)
        void load()
      }
    } catch (e) {
      toast(e?.message || 'Silinmədi', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const usagePct = materialsUsagePercent(quota)

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Materialı sil"
        message={deleteTarget ? `«${deleteTarget.title}» silinsin?` : ''}
        confirmLabel="Sil"
        loading={deleteBusy}
        danger
      />

      <MaterialUploadModal
        open={uploadOpen}
        onClose={closeUpload}
        onSuccess={onUploadSuccess}
        quota={quota}
        onUpgrade={() => navigate('/instructor/settings?tab=plans')}
      />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">MATERİALLAR</p>
          <h1 className="font-display font-bold text-2xl text-token-textMain mt-1">Tədris materialları kitabxanası</h1>
          <p className="text-sm text-token-textMuted mt-1">
            PDF, Word, Excel və şəkillər — yalnız qrup üzvləri görə bilər
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Yenilə
          </Button>
          <Button onClick={openUpload} disabled={quota?.limit_reached}>
            📎 Fayl yüklə
          </Button>
        </div>
      </div>

      {quota ? (
        <Card className="p-4 sm:p-5 border border-[color:var(--border-subtle)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-xs text-token-textMuted">
                <span>
                  Yaddaş: {quota.labels?.used} / {quota.labels?.limit}
                </span>
                {quota.limits?.max_files != null ? (
                  <span>
                    Fayllar: {quota.usage?.file_count}/{quota.limits.max_files}
                  </span>
                ) : (
                  <span>{quota.usage?.file_count || 0} fayl</span>
                )}
              </div>
              {quota.limits?.storage_bytes != null ? (
                <div className="h-2 rounded-full bg-black/20 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usagePct >= 95 ? 'bg-amber-400' : 'bg-primary'}`}
                    style={{ width: `${Math.max(usagePct, 2)}%` }}
                  />
                </div>
              ) : null}
            </div>
            <p className="text-[11px] text-token-textMuted shrink-0">Tək fayl max 25 MB</p>
          </div>
        </Card>
      ) : null}

      <MaterialsStorageBanner quota={quota} onUpgrade={() => navigate('/instructor/settings?tab=plans')} />

      <div className="flex flex-wrap gap-2">
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
          className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm"
        >
          <option value="">Bütün fənnlər</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm"
        >
          <option value="">Bütün qruplar</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-token-textMuted text-sm">Yüklənir…</div>
      ) : !materials.length ? (
        <Card className="p-10 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">📁</div>
          <h2 className="font-display font-bold text-lg">Hələ material yoxdur</h2>
          <p className="text-sm text-token-textMuted mt-2 max-w-md mx-auto">
            İlk faylınızı yükləyin — qrup və ya tapşırıqla əlaqələndirə bilərsiniz.
          </p>
          <Button className="mt-4" onClick={openUpload} disabled={quota?.limit_reached}>
            Fayl yüklə
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(([subjectName, items]) => (
            <section key={subjectName} className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-token-textMuted">{subjectName}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <Card
                    key={m.id}
                    className={`p-4 border border-[color:var(--border-subtle)] hover:border-primary/30 transition-colors ${
                      isDark ? 'bg-[#121212]/80' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl shrink-0">{fileEmoji(m)}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-token-textMain truncate">{m.title}</h3>
                        <p className="text-[11px] text-token-textMuted mt-1">
                          {materialFileKind(m.file_type, m.file_url)} · {formatMaterialsBytes(m.file_size)}
                        </p>
                        {m.group_name ? (
                          <p className="text-[11px] text-primary/90 mt-1 truncate">Qrup: {m.group_name}</p>
                        ) : null}
                        {m.assignment_title ? (
                          <p className="text-[11px] text-violet-300/90 mt-0.5 truncate">Tapşırıq: {m.assignment_title}</p>
                        ) : null}
                        {m.lesson_number ? (
                          <p className="text-[11px] text-token-textMuted mt-0.5">Dərs #{m.lesson_number}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <a
                        href={materialFileOpenUrl(m.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center text-xs font-semibold py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                      >
                        Aç
                      </a>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(m)}
                        className="px-3 py-2 rounded-lg text-xs text-red-300 border border-red-500/25 hover:bg-red-500/10"
                      >
                        Sil
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-token-textMuted">
        Video fayllar qəbul edilmir (yaddaş qənaəti).{' '}
        <Link to="/instructor/settings?tab=plans" className="text-primary hover:underline">
          Paket limitləri
        </Link>
      </p>
    </div>
  )
}
