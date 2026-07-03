import { useTranslation } from 'react-i18next'

const LEVEL_STYLES = {
  beginner: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
  intermediate: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
  advanced: 'border-violet-500/35 bg-violet-500/10 text-violet-300',
  professional: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
};

export default function LevelBadge({ level, className = '' }) {
  const { t } = useTranslation()
  const key = String(level || 'beginner').toLowerCase();
  const labelKey = `certifiedExams.levels.${key}`;
  const label = t(labelKey, { defaultValue: level });
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        LEVEL_STYLES[key] || LEVEL_STYLES.beginner,
        className,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

export { LEVEL_STYLES };
