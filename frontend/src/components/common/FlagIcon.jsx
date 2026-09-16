/**
 * SVG flag icons — renders identically on all platforms including Windows
 * where emoji flags are not supported.
 */

const FLAGS = {
  gb: (
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0L60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="4" clipPath="polygon(0 0,60 0,60 40,0 40)" />
      <path d="M30 0V40M0 20H60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  ),
  az: (
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="60" height="13.4" fill="#00B5E2" />
      <rect y="13.3" width="60" height="13.4" fill="#EF3340" />
      <rect y="26.6" width="60" height="13.4" fill="#509E2F" />
      <circle cx="30" cy="20" r="6" fill="#fff" />
      <circle cx="31.5" cy="20" r="5" fill="#EF3340" />
      <path d="M35.5 20l-1.4-1.5.6-1.8-1.9.9-1.4-1.5v2l-1.9-.9.6 1.8z" fill="#fff" />
      <path d="M31.5 15.5l.3 1.5 1.4.3-1.4.4-.3 1.4-.4-1.4-1.4-.4 1.4-.3z" fill="#fff" transform="translate(2.5,2.8)" />
    </svg>
  ),
  ru: (
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="60" height="13.4" fill="#fff" />
      <rect y="13.3" width="60" height="13.4" fill="#0039A6" />
      <rect y="26.6" width="60" height="13.4" fill="#D52B1E" />
    </svg>
  ),
  tr: (
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="60" height="40" fill="#E30A17" />
      <circle cx="25" cy="20" r="10" fill="#fff" />
      <circle cx="27" cy="20" r="8" fill="#E30A17" />
      <path d="M35.5 15l1.4 3.2 3.5.2-2.7 2.2.9 3.4-3.1-1.9-3.1 1.9.9-3.4-2.7-2.2 3.5-.2z" fill="#fff" />
    </svg>
  ),
  de: (
    <svg viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <rect width="60" height="13.4" fill="#000" />
      <rect y="13.3" width="60" height="13.4" fill="#DD0000" />
      <rect y="26.6" width="60" height="13.4" fill="#FFCE00" />
    </svg>
  ),
}

export default function FlagIcon({ code, className = 'h-4 w-6' }) {
  const flag = FLAGS[code]
  if (!flag) return null
  return <span className={`inline-block shrink-0 overflow-hidden rounded-[3px] shadow-sm ${className}`}>{flag}</span>
}
