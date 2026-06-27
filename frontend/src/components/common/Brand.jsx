const SIZE_CLASSES = {
  login: 'text-[1.65rem] sm:text-[1.85rem]',
  sidebar: 'text-[1.45rem] sm:text-[1.65rem]',
  nav: 'text-lg sm:text-2xl',
  md: 'text-[1.05rem] sm:text-xl',
}

function wordmarkTone(tone) {
  if (tone === 'light') {
    return { main: 'text-slate-900', io: 'opacity-50' }
  }
  if (tone === 'inherit') {
    return { main: 'text-inherit', io: 'opacity-50' }
  }
  return { main: 'text-white', io: 'opacity-45' }
}

function BrandWordmark({
  tone = 'dark',
  textSizeClass = SIZE_CLASSES.md,
  className = '',
  textClassName = '',
  centered = false,
  showDot = false,
}) {
  const colors = wordmarkTone(tone)

  return (
    <div
      className={[
        'flex min-w-0',
        centered ? 'flex-col items-center justify-center' : 'items-center',
        className,
      ].join(' ')}
    >
      <span
        className={[
          'font-display font-bold tracking-[-0.02em] leading-none',
          colors.main,
          textSizeClass,
          textClassName,
        ].join(' ')}
      >
        Mentorix
        <span className={`${colors.io} text-[0.72em] font-semibold`}>.io</span>
      </span>
      {showDot ? (
        <span className="mx-nav-live-dot h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
      ) : null}
    </div>
  )
}

export default function Brand({
  className = '',
  imgClassName = '',
  showText = false,
  textClassName = '',
  size = 'md', // md | sidebar | login | nav
  tone = 'dark', // dark | light | inherit
}) {
  if (size === 'nav') {
    return (
      <BrandWordmark
        tone="dark"
        textSizeClass={SIZE_CLASSES.nav}
        className={`gap-1.5 ${className}`}
        textClassName={textClassName}
        showDot
      />
    )
  }

  if (size === 'login') {
    return (
      <BrandWordmark
        tone="dark"
        textSizeClass={SIZE_CLASSES.login}
        className={className}
        textClassName={textClassName}
        centered
      />
    )
  }

  if (size === 'sidebar') {
    return (
      <BrandWordmark
        tone={tone}
        textSizeClass={SIZE_CLASSES.sidebar}
        className={`mx-auto w-[92%] ${className}`}
        textClassName={textClassName}
        centered
      />
    )
  }

  return (
    <BrandWordmark
      tone={tone}
      textSizeClass={SIZE_CLASSES.md}
      className={`max-w-[min(260px,82vw)] ${className}`}
      textClassName={textClassName}
      centered={false}
    />
  )
}
