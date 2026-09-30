import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import useUiStore from '../../hooks/useUi'

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1" />
      <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

/**
 * Şifrə sahəsi + göstər/gizlət düyməsi. Görünmə vəziyyəti heç yerdə saxlanmır (reload-da yenə gizlidir).
 * autoComplete: giriş üçün «current-password», yaratma/bərpa üçün «new-password».
 */
const PasswordInput = forwardRef(function PasswordInput(
  { id, className = '', autoComplete = 'current-password', ...inputProps },
  ref,
) {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'
  const fallbackId = useId()
  const inputId = id || fallbackId
  const inputRef = useRef(null)
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => inputRef.current)

  // Password managers detect credentials by type="password" at submit time.
  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return undefined
    const onSubmit = () => {
      if (inputRef.current) inputRef.current.type = 'password'
      setVisible(false)
    }
    form.addEventListener('submit', onSubmit)
    return () => form.removeEventListener('submit', onSubmit)
  }, [])

  const toggle = useCallback(() => setVisible((v) => !v), [])
  const label = visible ? t('auth.hidePassword') : t('auth.showPassword')

  return (
    <div className="relative">
      <input
        {...inputProps}
        ref={inputRef}
        id={inputId}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={`${className} pr-12`}
      />
      <button
        type="button"
        onClick={toggle}
        aria-controls={inputId}
        aria-pressed={visible}
        aria-label={label}
        title={label}
        className={[
          'absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-lg',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0',
          isDark
            ? 'text-gray-300 hover:text-white hover:bg-white/[0.06] focus-visible:ring-primary'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-500/10 focus-visible:ring-emerald-700',
        ].join(' ')}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
})

export default PasswordInput
