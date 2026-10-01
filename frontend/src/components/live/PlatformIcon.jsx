const STYLES = {
  google_meet: { bg: 'bg-brand-subtle', fg: 'text-brand-text' },
  zoom: { bg: 'bg-info-subtle', fg: 'text-info' },
  other: { bg: 'bg-canvas-subtle', fg: 'text-fg-muted' },
}

export default function PlatformIcon({ platform, className = 'h-9 w-9' }) {
  const s = STYLES[platform] || STYLES.other
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-xl ${s.bg} ${s.fg} ${className}`} aria-hidden="true">
      {platform === 'other' || !STYLES[platform] ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
          <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
          <path d="m15.5 10.5 6-3.5v10l-6-3.5" />
        </svg>
      )}
    </span>
  )
}

export function ExternalLinkIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4 10 14" />
      <path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
