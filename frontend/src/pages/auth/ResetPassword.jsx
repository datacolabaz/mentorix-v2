import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import Brand from '../../components/common/Brand'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { setPageSeo } from '../../lib/pageSeo'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => String(searchParams.get('token') || '').trim(), [searchParams])
  const toast = useToast()
  const navigate = useNavigate()

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
    <div className="login-wrapper theme-light min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center mb-4">
          <Brand size="login" tone="light" />
        </div>
        <h1 className="text-center font-display font-extrabold text-xl text-slate-900 mb-2">
          Parol bərpası
        </h1>
        <p className="text-center text-sm text-slate-600 leading-relaxed">
          Yeni şifrənizi daxil edin.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Yeni şifrə
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="mx-auth-input w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm outline-none"
              value={pass1}
              onChange={(e) => setPass1(e.target.value)}
              placeholder="ən azı 8 simvol"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Yeni şifrə (təkrar)
            </label>
            <input
              type="password"
              autoComplete="new-password"
              className="mx-auth-input w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm outline-none"
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

