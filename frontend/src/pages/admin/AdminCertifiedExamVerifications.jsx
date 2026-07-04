import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'

function categoryLabel(exam) {
  if (exam.parent_category_name && exam.category_name) {
    return `${exam.parent_category_name} → ${exam.category_name}`
  }
  return exam.category_name || '—'
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function formatCreated(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('az-AZ', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

function optionLabel(options, key) {
  if (!key) return '—'
  const list = Array.isArray(options) ? options : []
  const hit = list.find((o) => String(o?.key || o?.id || '').toUpperCase() === String(key).toUpperCase())
  if (hit?.text) return `${key}: ${hit.text}`
  return String(key)
}

export default function AdminCertifiedExamVerifications() {
  const toast = useToast()
  const [exams, setExams] = useState([])
  const [demand, setDemand] = useState([])
  const [demandTotal, setDemandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [demandLoading, setDemandLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewExam, setPreviewExam] = useState(null)
  const [previewQuestions, setPreviewQuestions] = useState([])

  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectExam, setRejectExam] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadDemand = useCallback(async () => {
    setDemandLoading(true)
    try {
      const d = await api.get('/admin/certified-exams/waitlist-demand')
      setDemand(Array.isArray(d?.categories) ? d.categories : [])
      setDemandTotal(Number(d?.total_pending) || 0)
    } catch {
      setDemand([])
      setDemandTotal(0)
    } finally {
      setDemandLoading(false)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/admin/certified-exams/pending')
      setExams(Array.isArray(d?.exams) ? d.exams : [])
    } catch (err) {
      toast(err?.message || 'Siyahı yüklənmədi', 'error')
      setExams([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
    void loadDemand()
  }, [load, loadDemand])

  const removeExam = (examId) => {
    setExams((prev) => prev.filter((e) => e.id !== examId))
  }

  const openPreview = async (exam) => {
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewExam(exam)
    setPreviewQuestions([])
    try {
      const d = await api.get(`/admin/certified-exams/${encodeURIComponent(exam.id)}/preview`)
      setPreviewExam(d?.exam || exam)
      setPreviewQuestions(Array.isArray(d?.questions) ? d.questions : [])
    } catch (err) {
      toast(err?.message || 'Önizləmə yüklənmədi', 'error')
      setPreviewOpen(false)
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    setPreviewOpen(false)
    setPreviewExam(null)
    setPreviewQuestions([])
  }

  const openReject = (exam) => {
    setRejectExam(exam)
    setRejectReason('')
    setRejectOpen(true)
  }

  const closeReject = () => {
    setRejectOpen(false)
    setRejectExam(null)
    setRejectReason('')
  }

  const approve = async (examId) => {
    setBusyId(examId)
    try {
      const d = await api.patch(`/admin/certified-exams/${encodeURIComponent(examId)}/verify`)
      const wl = d?.waitlist_notifications
      if (wl?.sent > 0) {
        toast(`${d?.message || 'Təsdiqləndi'} · ${wl.sent} waitlist email göndərildi`, 'success')
      } else {
        toast(d?.message || 'Təsdiqləndi', 'success')
      }
      removeExam(examId)
      void loadDemand()
    } catch (err) {
      toast(err?.message || 'Təsdiq uğursuz', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const submitReject = async () => {
    const reason = rejectReason.trim()
    if (reason.length < 10) {
      toast('Rədd səbəbi ən azı 10 simvol olmalıdır', 'error')
      return
    }
    const examId = rejectExam?.id
    if (!examId) return

    setBusyId(examId)
    try {
      const d = await api.patch(`/admin/certified-exams/${encodeURIComponent(examId)}/reject`, { reason })
      toast(d?.message || 'Rədd edildi', 'info')
      removeExam(examId)
      closeReject()
    } catch (err) {
      toast(err?.message || 'Rədd uğursuz', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const rejectValid = rejectReason.trim().length >= 10

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Sertifikatlı imtahanlar</h1>
        <p className="text-sm text-token-textMuted mt-1">
          Kateqoriya waitlist tələbləri və kataloq verifikasiya növbəsi.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-token-textMain">Gözləyən Kateqoriya Tələbləri</h2>
            <p className="text-xs text-token-textMuted mt-1">
              Hansı kateqoriyaya neçə nəfər «Bildiriş al» buraxıb — prioritet üçün istifadə edin.
            </p>
          </div>
          <span
            className="rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 px-3 py-1 text-xs font-bold tabular-nums"
            title="Waitlist — kateqoriya tələbi"
          >
            {demandTotal} waitlist
          </span>
        </div>

        {demandLoading ? (
          <p className="text-sm text-token-textMuted">Yüklənir…</p>
        ) : demand.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceAlt p-4 text-sm text-token-textMuted">
            Hələ heç bir kateqoriya üçün waitlist qeydi yoxdur.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[color:var(--border-subtle)]">
            <table className="min-w-full text-sm">
              <thead className="bg-token-surfaceAlt text-left text-xs uppercase tracking-wider text-token-textMuted">
                <tr>
                  <th className="px-4 py-3">Kateqoriya</th>
                  <th className="px-4 py-3 text-right">Gözləyən</th>
                  <th className="px-4 py-3 text-right">Son 7 gün</th>
                  <th className="px-4 py-3">Son qeyd</th>
                </tr>
              </thead>
              <tbody>
                {demand.map((row) => (
                  <tr key={row.category_id} className="border-t border-[color:var(--border-subtle)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span aria-hidden>{row.category_icon || '📚'}</span>
                        <div>
                          <p className="font-medium text-token-textMain">{row.category_name}</p>
                          {row.parent_name ? (
                            <p className="text-[11px] text-token-textMuted">{row.parent_name}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-300">
                      {row.pending_count}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-token-textMuted">{row.recent_count}</td>
                    <td className="px-4 py-3 text-xs text-token-textMuted">{formatWhen(row.last_signup_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-token-textMain">Gözləyən verifikasiyalar</h2>
            <p className="text-xs text-token-textMuted mt-1">
              Müəllim «Kataloqda göstər» seçib — admin təsdiqi gözləyir. Təsdiq edəndə waitlist email-ləri gedir.
            </p>
          </div>
          {!loading ? (
            <span
              className="rounded-full border border-amber-500/35 bg-amber-500/10 text-amber-200 px-3 py-1 text-xs font-bold tabular-nums"
              title="Verifikasiya növbəsi"
            >
              {exams.length} verifikasiya
            </span>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-token-textMuted">Yüklənir…</p>
        ) : exams.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceAlt p-4 text-sm text-token-textMuted">
            Gözləyən verifikasiya yoxdur. Müəllim imtahan yaradıb «Kataloqda göstərilsin» seçəndə burada görünəcək.
          </div>
        ) : (
          <ul className="space-y-3">
            {exams.map((exam) => (
              <li
                key={exam.id}
                className="rounded-xl border border-amber-500/20 bg-token-surfaceAlt p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-token-textMain text-base">{exam.title}</p>
                    <p className="text-xs text-token-textMuted mt-1">
                      Müəllim: {exam.instructor_name}
                      {exam.instructor_email ? ` · ${exam.instructor_email}` : ''}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 px-2 py-0.5">
                    Verifikasiya gözləyir
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-token-textMuted">
                  <span>Kateqoriya: {categoryLabel(exam)}</span>
                  <span aria-hidden>·</span>
                  <span>{exam.question_count} sual</span>
                  <span aria-hidden>·</span>
                  <span>Keçid balı: {exam.certificate_pass_pct ?? 70}%</span>
                  <span aria-hidden>·</span>
                  <span>Yaradılıb: {formatCreated(exam.created_at)}</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyId === exam.id}
                    onClick={() => void openPreview(exam)}
                  >
                    👁 Önizləmə
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="!bg-emerald-600 hover:!bg-emerald-500 !text-white !border-emerald-500/40"
                    loading={busyId === exam.id}
                    onClick={() => void approve(exam.id)}
                  >
                    ✅ Təsdiqlə
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    loading={busyId === exam.id}
                    onClick={() => openReject(exam)}
                  >
                    ❌ Rədd et
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={previewOpen}
        onClose={closePreview}
        title={previewExam?.title ? `Önizləmə — ${previewExam.title}` : 'İmtahan önizləməsi'}
        size="xl"
        scrollBody
      >
        {previewLoading ? (
          <p className="text-sm text-gray-400">Sual siyahısı yüklənir…</p>
        ) : (
          <div className="space-y-4">
            {previewExam ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-300 space-y-1">
                <p>
                  <span className="text-gray-500">Müəllim:</span> {previewExam.instructor_name}
                </p>
                <p>
                  <span className="text-gray-500">Kateqoriya:</span>{' '}
                  {previewExam.parent_category_name && previewExam.category_name
                    ? `${previewExam.parent_category_name} → ${previewExam.category_name}`
                    : previewExam.category_name || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Keçid balı:</span> {previewExam.certificate_pass_pct ?? 70}%
                </p>
              </div>
            ) : null}

            {previewQuestions.length === 0 ? (
              <p className="text-sm text-gray-400">Sual tapılmadı.</p>
            ) : (
              <ol className="space-y-4 list-none">
                {previewQuestions.map((q) => (
                  <li key={q.id} className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
                    <p className="text-sm font-medium text-white">
                      {q.order}. {q.question_text}
                    </p>
                    {Array.isArray(q.options) && q.options.length > 0 ? (
                      <ul className="text-xs text-gray-400 space-y-1 pl-1">
                        {q.options.map((opt) => {
                          const key = opt?.key || opt?.id || ''
                          const isCorrect =
                            String(key).toUpperCase() === String(q.correct_answer || '').toUpperCase()
                          return (
                            <li
                              key={key || opt?.text}
                              className={isCorrect ? 'text-emerald-300 font-medium' : undefined}
                            >
                              {key}: {opt?.text || '—'}
                              {isCorrect ? ' ✓' : ''}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                    <p className="text-xs text-emerald-300/90">
                      Düzgün cavab: {optionLabel(q.options, q.correct_answer)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={rejectOpen}
        onClose={closeReject}
        title="Kataloq rəddi"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={closeReject} disabled={busyId === rejectExam?.id}>
              Ləğv et
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={busyId === rejectExam?.id}
              disabled={!rejectValid}
              onClick={() => void submitReject()}
            >
              Rədd et
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-300">
            «{rejectExam?.title}» imtahanını kataloqdan rədd edirsiniz. Müəllimə səbəb göndəriləcək.
          </p>
          <label className="block text-sm">
            <span className="text-gray-400 text-xs uppercase">Rədd səbəbi (məcburi)</span>
            <textarea
              className="mt-1 w-full min-h-[100px] rounded-xl bg-[#13112e] border border-red-500/20 px-3 py-2 text-white text-sm resize-y"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Məs: suallar kateqoriya səviyyəsinə uyğun deyil, minimum 10 simvol…"
              maxLength={2000}
            />
          </label>
          <p className={`text-xs ${rejectValid ? 'text-gray-500' : 'text-amber-300'}`}>
            {rejectReason.trim().length}/10 simvol (minimum)
          </p>
        </div>
      </Modal>
    </div>
  )
}
