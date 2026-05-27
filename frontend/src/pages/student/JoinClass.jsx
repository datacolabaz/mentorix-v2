import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Brand from '../../components/common/Brand'
import { useToast } from '../../components/common/Toast'

const inputClass =
  'w-full bg-surface-1 border border-white/10 rounded-xl px-4 py-4 text-white text-lg outline-none focus:border-primary/40 text-center tracking-widest'

export default function JoinClass() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const params = useParams()
  const [searchParams] = useSearchParams()

  const initialCode = useMemo(() => {
    const c = String(params.code || searchParams.get('code') || '').trim()
    return c
  }, [params.code, searchParams])

  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState(null)

  useEffect(() => {
    if (!user) return
    void api
      .get('/students/my/link')
      .then((d) => setLink(d?.link || null))
      .catch(() => {})
  }, [user])

  const submit = async (e) => {
    e?.preventDefault?.()
    const v = String(code || '').trim().toUpperCase().replace(/\s+/g, '')
    if (!v) return toast('Kodu daxil edin', 'error')
    setBusy(true)
    try {
      const r = await api.post('/students/my/join', { code: v })
      toast(r?.message || 'Qoşuldunuz', 'success')
      navigate('/student', { replace: true })
    } catch (err) {
      const st = err?.status ?? err?.response?.status
      const msg = err?.response?.data?.message || err?.message || 'Xəta baş verdi'
      if (st === 401 || st === 403) {
        toast('Daxil olun', 'error')
        navigate('/login', { replace: true })
        return
      }
      toast(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <Brand />
          <div className="mt-4 text-white font-display font-bold text-xl">Qrupa qoşul</div>
          <div className="mt-2 text-sm text-gray-400">Davam etmək üçün əvvəlcə daxil olun.</div>
          <Button className="w-full justify-center mt-5" onClick={() => navigate('/login')}>
            Login
          </Button>
        </div>
      </div>
    )
  }

  if (link?.enrollment_id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <Brand />
          <div className="mt-4 text-white font-display font-bold text-xl">Siz artıq qoşulmusunuz</div>
          <div className="mt-2 text-sm text-gray-300">
            {link?.group_name ? (
              <>
                Qrup: <strong className="text-white">{link.group_name}</strong>
              </>
            ) : (
              'Aktiv müəllim bağlantınız var.'
            )}
          </div>
          <Button className="w-full justify-center mt-5" onClick={() => navigate('/student', { replace: true })}>
            Panelə keç
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-center">
          <Brand />
        </div>
        <div className="mt-4 text-center text-white font-display font-bold text-xl">Qrupa qoşul</div>
        <div className="mt-2 text-center text-sm text-gray-400">
          Müəllimin verdiyi join kodunu daxil edin (məs: <span className="text-gray-200 font-semibold">MX-48291</span>)
        </div>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <input
            className={inputClass}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="MX-00000"
            autoCapitalize="characters"
          />
          <Button className="w-full justify-center" loading={busy} type="submit">
            Qoşul
          </Button>
        </form>
      </div>
    </div>
  )
}

