import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../lib/api'

const COOKIE = 'mx_partner_ref'
const SESSION_KEY = 'mx_partner_session'

function ensureSessionKey() {
  try {
    let k = localStorage.getItem(SESSION_KEY)
    if (!k) {
      k = `ps_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
      localStorage.setItem(SESSION_KEY, k)
    }
    return k
  } catch {
    return null
  }
}

function setRefCookie(code, days = 90) {
  try {
    const maxAge = Math.max(1, Number(days) || 90) * 86400
    document.cookie = `${COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${maxAge}; SameSite=Lax`
    localStorage.setItem(COOKIE, code)
  } catch {
    // ignore
  }
}

export function readStoredPartnerRef() {
  try {
    const fromLs = localStorage.getItem(COOKIE)
    if (fromLs) return fromLs
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`))
    return match ? decodeURIComponent(match[1]) : null
  } catch {
    return null
  }
}

export function readPartnerSessionKey() {
  return ensureSessionKey()
}

/** Landing /r/:code — track click then redirect to signup with ?ref= */
export default function PartnerReferralLanding() {
  const { code } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const sessionKey = ensureSessionKey()
      const redirect = search.get('redirect') || '/register'
      try {
        const res = await api.get(`/public/r/${encodeURIComponent(code)}`, {
          params: {
            session_key: sessionKey,
            redirect,
            utm_source: search.get('utm_source') || undefined,
            utm_medium: search.get('utm_medium') || undefined,
            referrer_url:
              search.get('referrer') ||
              search.get('referrer_url') ||
              (typeof document !== 'undefined' ? document.referrer || undefined : undefined),
          },
        })
        if (cancelled) return
        if (res?.code) {
          setRefCookie(res.code, res.attribution_window_days || 90)
        }
        const target = res?.redirect || redirect
        const sep = target.includes('?') ? '&' : '?'
        navigate(`${target}${sep}ref=${encodeURIComponent(res?.code || code)}`, { replace: true })
      } catch (e) {
        if (cancelled) return
        setError(e?.message || 'Referral kodu etibarsızdır')
        setTimeout(() => navigate('/register', { replace: true }), 2500)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [code, navigate, search])

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 text-token-textMuted">
      {error || 'Yönləndirilir…'}
    </div>
  )
}
