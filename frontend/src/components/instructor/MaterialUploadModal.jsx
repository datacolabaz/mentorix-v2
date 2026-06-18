import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import { useToast } from '../common/Toast'
import { groupsForField } from '../../hooks/useTeachingFields'
import {
  MATERIALS_MAX_SINGLE_FILE_BYTES,
  MATERIALS_STORAGE_LIMIT_MESSAGE,
  isMaterialsQuotaFull,
} from '../../lib/materialsPlanLimits'
import MaterialsStorageBanner from './MaterialsStorageBanner'

const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,application/pdf,image/*'

const SELECT_CLS =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white cursor-pointer [color-scheme:dark] focus:outline-none focus:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed'

function fileIcon(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('pdf')) return '📄'
  if (t.includes('word') || t.includes('msword')) return '📝'
  if (t.includes('excel') || t.includes('spreadsheet') || t.includes('csv')) return '📊'
  if (t.includes('powerpoint') || t.includes('presentation')) return '📽️'
  if (t.startsWith('image/')) return '🖼️'
  return '📎'
}

function formatFileSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1024) return `${n} B`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

async function normalizePickedFile(raw) {
  if (!raw) return null
  if (raw.size > 0) return raw

  const buf = await raw.arrayBuffer()
  if (!buf.byteLength) return null

  return new File([buf], raw.name, {
    type: raw.type || 'application/octet-stream',
    lastModified: raw.lastModified,
  })
}

export default function MaterialUploadModal({
  open,
  onClose,
  onSuccess,
  quota: quotaProp,
  onUpgrade,
  fields = [],
  fieldsLoading = false,
  presetSubjectId = '',
  presetGroupId = '',
}) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [quota, setQuota] = useState(quotaProp || null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [pickingFile, setPickingFile] = useState(false)

  const limitReached = isMaterialsQuotaFull(quota)
  const groupsInField = useMemo(() => groupsForField(fields, subjectId), [fields, subjectId])

  const presetGroup = useMemo(() => {
    if (!presetGroupId) return null
    for (const field of fields) {
      const group = (field.groups || []).find((g) => String(g.id) === String(presetGroupId))
      if (group) {
        return { ...group, subject_id: field.id, subject_name: field.name }
      }
    }
    return null
  }, [fields, presetGroupId])

  const presetSubject = useMemo(() => {
    if (presetGroup) {
      return fields.find((f) => String(f.id) === String(presetGroup.subject_id)) || null
    }
    if (!presetSubjectId) return null
    return fields.find((f) => String(f.id) === String(presetSubjectId)) || null
  }, [fields, presetGroup, presetSubjectId])

  const groupLocked = Boolean(presetGroupId && presetGroup)
  const subjectLocked = Boolean(presetSubject && !groupLocked)

  const resetForm = useCallback(() => {
    setFile(null)
    setTitle('')
    setSubjectId(presetSubject?.id ? String(presetSubject.id) : '')
    setGroupId(presetGroup?.id ? String(presetGroup.id) : '')
    setProgress(0)
    setDragOver(false)
    setPickingFile(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [presetGroup, presetSubject])

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }
    setSubjectId(presetSubject?.id ? String(presetSubject.id) : '')
    setGroupId(presetGroup?.id ? String(presetGroup.id) : '')
    setQuota(quotaProp || null)
    if (quotaProp) return
    void api
      .get('/materials/quota')
      .then((quotaRes) => {
        if (quotaRes?.success) setQuota(quotaRes.quota)
      })
      .catch(() => {})
  }, [open, presetGroup, presetSubject, quotaProp, resetForm])

  const pickFile = async (raw) => {
    if (!raw || pickingFile) return
    setPickingFile(true)
    try {
      const f = await normalizePickedFile(raw)
      if (!f) {
        toast('Fayl boşdur və ya oxunmadı — başqa fayl seçin', 'error')
        return
      }
      if (f.size > MATERIALS_MAX_SINGLE_FILE_BYTES) {
        toast('Tək fayl ölçüsü 25 MB-dan çox ola bilməz.', 'error')
        return
      }
      setFile(f)
      if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '') || f.name)
    } catch {
      toast('Fayl oxunmadı — yenidən seçin', 'error')
    } finally {
      setPickingFile(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (limitReached || pickingFile) return
    void pickFile(e.dataTransfer?.files?.[0])
  }

  const submit = async () => {
    if (!file) {
      toast('Fayl seçin', 'error')
      return
    }
    if (!file.size) {
      toast('Fayl boşdur — başqa fayl seçin', 'error')
      return
    }
    if (limitReached) {
      toast(MATERIALS_STORAGE_LIMIT_MESSAGE, 'error')
      return
    }

    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('title', title.trim() || file.name)
    if (subjectId) fd.append('subject_id', subjectId)
    if (groupId) fd.append('group_id', groupId)

    setUploading(true)
    setProgress(8)
    try {
      const res = await api.post('/materials', fd, {
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.min(95, Math.round((ev.loaded / ev.total) * 100)))
        },
      })
      setProgress(100)
      if (res?.success) {
        toast('Material yükləndi')
        onSuccess?.(res.material, res.quota)
        resetForm()
        onClose?.()
      } else {
        toast(res?.message || 'Yükləmə uğursuz', 'error')
      }
    } catch (e) {
      const msg = e?.message || 'Yükləmə uğursuz'
      toast(msg, 'error')
      if (e?.quota) setQuota(e.quota)
    } finally {
      setUploading(false)
    }
  }

  const fileSizeLabel = file ? formatFileSize(file.size) : null

  return (
    <Modal
      open={open}
      onClose={() => !uploading && onClose?.()}
      title="Fayl yüklə"
      size="lg"
      scrollBody
    >
      <div className="space-y-5">
        {limitReached ? <MaterialsStorageBanner quota={quota} onUpgrade={onUpgrade} /> : null}

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !limitReached && !pickingFile && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!limitReached) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !limitReached && !pickingFile && inputRef.current?.click()}
          className={[
            'rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
            dragOver ? 'border-primary bg-primary/10' : 'border-white/15 bg-white/[0.02]',
            limitReached || pickingFile ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50',
          ].join(' ')}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={limitReached || uploading || pickingFile}
            onChange={(e) => void pickFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="space-y-2">
              <div className="text-3xl">{fileIcon(file.type)}</div>
              <p className="text-sm font-medium text-white truncate">{file.name}</p>
              <p className="text-xs text-gray-400">
                {fileSizeLabel || '—'} · max 25 MB
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">📎</div>
              <p className="text-sm text-gray-300">
                {pickingFile ? 'Fayl oxunur…' : 'Faylı buraya sürüşdürün və ya klikləyin'}
              </p>
              <p className="text-xs text-gray-500">PDF, Word, Excel, PowerPoint, şəkil (video yox)</p>
            </div>
          )}
        </div>

        {uploading ? (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Yüklənir…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2 space-y-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Başlıq</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark]"
              placeholder="Material adı"
            />
          </label>

          {groupLocked ? (
            <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Yükləmə hədəfi</p>
              <p className="text-sm text-white mt-1">
                {presetGroup.name}
                {presetGroup.subject_name ? (
                  <span className="text-gray-400"> · {presetGroup.subject_name}</span>
                ) : null}
              </p>
            </div>
          ) : (
            <>
              {!subjectLocked ? (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sahə</span>
                  <select
                    value={subjectId}
                    onChange={(e) => {
                      setSubjectId(e.target.value)
                      setGroupId('')
                    }}
                    disabled={uploading || fieldsLoading}
                    className={SELECT_CLS}
                  >
                    <option value="">— Seçin —</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Sahə</p>
                  <p className="text-sm text-white mt-1">{presetSubject.name}</p>
                </div>
              )}

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Qrup</span>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  disabled={uploading || fieldsLoading || !subjectId}
                  className={SELECT_CLS}
                >
                  {!subjectId ? (
                    <option value="">Əvvəlcə sahə seçin</option>
                  ) : !groupsInField.length ? (
                    <option value="">Bu sahədə qrup yoxdur</option>
                  ) : (
                    <>
                      <option value="">— Seçin —</option>
                      {groupsInField.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </label>
            </>
          )}
        </div>

        {!fieldsLoading && !fields.length ? (
          <p className="text-xs text-amber-300/90">
            Hələ sahə və qrup yaratmamısınız. Əvvəlcə «Sahələr və qruplar» bölməsində yaradın.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={() => onClose?.()} disabled={uploading}>
            Ləğv et
          </Button>
          <Button onClick={() => void submit()} disabled={!file || uploading || pickingFile || limitReached}>
            {uploading ? 'Yüklənir…' : 'Saxla'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
