import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useUiStore from '../hooks/useUi'
import { UI_LOCALES, uiLocaleMeta } from '../lib/uiLocales'

function Chevron({ open, className = 'h-3.5 w-3.5' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={`${className} transition-transform ${open ? 'rotate-180' : ''}`}
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/** Bayraq + AZ ▾ dil menyusu — auth, landing navbar və sidebar. */
export default function LanguageSwitcher({
  className = '',
  tone = 'auto',
  size = 'compact',
  /** 'auto' flips upward near the viewport bottom (sidebar footer). */
  menuPlacement = 'auto',
}) {
  const { t, i18n } = useTranslation()
  const { locale, setLocale, theme } = useUiStore()
  const isDark = tone === 'dark' || (tone === 'auto' && theme === 'dark')
  const comfortable = size === 'comfortable'
  const active = uiLocaleMeta(locale || i18n.language || 'az')
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState(menuPlacement === 'top' ? 'top' : 'bottom')
  const [hAlign, setHAlign] = useState('end')
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const menuH = 200
    const menuW = 220

    if (menuPlacement === 'top') setPlacement('top')
    else if (menuPlacement === 'bottom') setPlacement('bottom')
    else {
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setPlacement(spaceBelow < menuH && spaceAbove > spaceBelow ? 'top' : 'bottom')
    }

    const spaceRight = window.innerWidth - rect.left
    const spaceLeft = rect.right
    setHAlign(spaceRight < menuW && spaceLeft > spaceRight ? 'end' : 'start')
  }, [open, menuPlacement])

  const pick = (code) => {
    setOpen(false)
    if (code === active.code) return
    setLocale(code)
  }

  const openUp = placement === 'top'

  return (
    <div ref={wrapRef} className={['relative', comfortable ? 'w-full' : 'w-fit', className].join(' ')}>
      <button
        type="button"
        className={[
          'inline-flex items-center gap-2 rounded-full border font-semibold transition-colors',
          comfortable ? 'w-full min-h-[48px] justify-between px-4 text-base' : 'h-9 sm:h-8 px-2.5 sm:px-3 text-xs sm:text-[13px]',
          isDark
            ? 'border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]'
            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('layout.language')}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <span className="text-base leading-none" aria-hidden>
            {active.flag}
          </span>
          <span className="uppercase tracking-wide hidden min-[380px]:inline">{active.short}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t('layout.language')}
          className={[
            'absolute z-[120] min-w-[13.5rem] overflow-hidden rounded-2xl border py-1.5 shadow-xl',
            openUp ? 'bottom-full mb-2' : 'top-full mt-2',
            comfortable ? 'left-0 right-0' : hAlign === 'end' ? 'right-0' : 'left-0',
            isDark ? 'border-white/10 bg-[#1c1c1c] text-white' : 'border-slate-200 bg-white text-slate-900',
          ].join(' ')}
        >
          {UI_LOCALES.map((loc) => {
            const on = loc.code === active.code
            return (
              <li key={loc.code} role="option" aria-selected={on}>
                <button
                  type="button"
                  onClick={() => pick(loc.code)}
                  className={[
                    'flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-sm font-medium',
                    on
                      ? isDark
                        ? 'bg-white/10'
                        : 'bg-slate-100'
                      : isDark
                        ? 'hover:bg-white/[0.06]'
                        : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {loc.flag}
                  </span>
                  <span>{loc.nativeName}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
