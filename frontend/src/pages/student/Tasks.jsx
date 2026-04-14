import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import 'katex/dist/katex.min.css'

function fmtDue(d) {
  if (!d) return ''
  return String(d).slice(0, 10)
}

function fmtCreated(iso) {
  if (!iso) return ''
  const s = String(iso)
  const d = s.slice(0, 10)
  const t = s.slice(11, 16)
  return t ? `${d} ${t}` : d
}

export default function StudentAssignments() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [err, setErr] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const toast = useToast()

  const [openId, setOpenId] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailErr, setDetailErr] = useState(null)
  const [detail, setDetail] = useState(null)
  const [editorHtml, setEditorHtml] = useState('')
  const [attachments, setAttachments] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get('/tasks/my')
      setTasks(Array.isArray(d.tasks) ? d.tasks : [])
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ color: [] }, { background: [] }],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['blockquote', 'code-block'],
        ['link', 'formula'],
        ['clean'],
      ],
    }),
    []
  )

  const openWorkspace = async (assignmentId) => {
    setOpenId(assignmentId)
    setDetail(null)
    setEditorHtml('')
    setAttachments([])
    setDetailErr(null)
    setDetailLoading(true)
    try {
      const d = await api.get('/tasks/assignments/' + encodeURIComponent(assignmentId))
      const a = d.assignment
      setDetail(a)
      setEditorHtml(a?.answer_text || '')
      setAttachments(Array.isArray(a?.attachment_urls) ? a.attachment_urls : [])
    } catch (e) {
      setDetailErr(e?.message || 'Yüklənmədi')
    } finally {
      setDetailLoading(false)
    }
  }

  const locked = Boolean(detail?.submitted_at) || detail?.status === 'completed'

  const saveDraft = async () => {
    if (!openId) return
    setBusyId('draft')
    try {
      const d = await api.patch('/tasks/assignments/' + encodeURIComponent(openId) + '/draft', {
        answer_text: editorHtml,
        attachment_urls: attachments,
      })
      setDetail((p) => ({ ...(p || {}), ...(d.assignment || {}) }))
      toast('Qaralama saxlanıldı', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const submitWork = async () => {
    if (!openId) return
    if (!window.confirm('Təslim edilsin? Təslim etdikdən sonra dəyişiklik etmək mümkün olmayacaq.')) return
    setBusyId('submit')
    try {
      const d = await api.patch('/tasks/assignments/' + encodeURIComponent(openId) + '/submit', {
        answer_text: editorHtml,
        attachment_urls: attachments,
      })
      setDetail((p) => ({ ...(p || {}), ...(d.assignment || {}), status: 'completed' }))
      toast('Təslim edildi', 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const uploadFiles = async (files) => {
    const list = Array.from(files || [])
    if (!list.length) return
    setBusyId('upload')
    try {
      const next = [...attachments]
      for (const f of list) {
        const fd = new FormData()
        fd.append('file', f)
        const r = await api.post('/tasks/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        if (r?.url) next.push(r.url)
      }
      setAttachments(next)
      toast('Fayl yükləndi', 'success')
    } catch (e) {
      toast(e?.message || 'Fayl yüklənmədi', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const removeAttachment = (url) => {
    setAttachments((p) => p.filter((x) => x !== url))
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Tapşırıqlarım</h1>
          <p className="text-gray-500 text-sm mt-1">Müəllimin sizə göndərdiyi tapşırıqlar.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          Yenilə
        </Button>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">
          {err}
        </Card>
      )}

      {loading ? (
        <Card className="p-5 text-sm text-gray-500">Yüklənir…</Card>
      ) : tasks.length === 0 ? (
        <Card className="p-5 text-sm text-gray-500">Hələ tapşırıq yoxdur.</Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => {
            const done = t.status === 'completed'
            return (
              <Card key={t.assignment_id} className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-semibold break-words">{t.title}</p>
                    {t.topic ? (
                      <p className="text-sm text-indigo-200/90 mt-1 break-words">Mövzu: {t.topic}</p>
                    ) : null}
                    <p className="text-xs text-gray-500 mt-1">
                      Müəllim: <span className="text-gray-300">{t.instructor_name}</span>
                      {t.assignment_created_at ? (
                        <>
                          {' '}
                          · Yaradılıb:{' '}
                          <span className="text-gray-300 font-mono">{fmtCreated(t.assignment_created_at)}</span>
                        </>
                      ) : null}
                      {t.due_date ? (
                        <>
                          {' '}
                          · Son tarix: <span className="text-gray-300 font-mono">{fmtDue(t.due_date)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={[
                        'text-xs font-bold px-2.5 py-1 rounded-lg border',
                        done
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                          : 'bg-indigo-500/15 border-indigo-400/35 text-indigo-200',
                      ].join(' ')}
                    >
                      {done ? 'Bitirdi' : 'Gözləyir'}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => void openWorkspace(t.assignment_id)}>
                      Aç
                    </Button>
                  </div>
                </div>
                {t.description ? (
                  <div className="mt-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed border-t border-indigo-500/15 pt-3">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Müəllim qeydi</span>
                    <div className="mt-1">{t.description}</div>
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={Boolean(openId)}
        onClose={() => (busyId ? null : setOpenId(null))}
        title={detail?.title ? `Tapşırıq — ${detail.title}` : 'Tapşırıq'}
        size="xl"
      >
        {detailLoading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : detailErr ? (
          <p className="text-sm text-amber-200/90">{detailErr}</p>
        ) : detail ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/50 p-3">
              <p className="text-sm text-white font-semibold break-words">{detail.title}</p>
              {detail.topic ? <p className="text-sm text-indigo-200/90 mt-1">Mövzu: {detail.topic}</p> : null}
              <p className="text-xs text-gray-500 mt-1">
                Müəllim: <span className="text-gray-300">{detail.instructor_name}</span>
                {detail.assignment_created_at ? (
                  <>
                    {' '}
                    · Yaradılıb: <span className="text-gray-300 font-mono">{fmtCreated(detail.assignment_created_at)}</span>
                  </>
                ) : null}
                {detail.due_date ? (
                  <>
                    {' '}
                    · Son tarix: <span className="text-gray-300 font-mono">{fmtDue(detail.due_date)}</span>
                  </>
                ) : null}
                {detail.submitted_at ? (
                  <>
                    {' '}
                    · Təslim: <span className="text-gray-300 font-mono">{fmtCreated(detail.submitted_at)}</span>
                  </>
                ) : null}
              </p>
              {detail.description ? (
                <div className="mt-3 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Müəllim qeydi</span>
                  <div className="mt-1">{detail.description}</div>
                </div>
              ) : null}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cavab</p>
              <div className={locked ? 'opacity-95 pointer-events-none' : ''}>
                <ReactQuill theme="snow" value={editorHtml} onChange={setEditorHtml} modules={quillModules} />
              </div>
              {locked ? (
                <p className="text-xs text-amber-200/90 mt-2">Bu tapşırıq təslim edilib — redaktə bağlanıb.</p>
              ) : null}
            </div>

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fayllar</p>
                {!locked && (
                  <label className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer">
                    + Yüklə (PNG/PDF/XLSX/CSV)
                    <input
                      type="file"
                      multiple
                      accept=".png,.pdf,.xlsx,.xls,.csv,application/pdf,image/png,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={(e) => void uploadFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>
              {!attachments.length ? (
                <p className="text-sm text-gray-500">Fayl yoxdur.</p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((u) => (
                    <li key={u} className="flex items-center justify-between gap-2">
                      <a
                        className="text-sm text-blue-300 hover:text-blue-200 break-all"
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {u}
                      </a>
                      {!locked && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-300 hover:text-red-200 shrink-0"
                          onClick={() => removeAttachment(u)}
                        >
                          Sil
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <Button variant="secondary" onClick={() => setOpenId(null)} disabled={Boolean(busyId)}>
                Bağla
              </Button>
              <Button
                variant="secondary"
                onClick={() => void saveDraft()}
                loading={busyId === 'draft' || busyId === 'upload'}
                disabled={locked}
              >
                Qaralama kimi saxla
              </Button>
              <Button onClick={() => void submitWork()} loading={busyId === 'submit'} disabled={locked}>
                Təslim et
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
