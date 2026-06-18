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
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [lessons, setLessons] = useState([])
  const [assignments, setAssignments] = useState([])
  const [quota, setQuota] = useState(quotaProp || null)
  const [loadingExtras, setLoadingExtras] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const limitReached = isMaterialsQuotaFull(quota)
  const groupsInField = useMemo(() => groupsForField(fields, subjectId), [fields, subjectId])

  const resetForm = useCallback(() => {
    setFile(null)
    setTitle('')
    setSubjectId('')
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
    setLoadingExtras(true)
    Promise.all([
      api.get('/materials/options'),
      quotaProp ? Promise.resolve(null) : api.get('/materials/quota'),
    ])
      .then(([optRes, quotaRes]) => {
        const opts = optRes?.options || {}
        setLessons(Array.isArray(opts.lessons) ? opts.lessons : [])
        setAssignments(Array.isArray(opts.assignments) ? opts.assignments : [])
        if (quotaRes?.success) setQuota(quotaRes.quota)
      })
      .catch(() => toast('Dərs və tapşırıq siyahısı yüklənmədi', 'error'))
      .finally(() => setLoadingExtras(false))
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
    if (subjectId) fd.append('subject_id', subjectId)
    if (groupId) fd.append('group_id', groupId)
    if (lessonId) fd.append('enrollment_lesson_id', lessonId)
    if (assignmentId) fd.append('assignment_id', assignmentId)

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
    ? lessons.filter((l) => String(l.group_id) === String(groupId))
    : []

  const filteredAssignments = groupId
    ? assignments.filter((a) => !a.group_id || String(a.group_id) === String(groupId))
    : assignments

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
              className="w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white [color-scheme:dark]"
              placeholder="Material adı"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sahə</span>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value)
                setGroupId('')
                setLessonId('')
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
              onChange={(e) => {
                setGroupId(e.target.value)
                setLessonId('')
              }}
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

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Dərs (ixtiyari)</span>
            <select
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              disabled={uploading || loadingExtras || !groupId}
              className={SELECT_CLS}
            >
              {!groupId ? (
                <option value="">Əvvəlcə qrup seçin</option>
              ) : !filteredLessons.length ? (
                <option value="">Bu qrupda planlaşdırılmış dərs yoxdur</option>
              ) : (
                <>
                  <option value="">— Seçilməyib —</option>
                  {filteredLessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      Dərs #{l.lesson_number}
                      {l.starts_at ? ` · ${new Date(l.starts_at).toLocaleDateString('az-AZ')}` : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Tapşırıq (ixtiyari)</span>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              disabled={uploading || loadingExtras}
              className={SELECT_CLS}
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

        {!fieldsLoading && !fields.length ? (
          <p className="text-xs text-amber-300/90">
            Hələ sahə və qrup yaratmamısınız. Əvvəlcə «Sahələr və qruplar» bölməsində yaradın.
          </p>
        ) : null}

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
