import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

function categoryLabel(exam) {
  if (exam.parent_category_name && exam.category_name) {
    return `${exam.parent_category_name} → ${exam.category_name}`
  }
  return exam.category_name || '—'
}

export default function AdminCertifiedExamVerifications() {
  const toast = useToast()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

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
  }, [load])

  const review = async (examId, approve) => {
    setBusyId(examId)
    try {
      const d = await api.post(`/admin/certified-exams/${encodeURIComponent(examId)}/review`, { approve })
      toast(d?.message || (approve ? 'Təsdiqləndi' : 'Rədd edildi'), approve ? 'success' : 'info')
      setExams((prev) => prev.filter((e) => e.id !== examId))
    } catch (err) {
      toast(err?.message || 'Əməliyyat uğursuz', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Gözləyən verifikasiyalar</h1>
        <p className="text-sm text-token-textMuted mt-1">
          Müəllimlər kataloqda göstərmək istəyən sertifikatlı imtahanlar. Təsdiq edəndə{' '}
          <code className="text-xs">/sertifikatli-imtahanlar</code> səhifəsində görünür.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-token-textMuted">Yüklənir…</p>
      ) : exams.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceAlt p-4 text-sm text-token-textMuted">
          Gözləyən verifikasiya yoxdur.
        </div>
      ) : (
        <ul className="space-y-3">
          {exams.map((exam) => (
            <li
              key={exam.id}
              className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceAlt p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-token-textMain">{exam.title}</p>
                  <p className="text-xs text-token-textMuted mt-1">
                    Müəllim: {exam.instructor_name}
                    {exam.instructor_email ? ` (${exam.instructor_email})` : ''}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200 px-2 py-0.5">
                  Gözləyir
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-token-textMuted">
                <span>Kateqoriya: {categoryLabel(exam)}</span>
                <span>·</span>
                <span>Səviyyə: {exam.level || 'beginner'}</span>
                <span>·</span>
                <span>{exam.question_count} sual</span>
                <span>·</span>
                <span>Keçid {exam.certificate_pass_pct}%</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  loading={busyId === exam.id}
                  onClick={() => void review(exam.id, true)}
                >
                  Təsdiqlə
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={busyId === exam.id}
                  onClick={() => void review(exam.id, false)}
                >
                  Rədd et
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
