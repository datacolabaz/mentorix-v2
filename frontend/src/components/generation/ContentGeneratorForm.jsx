import { useCallback, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../common/Button'

export const GENERATION_LEVELS = ['beginner', 'intermediate', 'advanced']
export const GENERATION_FORMATS = ['mcq', 'open', 'essay']
export const GENERATION_DIFFICULTIES = ['easy', 'medium', 'hard']

const MIN_TOPIC_LENGTH = 3
const MAX_TOPIC_LENGTH = 200
const MIN_QUESTION_COUNT = 1
const MAX_QUESTION_COUNT = 30

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
 * Validates the form, returning i18n error descriptors ({ key, params }) so the
 * UI can render localized messages without hardcoded strings.
 *
 * @param {Partial<ContentGeneratorFormValues>} values
 * @returns {{ valid: boolean, errors: Record<string, { key: string, params?: Record<string, unknown> }> }}
 */
export function validateContentGeneratorForm(values) {
  /** @type {Record<string, { key: string, params?: Record<string, unknown> }>} */
  const errors = {}
  const topic = String(values?.topic ?? '').trim()

  if (!topic) {
    errors.topic = { key: 'generation.form.errors.topicRequired' }
  } else if (topic.length < MIN_TOPIC_LENGTH) {
    errors.topic = { key: 'generation.form.errors.topicMin', params: { min: MIN_TOPIC_LENGTH } }
  } else if (topic.length > MAX_TOPIC_LENGTH) {
    errors.topic = { key: 'generation.form.errors.topicMax', params: { max: MAX_TOPIC_LENGTH } }
  }

  const level = String(values?.level ?? '')
  if (!GENERATION_LEVELS.includes(level)) {
    errors.level = { key: 'generation.form.errors.levelInvalid' }
  }

  const rawCount = values?.questionCount
  const count = rawCount === '' || rawCount == null ? NaN : Number(rawCount)
  if (!Number.isFinite(count) || !Number.isInteger(count)) {
    errors.questionCount = { key: 'generation.form.errors.countInt' }
  } else if (count < MIN_QUESTION_COUNT) {
    errors.questionCount = { key: 'generation.form.errors.countMin', params: { min: MIN_QUESTION_COUNT } }
  } else if (count > MAX_QUESTION_COUNT) {
    errors.questionCount = { key: 'generation.form.errors.countMax', params: { max: MAX_QUESTION_COUNT } }
  }

  const format = String(values?.format ?? '')
  if (!GENERATION_FORMATS.includes(format)) {
    errors.format = { key: 'generation.form.errors.formatInvalid' }
  }

  const difficulty = String(values?.difficulty ?? '')
  if (!GENERATION_DIFFICULTIES.includes(difficulty)) {
    errors.difficulty = { key: 'generation.form.errors.difficultyInvalid' }
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
  submitLabel,
}) {
  const { t } = useTranslation()
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

  const errorText = (field) => {
    const e = errors[field]
    return e ? t(e.key, e.params) : ''
  }

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
          {t('generation.form.topic')}
        </label>
        <input
          id={`${formId}-topic`}
          type="text"
          value={values.topic}
          onChange={(e) => setValues((v) => ({ ...v, topic: e.target.value }))}
          onBlur={() => markTouched('topic')}
          disabled={isSubmitting}
          maxLength={MAX_TOPIC_LENGTH}
          placeholder={t('generation.form.topicPh')}
          className={`${INPUT_CLS} ${showError('topic') ? 'border-red-500/50 focus:border-red-500/60' : ''}`}
          aria-invalid={showError('topic') ? true : undefined}
          aria-describedby={fieldDescribedBy('topic', showError('topic') ? errors : {}, formId)}
        />
        {showError('topic') ? (
          <p id={`${formId}-topic-error`} className={ERROR_CLS} role="alert">
            {errorText('topic')}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-level`} className={LABEL_CLS}>
            {t('generation.form.level')}
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
                {t(`generation.level.${level}`)}
              </option>
            ))}
          </select>
          {showError('level') ? (
            <p id={`${formId}-level-error`} className={ERROR_CLS} role="alert">
              {errorText('level')}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${formId}-questionCount`} className={LABEL_CLS}>
            {t('generation.form.questionCount')}
          </label>
          <input
            id={`${formId}-questionCount`}
            type="number"
            min={MIN_QUESTION_COUNT}
            max={MAX_QUESTION_COUNT}
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
              {errorText('questionCount')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${formId}-format`} className={LABEL_CLS}>
            {t('generation.form.format')}
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
                {t(`generation.format.${format}`)}
              </option>
            ))}
          </select>
          {showError('format') ? (
            <p id={`${formId}-format-error`} className={ERROR_CLS} role="alert">
              {errorText('format')}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={`${formId}-difficulty`} className={LABEL_CLS}>
            {t('generation.form.difficulty')}
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
                {t(`generation.difficulty.${difficulty}`)}
              </option>
            ))}
          </select>
          {showError('difficulty') ? (
            <p id={`${formId}-difficulty-error`} className={ERROR_CLS} role="alert">
              {errorText('difficulty')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="pt-1">
        <Button type="submit" loading={isSubmitting} disabled={submitDisabled}>
          {submitLabel || t('generation.form.submit')}
        </Button>
      </div>
    </form>
  )
}
