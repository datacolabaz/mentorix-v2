import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const DIFFICULTY_KEYS = { easy: 'easy', medium: 'medium', hard: 'hard' }

function difficultyBadgeClass(difficulty) {
  if (difficulty === 'hard') return 'bg-red-500/15 text-red-300 border-red-500/25'
  if (difficulty === 'easy') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
  return 'bg-amber-500/15 text-amber-300 border-amber-500/25'
}

/**
 * Read-only renderer for AI-generated assignment questions. Shared by the
 * instructor and student Tasks screens so the markup is defined once.
 *
 * @param {{
 *   questions: Array<{ id?: string, text: string, correctAnswer?: string, difficulty?: string, options?: string[] }>,
 *   showAnswers?: boolean,
 *   defaultOpen?: boolean,
 *   className?: string,
 * }} props
 */
export default function GeneratedQuestionsView({
  questions,
  showAnswers = false,
  defaultOpen = false,
  className = '',
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)

  if (!Array.isArray(questions) || questions.length === 0) return null

  return (
    <div className={`rounded-xl border border-indigo-500/15 bg-[#0f0c29]/50 p-3 ${className}`.trim()}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-[10px] font-semibold text-token-textMuted uppercase tracking-wider">
          {t('generation.view.heading')} · {t('generation.view.count', { count: questions.length })}
        </span>
        <span className="text-xs text-violet-300 shrink-0">
          {open ? t('generation.view.hide') : t('generation.view.show')}
        </span>
      </button>

      {open ? (
        <ol className="mt-3 space-y-3">
          {questions.map((q, i) => {
            const isMcq = Array.isArray(q.options) && q.options.length > 0
            const diffKey = DIFFICULTY_KEYS[q.difficulty]
            return (
              <li key={q.id || i} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-start gap-2">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold inline-flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {diffKey ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${difficultyBadgeClass(
                            q.difficulty,
                          )}`}
                        >
                          {t(`generation.difficulty.${diffKey}`)}
                        </span>
                      ) : null}
                      {isMcq ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-token-textMuted">
                          {t('generation.view.mcq')}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-token-textMain whitespace-pre-wrap break-words">{q.text}</p>

                    {isMcq ? (
                      <ul className="mt-2 space-y-1.5">
                        {q.options.map((opt, oi) => {
                          const correct =
                            showAnswers && String(opt).trim() === String(q.correctAnswer || '').trim()
                          return (
                            <li
                              key={`${q.id || i}-o-${oi}`}
                              className={`text-sm rounded-lg border px-3 py-1.5 break-words ${
                                correct
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                  : 'border-white/10 bg-white/[0.02] text-token-textMuted'
                              }`}
                            >
                              <span className="font-semibold mr-1.5">{String.fromCharCode(65 + oi)}.</span>
                              {opt}
                              {correct ? (
                                <span className="ml-2 text-xs font-semibold">{t('generation.view.correctBadge')}</span>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    ) : showAnswers && q.correctAnswer ? (
                      <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80 mb-1">
                          {t('generation.view.sampleAnswer')}
                        </div>
                        <p className="text-sm text-emerald-100 whitespace-pre-wrap break-words">{q.correctAnswer}</p>
                      </div>
                    ) : null}
                    {showAnswers && q.explanation ? (
                      <div className="mt-2 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300/80 mb-1">
                          {t('generation.view.explanation')}
                        </div>
                        <p className="text-sm text-indigo-100 whitespace-pre-wrap break-words">{q.explanation}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}
    </div>
  )
}
