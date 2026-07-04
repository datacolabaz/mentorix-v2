function questionTypeLabelAz(t) {
  const m = {
    closed: 'Qapalı',
    multiple: 'Çoxseçimli (şablon)',
    matching: 'Uyğunluq',
    sequence: 'Ardıcıllıq',
    open: 'Açıq',
  }
  return m[t] || t
}

function statusBadgeClass(label) {
  if (label === 'Düzgün' || label === 'Doğru' || label === 'Qismən düzgün') return 'bg-emerald-500/20 text-emerald-300'
  if (label === 'Səhv') return 'bg-red-500/15 text-red-300'
  if (label === 'AI tövsiyəsi') return 'bg-violet-500/20 text-violet-200'
  if (label === 'Qiymətləndirilir' || label === 'Nəticə gözlənilir') return 'bg-amber-500/20 text-amber-200'
  if (label === 'Cavabsız') return 'bg-amber-500/15 text-amber-200'
  return 'bg-gray-500/15 text-gray-400'
}

/**
 * İmtahan nəticəsi: hər sual üçün tələbə cavabı + (varsa) müqayisə sütunu + status.
 */
export default function ExamBreakdownList({
  rows,
  answerHeading = 'Sizin cavabınız',
  renderOpenGrading,
}) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return (
    <div className="space-y-3 max-h-[min(60vh,520px)] overflow-y-auto pr-1">
      {rows.filter(Boolean).map((row) => {
        const ans = row.student_answer
        const emptyAns = ans == null || String(ans).trim() === '' || ans === '—'
        return (
          <div
            key={row.question_id || row.order}
            className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 hover:bg-token-surfaceCard/55 transition-colors p-4 text-left"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-token-textMain">Sual {row.order}</span>
              <span className="text-[11px] uppercase tracking-wide text-token-textMuted">
                {questionTypeLabelAz(row.question_type)}
              </span>
            </div>
            <p className="text-sm text-token-textMain mb-3 leading-snug">{row.question_text}</p>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="text-xs text-zinc-400 block mb-0.5">{answerHeading}</span>
                <div
                  className="mx-exam-answer-readout block font-mono text-sm font-semibold tracking-wide break-all rounded-lg border px-2.5 py-2 min-h-[2.5rem] shadow-inner border-white/30"
                  style={{
                    backgroundColor: '#0c0c0f',
                    color: '#ffffff',
                    WebkitTextFillColor: '#ffffff',
                  }}
                >
                  {emptyAns ? (
                    <span className="mx-exam-answer-readout-muted not-italic font-sans text-xs font-normal tracking-normal">
                      Cavab verilməyib
                    </span>
                  ) : (
                    <span
                      className="mx-exam-answer-readout-text"
                      style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
                    >
                      {String(ans)}
                    </span>
                  )}
                </div>
              </div>
              {row.correct_display ? (
                <div>
                  <span className="text-xs text-token-textMuted block mb-0.5">
                    {row.correct_label || 'Şablon / nümunə'}
                  </span>
                  <div
                    className="inline-flex max-w-full items-center rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard/60 px-2.5 py-1.5 font-mono text-xs text-token-textMain break-all"
                    role="note"
                  >
                    {row.correct_display}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-3">
              <span
                className={
                  'inline-flex text-xs font-bold px-2.5 py-1 rounded-lg ' + statusBadgeClass(row.status_label)
                }
              >
                {row.status_label === 'Manual qiymətləndirmə'
                  ? 'Yoxlanılır'
                  : row.status_label === 'AI tövsiyəsi'
                    ? 'AI tövsiyəsi gözləyir'
                    : row.status_label}
              </span>
              {row.grading_pending && row.max_points != null ? (
                <span className="ml-2 text-[11px] text-amber-300/90 tabular-nums">
                  ({row.max_points} baldan — gözlənilir)
                </span>
              ) : row.points_display != null && Number.isFinite(Number(row.points_display)) ? (
                <span className="ml-2 text-[11px] text-emerald-300/90 tabular-nums">
                  (+{Math.round(Number(row.points_display) * 100) / 100} bal)
                </span>
              ) : null}
            </div>
            {typeof renderOpenGrading === 'function' ? renderOpenGrading(row) : null}
          </div>
        )
      })}
    </div>
  )
}
