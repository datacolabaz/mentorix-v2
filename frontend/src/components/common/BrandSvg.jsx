export default function BrandSvg({ className = '', size = 'sidebar' }) {
  const dims =
    size === 'sidebar'
      ? { w: 160, h: 44 }
      : size === 'md'
        ? { w: 140, h: 40 }
        : { w: 200, h: 56 }

  return (
    <svg
      width={dims.w}
      height={dims.h}
      viewBox="0 0 220 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mentorix"
      role="img"
    >
      {/* Monogram (currentColor) */}
      <path
        d="M18 44V16c0-3.3 2.7-6 6-6h3.4c1.9 0 3.7.9 4.9 2.4l10.7 13.5 10.7-13.5A6.2 6.2 0 0 1 58.6 10H62c3.3 0 6 2.7 6 6v28"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />
      <path
        d="M78 40V20"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.35"
      />

      {/* Wordmark (uses currentColor; relies on loaded fonts, falls back gracefully) */}
      <text
        x="92"
        y="41"
        fill="currentColor"
        fontSize="26"
        fontWeight="800"
        fontFamily="Syne, ui-sans-serif, system-ui"
        letterSpacing="0.3px"
      >
        Mentorix
      </text>
    </svg>
  )
}

