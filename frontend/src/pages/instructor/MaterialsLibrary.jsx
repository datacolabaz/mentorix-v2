import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

function fileKindKey(kind) {
  if (kind === 'PDF') return 'pdf'
  if (kind === 'Word') return 'word'
  if (kind === 'Excel') return 'excel'
  if (kind === 'PowerPoint') return 'powerpoint'
  if (kind === 'Şəkil' || kind === 'Image') return 'image'
  if (kind === 'Fayl' || kind === 'File') return 'file'
  return 'file'
}

function fileEmoji(material) {
  const kind = materialFileKind(material.file_type, material.file_url)
  if (kind === 'PDF') return '📄'
  if (kind === 'Word') return '📝'
  if (kind === 'Excel') return '📊'
  if (kind === 'PowerPoint') return '📽️'
  if (kind === 'Şəkil' || kind === 'Image') return '🖼️'
  return '📎'
}

export default function InstructorMaterialsLibrary() {
  const { t } = useTranslation()
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
  const [openLinkMenuId, setOpenLinkMenuId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  const localizedFileKind = useCallback(
    (fileType, fileUrl) => {
      const raw = materialFileKind(fileType, fileUrl)
      return t(`materials.fileKinds.${fileKindKey(raw)}`, { defaultValue: raw })
    },
    [t],
  )

  const usageLine = useCallback(
    (material) => {
      const parts = []
      const exams = material.usage?.exam_count || 0
      const assignments = material.usage?.assignment_count || 0
      const views = material.view_count || 0
      if (exams > 0) parts.push(t('materials.usageExams', { count: exams }))
      if (assignments > 0) parts.push(t('materials.usageAssignments', { count: assignments }))
      if (views > 0) parts.push(t('materials.usageViews', { count: views }))
      return parts.join(' · ')
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = search.trim()
      const listPath = q ? `/materials?q=${encodeURIComponent(q)}` : '/materials'
      const [listRes, quotaRes] = await Promise.all([api.get(listPath), api.get('/materials/quota')])
      if (listRes?.success) setMaterials(listRes.materials || [])
      if (quotaRes?.success) setQuota(quotaRes.quota)
    } catch (e) {
      toast(e?.message || t('materials.toasts.loadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, search, t])

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  const grouped = useMemo(() => {
    const bySubject = new Map()
    for (const m of materials) {
      const key = m.subject_name || m.group_name || t('materials.general')
      if (!bySubject.has(key)) bySubject.set(key, [])
      bySubject.get(key).push(m)
    }
    return [...bySubject.entries()]
  }, [materials, t])

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
      toast(t('materials.toasts.linkCopied'))
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
        toast(t('materials.toasts.deleted'))
        if (res.quota) setQuota(res.quota)
        setDeleteTarget(null)
        void load()
      }
    } catch (e) {
      toast(e?.message || t('materials.toasts.deleteFailed'), 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const openTagEditor = (material) => {
    setTagMaterial(material)
    setTagInput((material.tags || []).map((tag) => `#${tag}`).join(' '))
  }

  const saveTags = async () => {
    if (!tagMaterial) return
    setTagSaving(true)
    try {
      const tags = tagInput.split(/[\s,#]+/).map((tag) => tag.trim()).filter(Boolean)
      const res = await api.patch(`/materials/${tagMaterial.id}`, { tags })
      if (res?.success) {
        toast(t('materials.toasts.tagsUpdated'))
        setTagMaterial(null)
        void load()
      }
    } catch (e) {
      toast(e?.message || t('materials.toasts.saveFailed'), 'error')
    } finally {
      setTagSaving(false)
    }
  }

  const startRename = (material) => {
    setRenamingId(material.id)
    setRenameValue(material.title || '')
  }

  const cancelRename = () => {
    if (renameSaving) return
    setRenamingId(null)
    setRenameValue('')
  }

  const saveRename = async (material) => {
    if (!material || renameSaving) return
    const title = renameValue.trim()
    if (!title) {
      toast(t('materials.toasts.titleRequired'), 'error')
      return
    }
    if (title === material.title) {
      cancelRename()
      return
    }
    setRenameSaving(true)
    try {
      const res = await api.patch(`/materials/${material.id}`, { title })
      if (res?.success) {
        toast(t('materials.toasts.titleUpdated'))
        setMaterials((prev) => prev.map((m) => (m.id === material.id ? { ...m, title } : m)))
        cancelRename()
      }
    } catch (e) {
      toast(e?.message || t('materials.toasts.saveFailed'), 'error')
    } finally {
      setRenameSaving(false)
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
        title={t('materials.deleteTitle')}
        message={deleteTarget ? t('materials.deleteConfirm', { title: deleteTarget.title }) : ''}
        confirmLabel={t('materials.delete')}
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

      <Modal open={Boolean(tagMaterial)} onClose={() => !tagSaving && setTagMaterial(null)} title={t('materials.tagsTitle')} size="sm">
        <div className="space-y-3">
          <p className="text-xs text-gray-400">{t('materials.tagsHint')}</p>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white"
            placeholder={t('materials.tagsPlaceholder')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTagMaterial(null)} disabled={tagSaving}>
              {t('materials.cancel')}
            </Button>
            <Button onClick={() => void saveTags()} loading={tagSaving}>
              {t('materials.save')}
            </Button>
          </div>
        </div>
      </Modal>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">{t('materials.title')}</h1>
          {quota ? (
            <p className="text-xs text-token-textMuted mt-1">
              {quota.labels?.used} / {quota.labels?.limit}
              {quota.usage?.file_count != null ? ` · ${t('materials.fileCount', { count: quota.usage.file_count })}` : ''}
              {totalUsage.exams > 0 ? ` · ${t('materials.usageInExams', { count: totalUsage.exams })}` : ''}
              {totalUsage.views > 0 ? ` · ${t('materials.usageViews', { count: totalUsage.views })}` : ''}
            </p>
          ) : null}
        </div>
        <Button onClick={() => setUploadOpen(true)} disabled={quota?.limit_reached}>
          {t('materials.upload')}
        </Button>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('materials.searchPlaceholder')}
          className="flex-1 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 px-4 py-2.5 text-sm text-token-textMain outline-none focus:border-primary/40"
        />
      </div>

      <MaterialsStorageBanner quota={quota} onUpgrade={() => navigate('/instructor/settings?tab=plans')} />

      {fieldsError ? <p className="text-xs text-red-300/90">{fieldsError}</p> : null}
      {!fieldsLoading && !allGroups.length ? (
        <p className="text-xs text-amber-300/90">
          {t('materials.noFields')}{' '}
          <Link to="/instructor/teaching-groups" className="text-primary underline">
            {t('materials.createInTeachingGroups')}
          </Link>
        </p>
      ) : null}

      {loading ? (
        <div className="text-center py-16 text-token-textMuted text-sm">{t('materials.loading')}</div>
      ) : !materials.length ? (
        <Card className="p-10 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-sm text-token-textMuted">{search.trim() ? t('materials.noResults') : t('materials.empty')}</p>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.flatMap(([subjectName, items]) => [
            <h2
              key={`heading-${subjectName}`}
              className="col-span-full text-xs font-bold uppercase tracking-wider text-token-textMuted pt-2 first:pt-0"
            >
              {subjectName}
            </h2>,
            ...items.map((m) => (
              <Card
                key={m.id}
                className={`p-4 border border-[color:var(--border-subtle)] hover:border-primary/30 transition-colors overflow-visible ${
                  openLinkMenuId === m.id ? 'relative z-[100]' : 'relative'
                } ${isDark ? 'bg-[#121212]/80' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">{fileEmoji(m)}</div>
                  <div className="flex-1 min-w-0">
                    {renamingId === m.id ? (
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveRename(m)
                            if (e.key === 'Escape') cancelRename()
                          }}
                          disabled={renameSaving}
                          className="flex-1 min-w-0 rounded-lg border border-primary/40 bg-token-surfaceCard/60 px-2 py-1 text-sm text-token-textMain outline-none focus:border-primary/60"
                          aria-label={t('materials.renameTitle')}
                        />
                        <button
                          type="button"
                          onClick={() => void saveRename(m)}
                          disabled={renameSaving}
                          className="shrink-0 px-2 py-1 rounded-lg text-[11px] font-semibold text-primary border border-primary/30 hover:bg-primary/10 disabled:opacity-50"
                        >
                          {t('materials.save')}
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          disabled={renameSaving}
                          className="shrink-0 px-2 py-1 rounded-lg text-[11px] text-token-textMuted border border-[color:var(--border-subtle)] hover:bg-white/5 disabled:opacity-50"
                        >
                          {t('materials.cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="group/title flex items-start gap-1 min-w-0">
                        <h3 className="font-semibold text-sm text-token-textMain truncate flex-1">{m.title}</h3>
                        <button
                          type="button"
                          onClick={() => startRename(m)}
                          className="shrink-0 p-1 rounded-md text-token-textMuted opacity-100 sm:opacity-0 sm:group-hover/title:opacity-100 hover:text-primary hover:bg-white/5 transition-opacity"
                          title={t('materials.rename')}
                          aria-label={t('materials.rename')}
                        >
                          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                      </div>
                    )}
                        <p className="text-[11px] text-token-textMuted mt-1">
                          {localizedFileKind(m.file_type, m.file_url)} · {formatMaterialsBytes(m.file_size)}
                        </p>
                        {m.group_name ? (
                          <p className="text-[11px] text-primary/90 mt-1 truncate">{t('materials.group', { name: m.group_name })}</p>
                        ) : null}
                        {usageLine(m) ? (
                          <p className="text-[10px] text-token-textMuted mt-1">{usageLine(m)}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(m.tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/90"
                            >
                              #{tag}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => openTagEditor(m)}
                            className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-white/20 text-token-textMuted hover:text-primary"
                          >
                            {t('materials.addTag')}
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
                        {t('materials.open')}
                      </a>
                      <button
                        type="button"
                        onClick={() => void copyShareLink(m)}
                        className="px-3 py-2 rounded-lg text-xs text-token-textMain border border-[color:var(--border-subtle)] hover:bg-white/5"
                        title={t('materials.linkTitle')}
                      >
                        {t('materials.link')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setQrMaterial(m)}
                        className="px-3 py-2 rounded-lg text-xs text-token-textMain border border-[color:var(--border-subtle)] hover:bg-white/5"
                        title={t('materials.qrTitle')}
                      >
                        {t('materials.qr')}
                      </button>
                      <MaterialLinkMenu
                        material={m}
                        onLinked={onMaterialLinked}
                        onOpenChange={(isOpen) => setOpenLinkMenuId(isOpen ? m.id : null)}
                      />
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(m)}
                        className="px-3 py-2 rounded-lg text-xs text-red-300 border border-red-500/25 hover:bg-red-500/10"
                      >
                        {t('materials.delete')}
                      </button>
                    </div>
                  </Card>
            )),
          ])}
        </div>
      )}
    </div>
  )
}
