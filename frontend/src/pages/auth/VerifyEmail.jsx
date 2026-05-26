import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { setPageSeo } from '../../lib/pageSeo'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams])
  const toast = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('E-poçt təsdiqi prosesinə başlayır...')
  const [kind, setKind] = useState('loading') // loading | success | error

  useEffect(() => {
    setPageSeo({
      title: 'Mentorix — e-poçt təsdiqi',
      description: 'E-poçt ünvanınızı təsdiqləyin.',
      canonicalPath: '/verify-email',
    })
  }, [])

  useEffect(() => {
    if (!token) {
      setKind('error')
      setMessage('Token tapılmadı və ya link səhvdir.')
      return
    }

    void (async () => {
      setLoading(true)
      setKind('loading')
      setMessage('E-poçt təsdiqlənir...')
      try {
        const r = await api.post('/auth/verify-email', { token })
        setKind('success')
        setMessage(r?.message || 'Email təsdiqləndi')
        toast(r?.message || 'Email təsdiqləndi', 'success')
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || 'Xəta baş verdi'
        setKind('error')
        setMessage(msg)
        toast(msg, 'error')
      } finally {
        setLoading(false)
      }
    })()
  }, [token, toast])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-center mb-4">
          <Brand />
        </div>

        <h1 className="text-center font-display font-extrabold text-xl text-white mb-3">
          E-poçt təsdiqi
        </h1>

        <p className="text-center text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
          {message}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            disabled={loading || kind !== 'success'}
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto"
          >
            Daxil ol
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => navigate('/login')}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            Geri
          </Button>
        </div>
      </div>
    </div>
  )
}

