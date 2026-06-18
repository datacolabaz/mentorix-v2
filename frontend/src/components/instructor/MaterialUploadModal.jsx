import { useCallback, useEffect, useRef, useState } from 'react'
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

const ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,application/pdf,image/*'

function fileIcon(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('pdf')) return '📄'
  if (t.includes('word') || t.includes('msword')) return '📝'
  if (t.includes('excel') || t.includes('spreadsheet') || t.includes('csv')) return '📊'
  if (t.includes('powerpoint') || t.includes('presentation')) return '📽️'
  if (t.startsWith('image/')) return '🖼️'
  return '📎'
}

export default function MaterialUploadModal({ open, onClose, onSuccess, quota: quotaProp, onUpgrade }) {
  const toast = useToast()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [options, setOptions] = useState({ groups: [], lessons: [], assignments: [] })
  const [quota, setQuota] = useState(quotaProp || null)
  const [loadingOpts, setLoadingOpts] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const limitReached = isMaterialsQuotaFull(quota)

  const resetForm = useCallback(() => {
    setFile(null)
    setTitle('')
    setGroupId('')
    setLessonId('')
    setAssignmentId('')
    setProgress(0)
    setDragOver(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }
    setQuota(quotaProp || null)
    setLoadingOpts(true)
    Promise.all([
      api.get('/materials/options'),
      quotaProp ? Promise.resolve(null) : api.get('/materials/quota'),
    ])
      .then(([optRes, quotaRes]) => {
        if (optRes?.success) setOptions(optRes.options || { groups: [], lessons: [], assignments: [] })
        if (quotaRes?.success) setQuota(quotaRes.quota)
      })
      .catch(() => toast('Seçimlər yüklənmədi', 'error'))
      .finally(() => setLoadingOpts(false))
  }, [open, quotaProp, resetForm, toast])

  const pickFile = (f) => {
    if (!f) return
    if (f.size > MATERIALS_MAX_SINGLE_FILE_BYTES) {
      toast('Tək fayl ölçüsü 25 MB-dan çox ola bilməz.', 'error')
      return
    }
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '') || f.name)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (limitReached) return
    pickFile(e.dataTransfer?.files?.[0])
  }

  const submit = async () => {
    if (!file) {
      toast('Fayl seçin', 'error')
      return
    }
    if (limitReached) {
      toast(MATERIALS_STORAGE_LIMIT_MESSAGE, 'error')
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title.trim() || file.name)
    if (groupId) fd.append('group_id', groupId)
    if (lessonId) fd.append('enrollment_lesson_id', lessonId)
    if (assignmentId) fd.append('assignment_id', assignmentId)

    const selectedGroup = options.groups.find((g) => String(g.id) === String(groupId))
    if (selectedGroup?.subject_id) fd.append('subject_id', selectedGroup.subject_id)

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

  const filteredLessons = groupId
    ? options.lessons.filter((l) => String(l.group_id) === String(groupId))
    : options.lessons

  const filteredAssignments = groupId
    ? options.assignments.filter((a) => !a.group_id || String(a.group_id) === String(groupId))
    : options.assignments

  return (
    <Modal open={open} onClose={() => !uploading && onClose?.()} title="Fayl yüklə" size="lg">
      <div className="space-y-5">
        {limitReached ? <MaterialsStorageBanner quota={quota} onUpgrade={onUpgrade} /> : null}

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !limitReached && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!limitReached) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !limitReached && inputRef.current?.click()}
          className={[
            'rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer',
            dragOver ? 'border-primary bg-primary/10' : 'border-white/15 bg-white/[0.02]',
            limitReached ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50',
          ].join(' ')}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={limitReached || uploading}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <div className="space-y-2">
              <div className="text-3xl">{fileIcon(file.type)}</div>
              <p className="text-sm font-medium text-white truncate">{file.name}</p>
              <p className="text-xs text-gray-400">{(file.size / (1024 * 1024)).toFixed(2)} MB · max 25 MB</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl">📎</div>
              <p className="text-sm text-gray-300">Faylı buraya sürüşdürün və ya klikləyin</p>
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
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              placeholder="Material adı"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Qrup (ixtiyari)</span>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value)
                setLessonId('')
              }}
              disabled={uploading || loadingOpts}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            >
              <option value="">— Seçilməyib —</option>
              {options.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.subject_name ? `${g.subject_name} · ` : ''}
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dərs (ixtiyari)</span>
            <select
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              disabled={uploading || loadingOpts || !filteredLessons.length}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            >
              <option value="">— Seçilməyib —</option>
              {filteredLessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.group_name ? `${l.group_name} · ` : ''}Dərs #{l.lesson_number}
                </option>
              ))}
            </select>
          </label>

          <label className="block sm:col-span-2 space-y-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tapşırıq (ixtiyari)</span>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              disabled={uploading || loadingOpts}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
            >
              <option value="">— Seçilməyib —</option>
              {filteredAssignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={() => onClose?.()} disabled={uploading}>
            Ləğv et
          </Button>
          <Button onClick={submit} disabled={!file || uploading || limitReached}>
            {uploading ? 'Yüklənir…' : 'Yüklə'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
