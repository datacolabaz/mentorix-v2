import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import { useToast } from '../common/Toast'
import { groupsForField } from '../../hooks/useTeachingFields'
import { groupLibraryShareUrl, materialShareUrl } from '../../lib/materialShareUrl'
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

  const name = raw.name || 'material'
  const type = raw.type || 'application/octet-stream'
  const lastModified = raw.lastModified || Date.now()

  if (raw.size > 0) {
    try {
      const buf = await raw.arrayBuffer()
      if (buf.byteLength > 0) {
        return new File([buf], name, { type, lastModified })
      }
    } catch {
      // Fall back to the original File when the browser still exposes bytes via upload.
    }
    return raw
  }

  try {
    const buf = await raw.arrayBuffer()
    if (!buf.byteLength) return null
    return new File([buf], name, { type, lastModified })
  } catch {
    return null
  }
}

function buildShareLinks({ material, forGroupStudents, shareExternalLink }) {
  const links = []
  if (shareExternalLink && material?.id) {
    links.push({
      label: 'Xarici tələbə linki',
      url: materialShareUrl(material.id),
    })
  }
  if (forGroupStudents && material?.group_id) {
    links.push({
      label: 'Qrup kitabxanası linki',
      url: groupLibraryShareUrl(material.group_id),
    })
  }
  return links
}

export default function MaterialUploadModal({
  open,
  onClose,
  onSuccess,
  quota: quotaProp,
  onUpgrade,
  fields = [],
  fieldsLoading = false,
}) {
  const toast = useToast()
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const ignoreInputChangeRef = useRef(false)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [forGroupStudents, setForGroupStudents] = useState(true)
  const [shareExternalLink, setShareExternalLink] = useState(true)
  const [subjectId, setSubjectId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [quota, setQuota] = useState(quotaProp || null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [pickingFile, setPickingFile] = useState(false)
  const [shareResult, setShareResult] = useState(null)
  const [tags, setTags] = useState('')

  const limitReached = isMaterialsQuotaFull(quota)
  const groupsInField = useMemo(() => groupsForField(fields, subjectId), [fields, subjectId])

  const resetForm = useCallback(() => {
    fileRef.current = null
    setFile(null)
    setTitle('')
    setForGroupStudents(true)
    setShareExternalLink(true)
    setSubjectId('')
    setGroupId('')
    setProgress(0)
    setDragOver(false)
    setPickingFile(false)
    setShareResult(null)
    setTags('')
    resetFileInput()
  }, [])

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }
    setQuota(quotaProp || null)
    if (quotaProp) return
    void api
      .get('/materials/quota')
      .then((quotaRes) => {
        if (quotaRes?.success) setQuota(quotaRes.quota)
      })
      .catch(() => {})
  }, [open, quotaProp, resetForm])

  const resetFileInput = () => {
    const input = inputRef.current
    if (!input) return
    ignoreInputChangeRef.current = true
    input.value = ''
    ignoreInputChangeRef.current = false
  }

  const pickFile = async (raw) => {
    if (!raw) return
    if (pickingFile) return
    setPickingFile(true)
    try {
      const f = await normalizePickedFile(raw)
      if (!f) {
        fileRef.current = null
        setFile(null)
        resetFileInput()
        toast('Fayl boşdur və ya oxunmadı — başqa fayl seçin', 'error')
        return
      }
      if (f.size > MATERIALS_MAX_SINGLE_FILE_BYTES) {
        resetFileInput()
        toast('Tək fayl ölçüsü 25 MB-dan çox ola bilməz.', 'error')
        return
      }
      fileRef.current = f
      setFile(f)
      setTitle((prev) => prev.trim() || f.name.replace(/\.[^.]+$/, '') || f.name)
      resetFileInput()
    } catch {
      fileRef.current = null
      setFile(null)
      resetFileInput()
      toast('Fayl oxunmadı — yenidən seçin', 'error')
    } finally {
      setPickingFile(false)
    }
  }

  const clearPickedFile = () => {
    fileRef.current = null
    setFile(null)
    resetFileInput()
  }

  const resolveUploadFile = async () => {
    let candidate = fileRef.current || file
    if (!candidate) return null
    if (!candidate.size) {
      candidate = await normalizePickedFile(candidate)
    }
    if (!candidate?.size) return null
    fileRef.current = candidate
    setFile(candidate)
    return candidate
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (limitReached || pickingFile) return
    void pickFile(e.dataTransfer?.files?.[0])
  }

  const copyLink = async (url) => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast('Link kopyalandı')
    } catch {
      toast(url, 'info')
    }
  }

  const closeModal = () => {
    if (uploading) return
    resetForm()
    onClose?.()
  }

  const submit = async () => {
    if (uploading || pickingFile) return

    let uploadFile
    try {
      uploadFile = await resolveUploadFile()
    } catch {
      clearPickedFile()
      toast('Fayl oxunmadı — yenidən seçin', 'error')
      return
    }

    if (!uploadFile) {
      toast('Əvvəlcə fayl seçin', 'error')
      return
    }
    if (!uploadFile.size) {
      clearPickedFile()
      toast('Fayl boşdur — yenidən seçin', 'error')
      return
    }
    if (!forGroupStudents && !shareExternalLink) {
      toast('Ən azı bir paylaşım növü seçin', 'error')
      return
    }
    if (forGroupStudents) {
      if (!subjectId) {
        toast('Sahə seçin', 'error')
        return
      }
      if (!groupId) {
        toast('Qrup seçin', 'error')
        return
      }
    }
    if (limitReached) {
      toast(MATERIALS_STORAGE_LIMIT_MESSAGE, 'error')
      return
    }

    const fd = new FormData()
    fd.append('file', uploadFile, uploadFile.name)
    fd.append('title', title.trim() || uploadFile.name)
    if (forGroupStudents) {
      fd.append('subject_id', subjectId)
      fd.append('group_id', groupId)
    }
    if (tags.trim()) {
      fd.append('tags', tags.trim())
    }

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
        onSuccess?.(res.material, res.quota)
        const material = res.material
        const links = buildShareLinks({ material, forGroupStudents, shareExternalLink })
        setShareResult({
          title: material?.title || title,
          links,
        })
        clearPickedFile()
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
      onClose={closeModal}
      title={shareResult ? 'Material yükləndi' : 'Fayl yüklə'}
      size="lg"
      scrollBody
    >
      <div className="space-y-5">
        {shareResult ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              «{shareResult.title}» yükləndi.
              {shareResult.links?.length
                ? ' Linkləri WhatsApp və ya digər kanallarda paylaşa bilərsiniz.'
                : ' Qrup tələbələri materialı kitabxanada görə bilər.'}
            </p>
            {shareResult.links?.length ? (
              <div className="space-y-2">
                {shareResult.links.map((link) => (
                  <div
                    key={link.url}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 space-y-2"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{link.label}</p>
                    <p className="text-xs text-gray-300 break-all font-mono">{link.url}</p>
                    <Button variant="secondary" className="text-xs" onClick={() => void copyLink(link.url)}>
                      Kopyala
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={closeModal}>Bağla</Button>
            </div>
          </div>
        ) : (
          <>
            {limitReached ? <MaterialsStorageBanner quota={quota} onUpgrade={onUpgrade} /> : null}

            <div
              role="presentation"
              onDragOver={(e) => {
                e.preventDefault()
                if (!limitReached) setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={[
                'rounded-2xl border-2 border-dashed p-8 text-center transition-colors',
                dragOver ? 'border-primary bg-primary/10' : 'border-white/15 bg-white/[0.02]',
                !file && title.trim() ? 'border-amber-500/40' : '',
                limitReached || pickingFile ? 'opacity-50' : '',
              ].join(' ')}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                disabled={limitReached || uploading || pickingFile}
                onChange={(e) => {
                  if (ignoreInputChangeRef.current) return
                  const raw = e.target.files?.[0]
                  if (!raw) return
                  void pickFile(raw)
                }}
              />
              {file ? (
                <div className="space-y-2">
                  <div className="text-3xl">{fileIcon(file.type)}</div>
                  <p className="text-sm font-medium text-white truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{fileSizeLabel || '—'} · max 25 MB</p>
                  <button
                    type="button"
                    onClick={clearPickedFile}
                    disabled={uploading || pickingFile}
                    className="text-xs text-gray-400 hover:text-white underline"
                  >
                    Başqa fayl seç
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-3xl">📎</div>
                  <p className="text-sm text-gray-300">
                    {pickingFile ? 'Fayl oxunur…' : 'Material yükləmək üçün fayl seçin'}
                  </p>
                  <p className="text-xs text-gray-500">PDF, Word, Excel, PowerPoint, şəkil (video yox)</p>
                  {!pickingFile && !limitReached ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      onClick={() => inputRef.current?.click()}
                    >
                      Fayl seç
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            {!file && title.trim() ? (
              <p className="text-xs text-amber-300/90">Başlıq var, amma fayl seçilməyib — əvvəlcə fayl əlavə edin.</p>
            ) : null}

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

            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Kim üçün</p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 rounded-xl border border-white/10 px-3 py-2.5 cursor-pointer hover:border-white/20">
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={forGroupStudents}
                    onChange={(e) => setForGroupStudents(e.target.checked)}
                    disabled={uploading}
                  />
                  <span>
                    <span className="block text-sm text-white">Qrup tələbəsi</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Sahə və qrup seçin — daxili tələbələr görəcək</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-white/10 px-3 py-2.5 cursor-pointer hover:border-white/20">
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={shareExternalLink}
                    onChange={(e) => setShareExternalLink(e.target.checked)}
                    disabled={uploading}
                  />
                  <span>
                    <span className="block text-sm text-white">Xarici tələbə (link)</span>
                    <span className="block text-xs text-gray-500 mt-0.5">CRM-də olmayan üçün paylaşım linki</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2" onClick={(e) => e.stopPropagation()}>
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

              <label className="block sm:col-span-2 space-y-1.5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tag-lar (opsional)</span>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  disabled={uploading}
                  className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                  placeholder="#imtahan #python #9cuSinif"
                />
              </label>

              {forGroupStudents ? (
                <>
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
              ) : (
                <p className="sm:col-span-2 text-xs text-gray-500 leading-relaxed">
                  Yalnız xarici link seçildi — material qrupa bağlanmayacaq, yüklədikdən sonra fərdi link alacaqsınız.
                </p>
              )}
            </div>

            {!fieldsLoading && !fields.length && forGroupStudents ? (
              <p className="text-xs text-amber-300/90">
                Hələ sahə və qrup yaratmamısınız. Əvvəlcə «Sahələr və qruplar» bölməsində yaradın.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2 justify-end pt-2">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={uploading}>
                Ləğv et
              </Button>
              <Button
                type="button"
                onClick={() => void submit()}
                disabled={uploading || pickingFile || limitReached}
                loading={uploading}
              >
                {uploading ? 'Yüklənir…' : 'Saxla'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
