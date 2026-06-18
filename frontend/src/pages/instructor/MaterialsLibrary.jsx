import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import MaterialUploadModal from '../../components/instructor/MaterialUploadModal'
import MaterialsStorageBanner from '../../components/instructor/MaterialsStorageBanner'
import { materialFileKind, materialFileOpenUrl } from '../../lib/materialFileUrl'
import { formatMaterialsBytes } from '../../lib/materialsPlanLimits'
import useUiStore from '../../hooks/useUi'
import { groupsForField, useTeachingFields } from '../../hooks/useTeachingFields'

const selectCls =
  'w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard text-token-textMain px-3 py-2.5 text-sm cursor-pointer [color-scheme:dark] focus:outline-none focus:border-primary/50 disabled:opacity-50'

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
  const { theme } = useUiStore()
  const isDark = theme === 'dark'

  const { fields, allGroups, loading: fieldsLoading, error: fieldsError } = useTeachingFields()

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

  const filterableGroups = useMemo(() => {
    if (filterSubject) {
      const field = fields.find((f) => String(f.id) === String(filterSubject))
      return groupsForField(fields, filterSubject).map((g) => ({
        ...g,
        subject_id: field?.id,
        subject_name: field?.name,
      }))
    }
    return allGroups
  }, [fields, allGroups, filterSubject])

  useEffect(() => {
    if (!filterGroup) return
    const ok = filterableGroups.some((g) => String(g.id) === String(filterGroup))
    if (!ok) setFilterGroup('')
  }, [filterGroup, filterableGroups])

  const grouped = useMemo(() => {
    const bySubject = new Map()
    for (const m of materials) {
      const key = m.subject_name || m.group_name || 'Ümumi'
      if (!bySubject.has(key)) bySubject.set(key, [])
      bySubject.get(key).push(m)
    }
    return [...bySubject.entries()]
  }, [materials])

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

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
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
        onClose={() => setUploadOpen(false)}
        onSuccess={onUploadSuccess}
        quota={quota}
        fields={fields}
        fieldsLoading={fieldsLoading}
        presetSubjectId={filterSubject}
        presetGroupId={filterGroup}
        onUpgrade={() => navigate('/instructor/settings?tab=plans')}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Kitabxana</h1>
          {quota ? (
            <p className="text-xs text-token-textMuted mt-1">
              {quota.labels?.used} / {quota.labels?.limit}
              {quota.usage?.file_count != null ? ` · ${quota.usage.file_count} fayl` : ''}
            </p>
          ) : null}
        </div>
        <Button onClick={() => setUploadOpen(true)} disabled={quota?.limit_reached}>
          Fayl yüklə
        </Button>
      </div>

      <MaterialsStorageBanner quota={quota} onUpgrade={() => navigate('/instructor/settings?tab=plans')} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-xl">
        <div className="min-w-0">
          <label
            htmlFor="materials-filter-subject"
            className="block text-[10px] font-bold uppercase tracking-wide text-token-textMuted mb-1.5"
          >
            Sahə
          </label>
          <select
            id="materials-filter-subject"
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value)
              setFilterGroup('')
            }}
            disabled={fieldsLoading}
            className={selectCls}
          >
            <option value="">Hamısı</option>
            {fields.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor="materials-filter-group"
            className="block text-[10px] font-bold uppercase tracking-wide text-token-textMuted mb-1.5"
          >
            Qrup
          </label>
          <select
            id="materials-filter-group"
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            disabled={fieldsLoading || (Boolean(filterSubject) && !filterableGroups.length)}
            className={selectCls}
          >
            <option value="">Hamısı</option>
            {filterableGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {!filterSubject && g.subject_name ? `${g.subject_name} · ` : ''}
                {g.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fieldsError ? <p className="text-xs text-red-300/90">{fieldsError}</p> : null}
      {!fieldsLoading && !allGroups.length ? (
        <p className="text-xs text-amber-300/90">
          Hələ sahə və qrup yoxdur.{' '}
          <Link to="/instructor/teaching-groups" className="text-primary underline">
            Sahələr və qruplarda yaradın
          </Link>
        </p>
      ) : null}

      {loading ? (
        <div className="text-center py-16 text-token-textMuted text-sm">Yüklənir…</div>
      ) : !materials.length ? (
        <Card className="p-10 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-sm text-token-textMuted">Hələ material yoxdur</p>
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
    </div>
  )
}
