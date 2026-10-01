/**
 * Landing line-icon set: 24×24 grid, 1.75 stroke, round caps, currentColor.
 * Decorative by default (aria-hidden); pass `title` when an icon carries meaning on its own.
 */
function Icon({ className = 'h-5 w-5', title, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export const SparklesIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6L12 3.5z" />
    <path d="M18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
    <path d="M5.5 15.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
  </Icon>
)

export const CheckCircleIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
  </Icon>
)

export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M5 12.5l4.2 4.2L19 7" />
  </Icon>
)

export const LinkIcon = (p) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 005.66 5.66l1-1" />
  </Icon>
)

export const QrIcon = (p) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2M16 16h2v2" />
  </Icon>
)

export const ChartIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20h16" />
    <path d="M7 16v-5M12 16V7M17 16v-8" />
  </Icon>
)

export const CommentIcon = (p) => (
  <Icon {...p}>
    <path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-7.5L7 20v-3.5H5A1.5 1.5 0 013.5 15V7A1.5 1.5 0 015 5.5z" />
    <path d="M8 10h8M8 13h5" />
  </Icon>
)

export const BadgeCheckIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.9 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.9-2.6L4 15.3l.9-2.6L4 10.1l2.2-1.6.9-2.6 2.7.1L12 3z" />
    <path d="M9 12.2l2 2 4-4.2" />
  </Icon>
)

export const SlidersIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
)

export const ShareIcon = (p) => (
  <Icon {...p}>
    <circle cx="17.5" cy="6" r="2.5" />
    <circle cx="6.5" cy="12" r="2.5" />
    <circle cx="17.5" cy="18" r="2.5" />
    <path d="M8.7 10.8l6.6-3.6M8.7 13.2l6.6 3.6" />
  </Icon>
)

export const LockIcon = (p) => (
  <Icon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
    <path d="M12 14.5v2" />
  </Icon>
)

export const SupportIcon = (p) => (
  <Icon {...p}>
    <path d="M4.5 13v-1a7.5 7.5 0 0115 0v1" />
    <rect x="3.5" y="13" width="4" height="6" rx="1.5" />
    <rect x="16.5" y="13" width="4" height="6" rx="1.5" />
    <path d="M18.5 19a3 3 0 01-3 2H13" />
  </Icon>
)

export const TeacherIcon = (p) => (
  <Icon {...p}>
    <circle cx="9" cy="7.5" r="3" />
    <path d="M3.5 20a5.5 5.5 0 0111 0" />
    <path d="M14 4.5h6.5v8H16" />
  </Icon>
)

export const SchoolIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 20.5h17" />
    <path d="M5 20.5V10l7-4.5 7 4.5v10.5" />
    <path d="M10 20.5v-5h4v5" />
    <circle cx="12" cy="11" r="1.5" />
  </Icon>
)

export const GraduationIcon = (p) => (
  <Icon {...p}>
    <path d="M2.5 9.5L12 5l9.5 4.5L12 14 2.5 9.5z" />
    <path d="M6.5 11.5v4c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4" />
    <path d="M21.5 9.5v5" />
  </Icon>
)

export const CompassIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </Icon>
)

export const ArrowRightIcon = (p) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export const PencilIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9a2.83 2.83 0 00-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
)

export const RefreshIcon = (p) => (
  <Icon {...p}>
    <path d="M19.5 8A8 8 0 005 9" />
    <path d="M4.5 16a8 8 0 0014.5-1" />
    <path d="M19.5 4v4h-4M4.5 20v-4h4" />
  </Icon>
)

export const DownloadIcon = (p) => (
  <Icon {...p}>
    <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
    <path d="M4.5 19.5h15" />
  </Icon>
)

export const CopyIcon = (p) => (
  <Icon {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v8A1.5 1.5 0 006 15.5h2.5" />
  </Icon>
)

export const PlusIcon = (p) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
