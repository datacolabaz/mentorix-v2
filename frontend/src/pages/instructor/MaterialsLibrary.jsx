import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { useToast } from '../../components/common/Toast'
import MaterialUploadModal from '../../components/instructor/MaterialUploadModal'
import MaterialsStorageBanner from '../../components/instructor/MaterialsStorageBanner'
import MaterialQrModal from '../../components/instructor/MaterialQrModal'
import MaterialLinkMenu from '../../components/instructor/MaterialLinkMenu'
import { materialFileKind, materialFileOpenUrl } from '../../lib/materialFileUrl'
import { materialShareUrlForRow } from '../../lib/materialShareUrl'
import { formatMaterialsBytes } from '../../lib/materialsPlanLimits'
import useUiStore from '../../hooks/useUi'
import { useTeachingFields } from '../../hooks/useTeachingFields'

function fileEmoji(material) {
  const kind = materialFileKind(material.file_type, material.file_url)
  if (kind === 'PDF') return '📄'
  if (kind === 'Word') return '📝'
  if (kind === 'Excel') return '📊'
  if (kind === 'PowerPoint') return '📽️'
  if (kind === 'Şəkil') return '🖼️'
  return '📎'
}

function usageLine(material) {
  const parts = []
  const exams = material.usage?.exam_count || 0
  const assignments = material.usage?.assignment_count || 0
  const views = material.view_count || 0
  if (exams > 0) parts.push(`${exams} imtahanda`)
  if (assignments > 0) parts.push(`${assignments} tapşırıqda`)
  if (views > 0) parts.push(`${views} baxış`)
  return parts.join(' · ')
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
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [qrMaterial, setQrMaterial] = useState(null)
  const [tagMaterial, setTagMaterial] = useState(null)
  const [tagInput, setTagInput] = useState('')
  const [tagSaving, setTagSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = search.trim()
      const listPath = q ? `/materials?q=${encodeURIComponent(q)}` : '/materials'
      const [listRes, quotaRes] = await Promise.all([api.get(listPath), api.get('/materials/quota')])
      if (listRes?.success) setMaterials(listRes.materials || [])
      if (quotaRes?.success) setQuota(quotaRes.quota)
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, search])

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const grouped = useMemo(() => {
    const bySubject = new Map()
    for (const m of materials) {
      const key = m.subject_name || m.group_name || 'Ümumi'
      if (!bySubject.has(key)) bySubject.set(key, [])
      bySubject.get(key).push(m)
    }
    return [...bySubject.entries()]
  }, [materials])

  const totalUsage = useMemo(() => {
    const exams = materials.reduce((s, m) => s + (m.usage?.exam_count || 0), 0)
    const views = materials.reduce((s, m) => s + (m.view_count || 0), 0)
    return { exams, views }
  }, [materials])

  const onUploadSuccess = (_material, nextQuota) => {
    if (nextQuota) setQuota(nextQuota)
    void load()
  }

  const copyShareLink = async (material) => {
    const url = materialShareUrlForRow(material)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('Paylaşım linki kopyalandı')
    } catch {
      toast(url, 'info')
    }
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

  const openTagEditor = (material) => {
    setTagMaterial(material)
    setTagInput((material.tags || []).map((t) => `#${t}`).join(' '))
  }

  const saveTags = async () => {
    if (!tagMaterial) return
    setTagSaving(true)
    try {
      const tags = tagInput.split(/[\s,#]+/).map((t) => t.trim()).filter(Boolean)
      const res = await api.patch(`/materials/${tagMaterial.id}`, { tags })
      if (res?.success) {
        toast('Tag-lar yeniləndi')
        setTagMaterial(null)
        void load()
      }
    } catch (e) {
      toast(e?.message || 'Saxlanmadı', 'error')
    } finally {
      setTagSaving(false)
    }
  }

  const onMaterialLinked = (updated) => {
    if (!updated?.id) {
      void load()
      return
    }
    setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
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
        onUpgrade={() => navigate('/instructor/settings?tab=plans')}
      />

      <MaterialQrModal open={Boolean(qrMaterial)} onClose={() => setQrMaterial(null)} material={qrMaterial} />

      <Modal open={Boolean(tagMaterial)} onClose={() => !tagSaving && setTagMaterial(null)} title="Tag-lar" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Boşluqla ayırın: #imtahan #python #9cuSinif</p>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white"
            placeholder="#imtahan #python"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTagMaterial(null)} disabled={tagSaving}>
              Ləğv et
            </Button>
            <Button onClick={() => void saveTags()} loading={tagSaving}>
              Saxla
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Kitabxana</h1>
          {quota ? (
            <p className="text-xs text-token-textMuted mt-1">
              {quota.labels?.used} / {quota.labels?.limit}
              {quota.usage?.file_count != null ? ` · ${quota.usage.file_count} fayl` : ''}
              {totalUsage.exams > 0 ? ` · ${totalUsage.exams} imtahanda istifadə` : ''}
              {totalUsage.views > 0 ? ` · ${totalUsage.views} baxış` : ''}
            </p>
          ) : null}
        </div>
        <Button onClick={() => setUploadOpen(true)} disabled={quota?.limit_reached}>
          Fayl yüklə
        </Button>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ad, tag və ya qrup ilə axtar…"
          className="flex-1 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 px-4 py-2.5 text-sm text-token-textMain outline-none focus:border-primary/40"
        />
      </div>

      <MaterialsStorageBanner quota={quota} onUpgrade={() => navigate('/instructor/settings?tab=plans')} />

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
          <p className="text-sm text-token-textMuted">{search.trim() ? 'Nəticə tapılmadı' : 'Hələ material yoxdur'}</p>
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
                        {usageLine(m) ? (
                          <p className="text-[10px] text-token-textMuted mt-1">{usageLine(m)}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(m.tags || []).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/90"
                            >
                              #{t}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => openTagEditor(m)}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-white/20 text-token-textMuted hover:text-primary"
                          >
                            + tag
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <a
                        href={materialFileOpenUrl(m.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-w-[4rem] text-center text-xs font-semibold py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/10"
                      >
                        Aç
                      </a>
                      <button
                        type="button"
                        onClick={() => void copyShareLink(m)}
                        className="px-3 py-2 rounded-lg text-xs text-token-textMain border border-[color:var(--border-subtle)] hover:bg-white/5"
                        title="WhatsApp və s. üçün link"
                      >
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrMaterial(m)}
                        className="px-3 py-2 rounded-lg text-xs text-token-textMain border border-[color:var(--border-subtle)] hover:bg-white/5"
                        title="QR kod"
                      >
                        QR
                      </button>
                      <MaterialLinkMenu material={m} onLinked={onMaterialLinked} />
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
