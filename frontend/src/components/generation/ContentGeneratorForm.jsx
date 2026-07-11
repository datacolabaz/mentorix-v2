import { useCallback, useId, useMemo, useState } from 'react'
import Button from '../common/Button'

export const GENERATION_LEVELS = ['beginner', 'intermediate', 'advanced']
export const GENERATION_FORMATS = ['mcq', 'open', 'essay']
export const GENERATION_DIFFICULTIES = ['easy', 'medium', 'hard']

const LEVEL_LABELS = {
  beginner: 'Başlanğıc',
  intermediate: 'Orta',
  advanced: 'Qabaqcıl',
}

const FORMAT_LABELS = {
  mcq: 'Çoxseçimli (MCQ)',
  open: 'Açıq sual',
  essay: 'Esse',
}

const DIFFICULTY_LABELS = {
  easy: 'Asan',
  medium: 'Orta',
  hard: 'Çətin',
}

export const CONTENT_GENERATOR_DEFAULT_VALUES = {
  topic: '',
  level: 'beginner',
  questionCount: 5,
  format: 'mcq',
  difficulty: 'medium',
}

const INPUT_CLS =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed'
const SELECT_CLS = `${INPUT_CLS} cursor-pointer [color-scheme:dark]`
const LABEL_CLS = 'text-xs font-semibold text-token-textMuted block mb-1.5'
const ERROR_CLS = 'text-[11px] text-red-400 mt-1'

/** @typedef {{ topic: string, level: string, questionCount: number, format: string, difficulty: string }} ContentGeneratorFormValues */

/**
 * @param {Partial<ContentGeneratorFormValues>} values
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateContentGeneratorForm(values) {
  /** @type {Record<string, string>} */
  const errors = {}
  const topic = String(values?.topic ?? '').trim()

  if (!topic) {
    errors.topic = 'Mövzu mütləqdir.'
  } else if (topic.length < 3) {
    errors.topic = 'Mövzu ən azı 3 simvol olmalıdır.'
  } else if (topic.length > 200) {
    errors.topic = 'Mövzu ən çox 200 simvol ola bilər.'
  }

  const level = String(values?.level ?? '')
  if (!GENERATION_LEVELS.includes(level)) {
    errors.level = 'Düzgün səviyyə seçin.'
  }

  const rawCount = values?.questionCount
  const count = rawCount === '' || rawCount == null ? NaN : Number(rawCount)
  if (!Number.isFinite(count) || !Number.isInteger(count)) {
    errors.questionCount = 'Sual sayı tam ədəd olmalıdır.'
  } else if (count < 1) {
    errors.questionCount = 'Sual sayı ən azı 1 olmalıdır.'
  } else if (count > 30) {
    errors.questionCount = 'Sual sayı ən çoxu 30 ola bilər.'
  }

  const format = String(values?.format ?? '')
  if (!GENERATION_FORMATS.includes(format)) {
    errors.format = 'Düzgün format seçin.'
  }

  const difficulty = String(values?.difficulty ?? '')
  if (!GENERATION_DIFFICULTIES.includes(difficulty)) {
    errors.difficulty = 'Düzgün çətinlik seçin.'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

function fieldDescribedBy(fieldKey, errors, formId) {
  return errors[fieldKey] ? `${formId}-${fieldKey}-error` : undefined
}

/**
 * @param {{
 *   onSubmit: (values: ContentGeneratorFormValues) => void | Promise<void>,
 *   isSubmitting?: boolean,
 *   initialValues?: Partial<ContentGeneratorFormValues>,
 *   className?: string,
 *   submitLabel?: string,
 * }} props
 */
export default function ContentGeneratorForm({
  onSubmit,
  isSubmitting = false,
  initialValues = {},
  className = '',
  submitLabel = 'Sual yarat',
}) {
  const formId = useId().replace(/:/g, '')
  const [values, setValues] = useState(() => ({
    ...CONTENT_GENERATOR_DEFAULT_VALUES,
    ...initialValues,
  }))
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const { valid, errors } = useMemo(() => validateContentGeneratorForm(values), [values])

  const showError = useCallback(
    (field) => (touched[field] || submitAttempted) && errors[field],
    [touched, submitAttempted, errors],
  )

  const markTouched = (field) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitAttempted(true)
    const result = validateContentGeneratorForm(values)
    if (!result.valid) return
    void onSubmit({
      topic: String(values.topic).trim(),
      level: values.level,
      questionCount: Number(values.questionCount),
      format: values.format,
      difficulty: values.difficulty,
    })
  }

  const submitDisabled = !valid || isSubmitting

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`.trim()} noValidate>
      <div>
        <label htmlFor={`${formId}-topic`} className={LABEL_CLS}>
          Mövzu
        </label>
        <input
          id={`${formId}-topic`}
          type="text"
          value={values.topic}
          onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
          onBlur={() => markTouched('topic')}
          disabled={isSubmitting}
          maxLength={200}
          placeholder="Məs: Triqonometriya — sinüs və kosinus"
          className={`${INPUT_CLS} ${showError('topic') ? 'border-red-500/50 focus:border-red-500/60' : ''}`}
          aria-invalid={showError('topic') ? true : undefined}
          aria-describedby={fieldDescribedBy('topic', showError('topic') ? errors : {}, formId)}
        />
        {showError('topic') ? (
          <p id={`${formId}-topic-error`} className={ERROR_CLS} role="alert">
            {errors.topic}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-level`} className={LABEL_CLS}>
            Səviyyə
          </label>
          <select
            id={`${formId}-level`}
            value={values.level}
            onChange={(e) => setValues((v) => ({ ...v, level: e.target.value }))}
            onBlur={() => markTouched('level')}
            disabled={isSubmitting}
            className={`${SELECT_CLS} ${showError('level') ? 'border-red-500/50' : ''}`}
            aria-invalid={showError('level') ? true : undefined}
            aria-describedby={fieldDescribedBy('level', showError('level') ? errors : {}, formId)}
          >
            {GENERATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
          {showError('level') ? (
            <p id={`${formId}-level-error`} className={ERROR_CLS} role="alert">
              {errors.level}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${formId}-questionCount`} className={LABEL_CLS}>
            Sual sayı
          </label>
          <input
            id={`${formId}-questionCount`}
            type="number"
            min={1}
            max={30}
            step={1}
            inputMode="numeric"
            value={values.questionCount}
            onChange={(e) => setValues((v) => ({ ...v, questionCount: e.target.value }))}
            onBlur={() => markTouched('questionCount')}
            disabled={isSubmitting}
            className={`${INPUT_CLS} ${showError('questionCount') ? 'border-red-500/50 focus:border-red-500/60' : ''}`}
            aria-invalid={showError('questionCount') ? true : undefined}
            aria-describedby={fieldDescribedBy('questionCount', showError('questionCount') ? errors : {}, formId)}
          />
          {showError('questionCount') ? (
            <p id={`${formId}-questionCount-error`} className={ERROR_CLS} role="alert">
              {errors.questionCount}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-format`} className={LABEL_CLS}>
            Format
          </label>
          <select
            id={`${formId}-format`}
            value={values.format}
            onChange={(e) => setValues((v) => ({ ...v, format: e.target.value }))}
            onBlur={() => markTouched('format')}
            disabled={isSubmitting}
            className={`${SELECT_CLS} ${showError('format') ? 'border-red-500/50' : ''}`}
            aria-invalid={showError('format') ? true : undefined}
            aria-describedby={fieldDescribedBy('format', showError('format') ? errors : {}, formId)}
          >
            {GENERATION_FORMATS.map((format) => (
              <option key={format} value={format}>
                {FORMAT_LABELS[format]}
              </option>
            ))}
          </select>
          {showError('format') ? (
            <p id={`${formId}-format-error`} className={ERROR_CLS} role="alert">
              {errors.format}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${formId}-difficulty`} className={LABEL_CLS}>
            Çətinlik
          </label>
          <select
            id={`${formId}-difficulty`}
            value={values.difficulty}
            onChange={(e) => setValues((v) => ({ ...v, difficulty: e.target.value }))}
            onBlur={() => markTouched('difficulty')}
            disabled={isSubmitting}
            className={`${SELECT_CLS} ${showError('difficulty') ? 'border-red-500/50' : ''}`}
            aria-invalid={showError('difficulty') ? true : undefined}
            aria-describedby={fieldDescribedBy('difficulty', showError('difficulty') ? errors : {}, formId)}
          >
            {GENERATION_DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>
                {DIFFICULTY_LABELS[difficulty]}
              </option>
            ))}
          </select>
          {showError('difficulty') ? (
            <p id={`${formId}-difficulty-error`} className={ERROR_CLS} role="alert">
              {errors.difficulty}
            </p>
          ) : null}
        </div>
      </div>

      <div className="pt-1">
        <Button type="submit" loading={isSubmitting} disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
