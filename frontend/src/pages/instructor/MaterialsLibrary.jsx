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
import { formatMaterialsBytes, materialsUsagePercent } from '../../lib/materialsPlanLimits'
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

function libraryInviteUrl(groupId) {
  if (typeof window === 'undefined') return `/library/${groupId}`
  return `${window.location.origin}/library/${groupId}`
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

  const shareGroups = useMemo(() => {
    if (filterGroup) {
      const g = allGroups.find((x) => String(x.id) === String(filterGroup))
      return g ? [g] : []
    }
    return filterableGroups
  }, [allGroups, filterGroup, filterableGroups])

  const selectedFilterGroup = useMemo(() => {
    if (!filterGroup) return null
    return shareGroups.find((g) => String(g.id) === String(filterGroup)) || null
  }, [filterGroup, shareGroups])

  const copyGroupLink = async (group) => {
    const url = libraryInviteUrl(group.id)
    try {
      await navigator.clipboard.writeText(url)
      toast(`«${group.name}» kitabxana linki kopyalandı`)
    } catch {
      toast(url, 'info')
    }
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
        onClose={() => setUploadOpen(false)}
        onSuccess={onUploadSuccess}
        quota={quota}
        fields={fields}
        fieldsLoading={fieldsLoading}
        presetSubjectId={filterSubject}
        presetGroupId={filterGroup}
        onUpgrade={() => navigate('/instructor/settings?tab=plans')}
      />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-primary">MATERİALLAR</p>
          <h1 className="font-display font-bold text-2xl text-token-textMain mt-1">Tədris materialları kitabxanası</h1>
          <p className="text-sm text-token-textMuted mt-1">
            PDF, Word, Excel və şəkillər — qrup üzvləri və linklə qoşulan qonaqlar görə bilər
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Yenilə
          </Button>
          <Button onClick={() => setUploadOpen(true)} disabled={quota?.limit_reached}>
            Fayl yüklə
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

      <Card className="p-4 sm:p-5 border border-[color:var(--border-subtle)] space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-token-textMain">Filtr</h2>
          <p className="text-xs text-token-textMuted mt-1">Profilinizdəki sahələr və qruplar</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full">
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
        {selectedFilterGroup ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 pt-1">
            <p className="text-[10px] text-token-textMuted/80 truncate font-mono flex-1 min-w-0">
              {libraryInviteUrl(selectedFilterGroup.id)}
            </p>
            <Button
              variant="secondary"
              className="shrink-0 text-xs w-full sm:w-auto"
              onClick={() => void copyGroupLink(selectedFilterGroup)}
            >
              Linki kopyala
            </Button>
          </div>
        ) : null}
        {fieldsError ? <p className="text-xs text-red-300/90">{fieldsError}</p> : null}
        {!fieldsLoading && !allGroups.length ? (
          <p className="text-xs text-amber-300/90">
            Hələ sahə və qrup yoxdur.{' '}
            <Link to="/instructor/teaching-groups" className="text-primary underline">
              Sahələr və qruplarda yaradın
            </Link>
          </p>
        ) : null}
      </Card>

      {!fieldsLoading && !filterGroup && shareGroups.length > 0 ? (
        <Card className="p-4 sm:p-5 border border-[color:var(--border-subtle)] space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-token-textMain">Qrup linki ilə giriş</h2>
            <p className="text-xs text-token-textMuted mt-1 leading-relaxed">
              Hər qrupun ayrıca linki var. Linki tələbəyə göndərin — CRM-də olmasa belə ad, soyad, e-poçt və
              telefonla qeydiyyat keçib yalnız həmin qrupun materiallarına baxa bilər.
            </p>
          </div>
          <div className="space-y-2">
            {shareGroups.map((g) => (
              <div
                key={g.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-[color:var(--border-subtle)] bg-black/10"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-token-textMain truncate">{g.name}</p>
                  {g.subject_name ? (
                    <p className="text-[11px] text-token-textMuted mt-0.5 truncate">Sahə: {g.subject_name}</p>
                  ) : null}
                  <p className="text-[10px] text-token-textMuted/80 mt-1 truncate font-mono">
                    {libraryInviteUrl(g.id)}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  className="shrink-0 text-xs"
                  onClick={() => void copyGroupLink(g)}
                >
                  Linki kopyala
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {loading ? (
        <div className="text-center py-16 text-token-textMuted text-sm">Yüklənir…</div>
      ) : !materials.length ? (
        <Card className="p-10 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">📁</div>
          <h2 className="font-display font-bold text-lg">Hələ material yoxdur</h2>
          <p className="text-sm text-token-textMuted mt-2 max-w-md mx-auto">
            Yuxarıdakı «Fayl yüklə» düyməsi ilə material əlavə edin — istəsəniz dərs və ya tapşırıqla da əlaqələndirə bilərsiniz.
          </p>
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

      <p className="text-xs text-token-textMuted">
        Video fayllar qəbul edilmir (yaddaş qənaəti).{' '}
        <Link to="/instructor/settings?tab=plans" className="text-primary hover:underline">
          Paket limitləri
        </Link>
      </p>
    </div>
  )
}
