function IconBase({ children, className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  )
}

export default function NavIcon({ name, className = 'w-5 h-5' }) {
  switch (name) {
    case 'dashboard':
      return (
        <IconBase className={className}>
          <path d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-11h7V4h-7v5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </IconBase>
      )
    case 'courses':
      return (
        <IconBase className={className}>
          <path d="M4 6h16v12H4V6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 4h8v2H8V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'students':
      return (
        <IconBase className={className}>
          <path d="M7 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm10 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M2.5 20a5.5 5.5 0 0 1 11 0M10.5 20a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'schedule':
      return (
        <IconBase className={className}>
          <path d="M7 3v3m10-3v3M4 9h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </IconBase>
      )
    case 'attendance':
      return (
        <IconBase className={className}>
          <path d="M9 11l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </IconBase>
      )
    case 'exams':
      return (
        <IconBase className={className}>
          <path d="M7 4h10v16H7V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'tasks':
      return (
        <IconBase className={className}>
          <path d="M9 6h11M9 12h11M9 18h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </IconBase>
      )
    case 'analytics':
      return (
        <IconBase className={className}>
          <path d="M4 19V5M4 19h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 15l4-4 3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </IconBase>
      )
    case 'payments':
      return (
        <IconBase className={className}>
          <path d="M4 7h16v10H4V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M4 11h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M7 15h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'notifications':
      return (
        <IconBase className={className}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'settings':
      return (
        <IconBase className={className}>
          <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="2" />
          <path d="M19.4 15a8 8 0 0 0 .1-1l2-1.2-2-3.4-2.3.7a7.8 7.8 0 0 0-1.7-1L15.1 6h-6.2L8.5 9.1a7.8 7.8 0 0 0-1.7 1L4.5 9.4 2.5 12.8 4.5 14a8 8 0 0 0 .1 1l-2 1.2 2 3.4 2.3-.7a7.8 7.8 0 0 0 1.7 1l.4 3.1h6.2l.4-3.1a7.8 7.8 0 0 0 1.7-1l2.3.7 2-3.4-2-1.2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </IconBase>
      )
    case 'progress':
      return (
        <IconBase className={className}>
          <path d="M4 19V5m0 14h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 16v-4M12 16V8M16 16v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'instructors':
      return (
        <IconBase className={className}>
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M17.5 3.5h4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </IconBase>
      )
    case 'children':
      return (
        <IconBase className={className}>
          <path d="M9 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm6 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M3 21a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'groups':
      return (
        <IconBase className={className}>
          <path d="M4 19V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'materials':
      return (
        <IconBase className={className}>
          <path d="M4 7h6l2 2h8v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'materials_upload':
      return (
        <IconBase className={className}>
          <path d="M12 16V6m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </IconBase>
      )
    case 'chat':
      return (
        <IconBase className={className}>
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </IconBase>
      )
    default:
      return <span className={className} aria-hidden />
  }
}

