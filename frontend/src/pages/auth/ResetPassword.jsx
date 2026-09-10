import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { setPageSeo } from '../../lib/pageSeo'
import useUiStore from '../../hooks/useUi'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams])
  const toast = useToast()
  const navigate = useNavigate()
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'

  const [loading, setLoading] = useState(false)
  const [pass1, setPass1] = useState('')
  const [pass2, setPass2] = useState('')

  useEffect(() => {
    setPageSeo({
      title: 'Mentorix — parol bərpası',
      description: 'Parolunuzu yeniləyin.',
      canonicalPath: '/reset-password',
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!token) {
      toast('Token tapılmadı. Emaildəki linki yenidən açın.', 'error')
      return
    }
    if (!pass1 || pass1.length < 8) {
      toast('Şifrə ən azı 8 simvol olmalıdır', 'error')
      return
    }
    if (pass1 !== pass2) {
      toast('Şifrələr eyni deyil', 'error')
      return
    }
    setLoading(true)
    try {
      const r = await api.post('/auth/password/reset', { token, new_password: pass1 })
      toast(r?.message || 'Şifrə yeniləndi', 'success')
      setTimeout(() => navigate('/login', { replace: true }), 400)
    } catch (err) {
      toast(err?.response?.data?.message || err?.message || 'Xəta baş verdi', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={[
        'login-wrapper min-h-screen flex items-center justify-center p-4',
        isDark ? 'theme-dark' : 'theme-light',
      ].join(' ')}
    >
      <div
        className={[
          'w-full max-w-lg rounded-2xl border p-6',
          isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm',
        ].join(' ')}
      >
        <div className="flex items-center justify-center mb-4">
          <Brand size="login" tone={isDark ? 'dark' : 'light'} />
        </div>
        <h1
          className={[
            'text-center font-display font-extrabold text-xl mb-2',
            isDark ? 'text-white' : 'text-slate-900',
          ].join(' ')}
        >
          Parol bərpası
        </h1>
        <p
          className={[
            'text-center text-sm leading-relaxed',
            isDark ? 'text-gray-300' : 'text-slate-600',
          ].join(' ')}
        >
          Yeni şifrənizi daxil edin.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label
              className={[
                'block text-xs font-semibold uppercase tracking-wider mb-2',
                isDark ? 'text-gray-400' : 'text-slate-500',
              ].join(' ')}
            >
              Yeni şifrə
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className={[
                'mx-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none border',
                isDark
                  ? 'bg-surface-1 border-white/10 text-white placeholder:text-gray-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
              ].join(' ')}
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              placeholder="ən azı 8 simvol"
            />
          </div>
          <div>
            <label
              className={[
                'block text-xs font-semibold uppercase tracking-wider mb-2',
                isDark ? 'text-gray-400' : 'text-slate-500',
              ].join(' ')}
            >
              Yeni şifrə (təkrar)
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className={[
                'mx-auth-input w-full rounded-xl px-4 py-3 text-sm outline-none border',
                isDark
                  ? 'bg-surface-1 border-white/10 text-white placeholder:text-gray-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400',
              ].join(' ')}
              value={pass2}
              onChange={(e) => setPass2(e.target.value)}
              placeholder="şifrəni yenidən yazın"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="w-full sm:flex-1 justify-center" loading={loading} disabled={loading}>
              Şifrəni yenilə
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:flex-1 justify-center"
              onClick={() => navigate('/login')}
              disabled={loading}
            >
              Geri
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

