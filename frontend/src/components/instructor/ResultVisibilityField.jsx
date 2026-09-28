import { useTranslation } from 'react-i18next'
import { FEATURE_FLAGS, useFeatureFlag } from '../../lib/featureFlags'

export const RESULT_VISIBILITY_MODES = [
  'immediate_full_review',
  'after_exam_window',
  'after_manual_grading',
  'score_only',
  'wrong_answers_only',
]

const MODE_COPY = {
  immediate_full_review: {
    title: 'Dərhal tam nəticə',
    hint: 'Bal, tələbənin cavabı və düzgün cavab imtahan bitən kimi görünür.',
  },
  after_exam_window: {
    title: 'İmtahan müddəti bitəndən sonra',
    hint: 'Nəticə hamı üçün eyni vaxtda açılır: bitmə vaxtında və ya seçdiyiniz tarixdə.',
  },
  after_manual_grading: {
    title: 'Yoxlamadan sonra',
    hint: 'Açıq sualları yoxlayıb təsdiqləyəndən sonra nəticə görünür.',
  },
  score_only: {
    title: 'Yalnız bal',
    hint: 'Ümumi bal və statistika görünür, suallar və düzgün cavablar gizli qalır.',
  },
  wrong_answers_only: {
    title: 'Yalnız səhv cavablar',
    hint: 'Tələbə yalnız səhv etdiyi və boş buraxdığı sualları, düzgün cavabla birlikdə görür.',
  },
}

/**
 * «Nəticələrin göstərilmə qaydası» seçimi.
 * value: { result_visibility_mode, results_release_at (datetime-local), show_results }
 * mode null = köhnə qayda (yalnız əvvəlcədən yaradılmış imtahanlarda).
 */
export default function ResultVisibilityField({ value, onChange, idPrefix = 'rv', inputClassName = '' }) {
  const { t } = useTranslation()
  const modesOn = useFeatureFlag(FEATURE_FLAGS.EXAM_RESULT_MODES)
  const mode = value?.result_visibility_mode || null

  if (!modesOn) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t('exams.form.showResults')}</span>
        <input
          type="checkbox"
          checked={value?.show_results !== false}
          onChange={(e) =>
            onChange({
              show_results: e.target.checked,
              result_visibility_mode: e.target.checked ? 'immediate_full_review' : null,
            })
          }
          className="w-4 h-4 accent-blue-500"
        />
      </div>
    )
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold mb-1">
        {t('examResultModes.label', { defaultValue: 'Nəticələrin göstərilmə qaydası' })}
      </legend>
      {!mode ? (
        <p className="text-xs rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-token-textMain">
          {t('examResultModes.legacyNotice', {
            defaultValue:
              'Köhnə qayda: tələbə öz cavablarını və düzgün/səhv statusunu görür, düzgün cavab gizlidir. Yeni qayda seçə bilərsiniz.',
          })}
        </p>
      ) : null}
      <div className="grid gap-2">
        {RESULT_VISIBILITY_MODES.map((m) => {
          const id = `${idPrefix}-${m}`
          const checked = mode === m
          return (
            <label
              key={m}
              htmlFor={id}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                checked
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-[color:var(--border-subtle)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
              }`}
            >
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-result-mode`}
                value={m}
                checked={checked}
                onChange={() => onChange({ result_visibility_mode: m, show_results: m !== 'score_only' })}
                className="mt-1 accent-blue-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {t(`examResultModes.${m}.title`, { defaultValue: MODE_COPY[m].title })}
                </span>
                <span className="block text-xs text-token-textMuted">
                  {t(`examResultModes.${m}.hint`, { defaultValue: MODE_COPY[m].hint })}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      {mode === 'after_exam_window' ? (
        <label className="block">
          <span className="text-xs font-semibold text-token-textMuted">
            {t('examResultModes.releaseAt', {
              defaultValue: 'Nəticələrin açılma vaxtı (boş qalsa, imtahanın bitmə vaxtı)',
            })}
          </span>
          <input
            type="datetime-local"
            value={value?.results_release_at || ''}
            onChange={(e) => onChange({ results_release_at: e.target.value })}
            className={`mt-1 w-full ${inputClassName}`}
          />
        </label>
      ) : null}
    </fieldset>
  )
}
