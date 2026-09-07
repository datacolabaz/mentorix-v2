import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import { useToast } from '../common/Toast'
import {
  MATERIALS_MAX_SINGLE_FILE_BYTES,
  MATERIALS_STORAGE_LIMIT_MESSAGE,
  isMaterialsQuotaFull,
} from '../../lib/materialsPlanLimits'
import MaterialsStorageBanner from './MaterialsStorageBanner'

function formatFileSize(bytes) {
  const n = Number(bytes)
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 1024) return `${n} B`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function isPdfFile(file) {
  if (!file) return false
  const type = String(file.type || '').toLowerCase()
  const name = String(file.name || '').toLowerCase()
  return type === 'application/pdf' || name.endsWith('.pdf')
}

async function normalizePickedFile(raw) {
  if (!raw) return null
  const name = raw.name || 'presentation.pdf'
  const type = raw.type || 'application/pdf'
  const lastModified = raw.lastModified || Date.now()
  try {
    const buf = await raw.arrayBuffer()
    if (!buf.byteLength) return null
    return new File([buf], name, { type, lastModified })
  } catch {
    return raw.size > 0 ? raw : null
  }
}

export default function PresentationUploadModal({
  open,
  onClose,
  onSuccess,
  quota: quotaProp,
  onUpgrade,
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [quota, setQuota] = useState(quotaProp || null)
  const [dragOver, setDragOver] = useState(false)
  const [pickingFile, setPickingFile] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState('')
  const [created, setCreated] = useState(null)

  useEffect(() => {
    if (open) setQuota(quotaProp || null)
  }, [open, quotaProp])

  const limitReached = isMaterialsQuotaFull(quota)

  const reset = useCallback(() => {
    setFile(null)
    setTitle('')
    setDragOver(false)
    setPickingFile(false)
    setUploading(false)
    setProgress(0)
    setFileError('')
    setCreated(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const closeModal = () => {
    if (uploading) return
    onClose?.()
    reset()
  }

  const pickFile = async (raw) => {
    setFileError('')
    if (!raw) return
    if (!isPdfFile(raw)) {
      setFile(null)
      setFileError(t('presentations.invalidFile'))
      return
    }
    if (raw.size > MATERIALS_MAX_SINGLE_FILE_BYTES) {
      setFile(null)
      setFileError(t('presentations.toasts.uploadFailed'))
      toast('Tək fayl ölçüsü 25 MB-dan çox ola bilməz.', 'error')
      return
    }
    setPickingFile(true)
    try {
      const normalized = await normalizePickedFile(raw)
      if (!normalized) {
        setFile(null)
        setFileError(t('presentations.emptyFile'))
        return
      }
      setFile(normalized)
      if (!title.trim()) setTitle(String(normalized.name || '').replace(/\.pdf$/i, ''))
    } finally {
      setPickingFile(false)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (limitReached || uploading) return
    const raw = e.dataTransfer.files?.[0]
    if (raw) void pickFile(raw)
  }

  const submit = async () => {
    if (!file) {
      setFileError(t('presentations.invalidFile'))
      return
    }
    if (limitReached) {
      toast(MATERIALS_STORAGE_LIMIT_MESSAGE, 'error')
      return
    }

    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('title', title.trim() || file.name.replace(/\.pdf$/i, ''))

    setUploading(true)
    setProgress(8)
    setFileError('')
    try {
      const res = await api.post('/presentations', fd, {
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.min(95, Math.round((ev.loaded / ev.total) * 100)))
        },
      })
      setProgress(100)
      if (res?.success && res.presentation) {
        setCreated(res.presentation)
        onSuccess?.(res.presentation, res.quota)
      } else {
        toast(res?.message || t('presentations.toasts.uploadFailed'), 'error')
      }
    } catch (e) {
      toast(e?.message || t('presentations.toasts.uploadFailed'), 'error')
      if (e?.quota) setQuota(e.quota)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={created ? t('presentations.uploadSuccess') : t('presentations.uploadTitle')}
      size="md"
      scrollBody
    >
      <div className="space-y-5">
        {created ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">«{created.title}» {t('presentations.uploadSuccess').toLowerCase()}.</p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="ghost" onClick={closeModal}>
                {t('presentations.close')}
              </Button>
              <Button onClick={() => onSuccess?.(created, quota, { open: true })}>
                {t('presentations.openNow')}
              </Button>
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
                fileError ? 'border-red-400/50' : '',
                limitReached || pickingFile ? 'opacity-50' : '',
              ].join(' ')}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={limitReached || uploading || pickingFile}
                onChange={(e) => {
                  const raw = e.target.files?.[0]
                  if (raw) void pickFile(raw)
                }}
              />
              {file ? (
                <div className="space-y-2">
                  <div className="text-3xl">📄</div>
                  <p className="text-sm font-medium text-white truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size) || '—'} · max 25 MB</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      setFileError('')
                      if (inputRef.current) inputRef.current.value = ''
                    }}
                    disabled={uploading || pickingFile}
                    className="text-xs text-gray-400 hover:text-white underline"
                  >
                    {t('presentations.changeFile')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-3xl">📄</div>
                  <p className="text-sm text-gray-300">
                    {pickingFile ? t('presentations.loading') : t('presentations.uploadHint')}
                  </p>
                  {!pickingFile && !limitReached ? (
                    <Button type="button" variant="secondary" className="text-xs" onClick={() => inputRef.current?.click()}>
                      {t('presentations.pickFile')}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            {fileError ? <p className="text-xs text-red-300/90">{fileError}</p> : null}

            {uploading ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{t('presentations.uploading')}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {t('presentations.nameLabel')}
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white outline-none focus:border-primary/50"
                placeholder={t('presentations.namePlaceholder')}
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeModal} disabled={uploading}>
                {t('presentations.cancel')}
              </Button>
              <Button onClick={() => void submit()} loading={uploading} disabled={!file || limitReached}>
                {t('presentations.new')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
