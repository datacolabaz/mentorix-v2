const LEVEL_STYLES = {
  beginner: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300',
  intermediate: 'border-sky-500/35 bg-sky-500/10 text-sky-300',
  advanced: 'border-violet-500/35 bg-violet-500/10 text-violet-300',
  professional: 'border-amber-500/35 bg-amber-500/10 text-amber-200',
};

const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  professional: 'Professional',
};

export default function LevelBadge({ level, className = '' }) {
  const key = String(level || 'beginner').toLowerCase();
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        LEVEL_STYLES[key] || LEVEL_STYLES.beginner,
        className,
      ].join(' ')}
    >
      {LEVEL_LABELS[key] || level}
    </span>
  );
}

export { LEVEL_LABELS, LEVEL_STYLES };
