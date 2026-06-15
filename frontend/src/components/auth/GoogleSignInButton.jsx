import { useCallback, useEffect, useRef, useState } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

/** Rəsmi Google «G» loqosu (brend rəngləri) */
function GoogleGIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function renderGoogleButton(container, width, context) {
  if (!window.google?.accounts?.id || !container) return
  container.innerHTML = ''
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'rectangular',
    width: Math.max(280, Math.floor(width || 280)),
    text: context === 'signup' ? 'signup_with' : 'signin_with',
    locale: 'az',
    logo_alignment: 'left',
  })
}

function clickEmbeddedGoogleButton(hitEl) {
  if (!hitEl) return false
  const inner =
    hitEl.querySelector('[role="button"]') ||
    hitEl.querySelector('div[tabindex="0"]') ||
    hitEl.querySelector('iframe')
  if (!inner) return false
  try {
    inner.click()
    return true
  } catch {
    return false
  }
}

export default function GoogleSignInButton({
  onCredential,
  disabled,
  label = 'Google ilə davam et',
  context = 'signin',
}) {
  const wrapRef = useRef(null)
  const hitRef = useRef(null)
  const onCredentialRef = useRef(onCredential)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')

  onCredentialRef.current = onCredential

  const paintButton = useCallback(() => {
    if (!hitRef.current || !wrapRef.current) return
    const w = wrapRef.current.offsetWidth
    if (w < 40) return
    renderGoogleButton(hitRef.current, w, context)
    setReady(true)
  }, [context])

  useEffect(() => {
    if (!CLIENT_ID) {
      setErr('Google girişi konfiqurasiya olunmayıb')
      return
    }

    const mount = () => {
      if (!window.google?.accounts?.id || !hitRef.current || !wrapRef.current) return

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => {
          if (resp?.credential) onCredentialRef.current?.(resp.credential)
        },
        context: context === 'signup' ? 'signup' : 'signin',
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        use_fedcm_for_prompt: false,
      })

      try {
        window.google.accounts.id.cancel()
        window.google.accounts.id.disableAutoSelect()
      } catch {
        /* One Tap bağla */
      }

      paintButton()
    }

    if (window.google?.accounts?.id) {
      mount()
      return
    }

    const existing = document.querySelector('script[data-mx-gsi]')
    if (existing) {
      existing.addEventListener('load', mount)
      return () => existing.removeEventListener('load', mount)
    }

    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.dataset.mxGsi = '1'
    s.onload = mount
    s.onerror = () => setErr('Google skripti yüklənmədi')
    document.head.appendChild(s)
    return () => {
      s.onload = null
    }
  }, [context, paintButton])

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(() => paintButton())
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [paintButton])

  /** Tab/modal gizli olanda en=0 olur — görünəndə yenidən render */
  useEffect(() => {
    if (!wrapRef.current || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          window.requestAnimationFrame(() => paintButton())
        }
      },
      { threshold: 0.01 },
    )
    obs.observe(wrapRef.current)
    return () => obs.disconnect()
  }, [paintButton])

  const handleProxyTap = () => {
    if (disabled) return
    clickEmbeddedGoogleButton(hitRef.current)
  }

  if (!CLIENT_ID) {
    return (
      <p className="text-xs text-amber-200/90 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
        Google girişi üçün VITE_GOOGLE_CLIENT_ID təyin edilməlidir.
      </p>
    )
  }

  if (err) {
    return <p className="text-xs text-red-300">{err}</p>
  }

  return (
    <div
      ref={wrapRef}
      className={['mx-google-signin relative w-full min-h-[52px]', disabled ? 'opacity-50 pointer-events-none' : ''].join(
        ' ',
      )}
      onClick={handleProxyTap}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleProxyTap()
        }
      }}
    >
      <div
        className="mx-google-signin__decor flex w-full min-h-[52px] items-center justify-center gap-3 rounded-xl border border-white/12 bg-[#141414] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors"
        aria-hidden
      >
        <GoogleGIcon />
        <span className="text-sm font-semibold text-white">{label}</span>
        {!ready ? (
          <span className="text-xs text-gray-500 animate-pulse">…</span>
        ) : null}
      </div>

      <div
        ref={hitRef}
        className="mx-google-signin__hit absolute inset-0 z-10 overflow-hidden rounded-xl"
        aria-label={label}
      />
    </div>
  )
}
