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

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return '—'
  }
}

export default function AdminCertifiedExamVerifications() {
  const toast = useToast()
  const [exams, setExams] = useState([])
  const [demand, setDemand] = useState([])
  const [demandTotal, setDemandTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [demandLoading, setDemandLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

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

  const review = async (examId, approve) => {
    setBusyId(examId)
    try {
      const d = await api.post(`/admin/certified-exams/${encodeURIComponent(examId)}/review`, { approve })
      const wl = d?.waitlist_notifications
      if (approve && wl?.sent > 0) {
        toast(`${d?.message || 'Təsdiqləndi'} · ${wl.sent} waitlist email göndərildi`, 'success')
      } else {
        toast(d?.message || (approve ? 'Təsdiqləndi' : 'Rədd edildi'), approve ? 'success' : 'info')
      }
      setExams((prev) => prev.filter((e) => e.id !== examId))
      void loadDemand()
    } catch (err) {
      toast(err?.message || 'Əməliyyat uğursuz', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl space-y-8">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Sertifikatlı imtahanlar</h1>
        <p className="text-sm text-token-textMuted mt-1">
          Gözləyən kateqoriya tələbləri və verifikasiya növbəsi.
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
          <span className="rounded-full border border-primary/35 bg-primary/10 text-primary px-3 py-1 text-xs font-bold tabular-nums">
            {demandTotal} gözləyir
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
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">{row.pending_count}</td>
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
        <h2 className="font-semibold text-token-textMain">Gözləyən verifikasiyalar</h2>
        <p className="text-xs text-token-textMuted">
          Təsdiq edəndə həmin kateqoriyanın waitlist-ində olan email-lərə avtomatik bildiriş gedir.
        </p>

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
      </section>
    </div>
  )
}
