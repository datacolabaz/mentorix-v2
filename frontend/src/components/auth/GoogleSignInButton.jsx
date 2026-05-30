import { useEffect, useRef, useState } from 'react'
import Button from '../common/Button'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export default function GoogleSignInButton({ onCredential, disabled, label = 'Google ilə davam et' }) {
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
      })
      divRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(divRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'continue_with',
        locale: 'az',
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
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <div ref={divRef} className="flex justify-center min-h-[44px]" />
      {!ready && (
        <Button type="button" variant="secondary" className="w-full justify-center" disabled>
          {label}…
        </Button>
      )}
    </div>
  )
}
