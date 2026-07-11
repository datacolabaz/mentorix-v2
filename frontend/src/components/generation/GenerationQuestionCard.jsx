import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Card from '../common/Card'
import Button from '../common/Button'

const DIFFICULTIES = ['easy', 'medium', 'hard']

const INPUT_CLS =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 disabled:opacity-50'
const LABEL_CLS = 'text-[11px] font-semibold uppercase tracking-wide text-token-textMuted block mb-1.5'

function difficultyBadgeClass(difficulty) {
  if (difficulty === 'hard') return 'bg-red-500/15 text-red-300 border-red-500/25'
  if (difficulty === 'easy') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
  return 'bg-amber-500/15 text-amber-300 border-amber-500/25'
}

/**
 * Validates a single edited question against the backend PATCH constraints.
 * Returns i18n keys instead of hardcoded strings.
 * @param {{ text: string, correctAnswer: string, difficulty: string, options?: string[] }} q
 */
function validateQuestion(q) {
  const errors = {}
  const text = String(q.text ?? '').trim()
  if (text.length < 5) errors.text = 'generation.card.errors.textMin'

  const hasOptions = Array.isArray(q.options)
  if (hasOptions) {
    const cleaned = q.options.map((o) => String(o ?? '').trim()).filter(Boolean)
    if (cleaned.length < 2 || cleaned.length > 6) {
      errors.options = 'generation.card.errors.options'
    }
  }

  if (!String(q.correctAnswer ?? '').trim()) errors.correctAnswer = 'generation.card.errors.correctRequired'
  if (!DIFFICULTIES.includes(String(q.difficulty ?? ''))) errors.difficulty = 'generation.card.errors.difficulty'

  return { valid: Object.keys(errors).length === 0, errors }
}

/**
 * @param {{
 *   question: { id: string, text: string, correctAnswer: string, difficulty: string, options?: string[] },
 *   index: number,
 *   onSave: (updated: any) => Promise<void> | void,
 *   onDelete: () => Promise<void> | void,
 *   onRegenerate: (instructions: string) => Promise<void> | void,
 *   regenerating?: boolean,
 *   busy?: boolean,
 * }} props
 */
export default function GenerationQuestionCard({
  question,
  index,
  onSave,
  onDelete,
  onRegenerate,
  regenerating = false,
  busy = false,
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState(question)
  const isMcq = Array.isArray(question.options) && question.options.length > 0

  useEffect(() => {
    if (!editing) setDraft(question)
  }, [question, editing])

  const { valid, errors } = useMemo(() => validateQuestion(draft), [draft])

  const startEdit = () => {
    setDraft(question)
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft(question)
    setEditing(false)
  }

  const commit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const cleanedOptions = Array.isArray(draft.options)
        ? draft.options.map((o) => String(o ?? '').trim()).filter(Boolean)
        : undefined
      const payload = {
        id: draft.id,
        text: String(draft.text).trim(),
        correctAnswer: String(draft.correctAnswer).trim(),
        difficulty: draft.difficulty,
      }
      if (cleanedOptions && cleanedOptions.length) payload.options = cleanedOptions
      await onSave(payload)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const updateOption = (optIdx, value) => {
    setDraft((d) => {
      const next = [...(d.options || [])]
      next[optIdx] = value
      return { ...d, options: next }
    })
  }

  const disabled = busy || regenerating
  const activeDifficulty = editing ? draft.difficulty : question.difficulty

  return (
    <Card className="p-4 sm:p-5 relative">
      {regenerating ? (
        <div className="absolute inset-0 z-10 rounded-2xl bg-black/55 backdrop-blur-[1px] flex items-center justify-center">
          <span className="inline-flex items-center gap-2 text-sm text-primary">
            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {t('generation.card.regenerating')}
          </span>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 w-7 h-7 rounded-full bg-primary/15 text-primary text-sm font-bold inline-flex items-center justify-center">
            {index + 1}
          </span>
          <span
            className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${difficultyBadgeClass(
              activeDifficulty,
            )}`}
          >
            {t(`generation.difficulty.${activeDifficulty}`, { defaultValue: activeDifficulty })}
          </span>
          {isMcq ? (
            <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-token-textMuted">
              {t('generation.card.mcq')}
            </span>
          ) : null}
        </div>

        {!editing ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button type="button" variant="ghost" size="sm" onClick={startEdit} disabled={disabled}>
              {t('generation.card.edit')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onRegenerate('')}
              disabled={disabled}
            >
              {t('generation.card.regenerate')}
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={onDelete} disabled={disabled}>
              {t('generation.card.delete')}
            </Button>
          </div>
        ) : null}
      </div>

      {!editing ? (
        <div className="space-y-3">
          <p className="text-sm text-token-textMain whitespace-pre-wrap break-words">{question.text}</p>

          {isMcq ? (
            <ul className="space-y-1.5">
              {question.options.map((opt, i) => {
                const isCorrect = String(opt).trim() === String(question.correctAnswer).trim()
                return (
                  <li
                    key={`${question.id}-opt-${i}`}
                    className={`text-sm rounded-xl border px-3 py-2 break-words ${
                      isCorrect
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                        : 'border-white/10 bg-white/[0.02] text-token-textMuted'
                    }`}
                  >
                    <span className="font-semibold mr-1.5">{String.fromCharCode(65 + i)}.</span>
                    {opt}
                    {isCorrect ? <span className="ml-2 text-xs font-semibold">{t('generation.card.correctBadge')}</span> : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300/80 mb-1">
                  {t('generation.card.sampleAnswer')}
                </div>
                <p className="text-sm text-emerald-100 whitespace-pre-wrap break-words">
                  {question.correctAnswer}
                </p>
              </div>
              {question.explanation ? (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300/80 mb-1">
                    {t('generation.view.explanation')}
                  </div>
                  <p className="text-sm text-indigo-100 whitespace-pre-wrap break-words">{question.explanation}</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLS}>{t('generation.card.questionText')}</label>
            <textarea
              rows={3}
              value={draft.text}
              onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              className={`${INPUT_CLS} resize-y`}
            />
            {errors.text ? <p className="text-[11px] text-red-400 mt-1">{t(errors.text)}</p> : null}
          </div>

          {isMcq ? (
            <div>
              <label className={LABEL_CLS}>{t('generation.card.options')}</label>
              <div className="space-y-2">
                {(draft.options || []).map((opt, i) => {
                  const trimmed = String(opt).trim()
                  const selected = trimmed && trimmed === String(draft.correctAnswer).trim()
                  return (
                    <div key={`edit-opt-${i}`} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, correctAnswer: String(opt).trim() }))}
                        className={`shrink-0 w-8 h-8 rounded-lg border text-xs font-bold inline-flex items-center justify-center transition-colors ${
                          selected
                            ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200'
                            : 'border-white/10 bg-white/[0.03] text-token-textMuted hover:border-primary/40'
                        }`}
                        aria-label={t('generation.card.selectCorrect')}
                      >
                        {selected ? '✓' : String.fromCharCode(65 + i)}
                      </button>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        className={INPUT_CLS}
                      />
                    </div>
                  )
                })}
              </div>
              {errors.options ? <p className="text-[11px] text-red-400 mt-1">{t(errors.options)}</p> : null}
              {errors.correctAnswer ? (
                <p className="text-[11px] text-red-400 mt-1">{t(errors.correctAnswer)}</p>
              ) : null}
            </div>
          ) : (
            <div>
              <label className={LABEL_CLS}>{t('generation.card.correctAnswer')}</label>
              <textarea
                rows={2}
                value={draft.correctAnswer}
                onChange={(e) => setDraft((d) => ({ ...d, correctAnswer: e.target.value }))}
                className={`${INPUT_CLS} resize-y`}
              />
              {errors.correctAnswer ? (
                <p className="text-[11px] text-red-400 mt-1">{t(errors.correctAnswer)}</p>
              ) : null}
            </div>
          )}

          <div className="sm:w-1/2">
            <label className={LABEL_CLS}>{t('generation.card.difficulty')}</label>
            <select
              value={draft.difficulty}
              onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value }))}
              className={`${INPUT_CLS} cursor-pointer [color-scheme:dark]`}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {t(`generation.difficulty.${d}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="button" size="sm" onClick={commit} loading={saving} disabled={!valid || saving}>
              {t('generation.card.save')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              {t('generation.card.cancel')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
