import { useEffect, useRef, useState } from 'react'
import Button from '../common/Button'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function GoogleSignInButton({ onCredential, disabled, label = 'Google ilə davam et' }) {
  const wrapRef = useRef(null)
  const divRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!CLIENT_ID) {
      setErr('Google girişi konfiqurasiya olunmayıb')
      return
    }

    const mount = () => {
      if (!window.google?.accounts?.id || !divRef.current) return

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp) => {
          if (resp?.credential) onCredential?.(resp.credential)
        },
        context: 'signin',
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
        use_fedcm_for_prompt: false,
      })

      try {
        window.google.accounts.id.cancel()
        window.google.accounts.id.disableAutoSelect()
      } catch {
        /* One Tap açıqdırsa bağla */
      }

      const width = Math.max(280, Math.floor(wrapRef.current?.offsetWidth || 320))
      divRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(divRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        width,
        text: 'continue_with',
        locale: 'az',
        logo_alignment: 'left',
      })
      setReady(true)
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
  }, [onCredential])

  useEffect(() => {
    if (!ready || !wrapRef.current) return
    const ro = new ResizeObserver(() => {
      if (!window.google?.accounts?.id || !divRef.current) return
      const width = Math.max(280, Math.floor(wrapRef.current.offsetWidth || 320))
      divRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(divRef.current, {
        type: 'standard',
        theme: 'filled_black',
        size: 'large',
        shape: 'rectangular',
        width,
        text: 'continue_with',
        locale: 'az',
        logo_alignment: 'left',
      })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [ready])

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
      className={[
        'mx-google-signin w-full',
        disabled ? 'opacity-50 pointer-events-none' : '',
      ].join(' ')}
    >
      <div ref={divRef} className="flex justify-center w-full min-h-[48px] [&>div]:!w-full [&>div]:!max-w-full" />
      {!ready && (
        <Button type="button" variant="secondary" className="w-full justify-center rounded-full" disabled>
          {label}…
        </Button>
      )}
    </div>
  )
}
