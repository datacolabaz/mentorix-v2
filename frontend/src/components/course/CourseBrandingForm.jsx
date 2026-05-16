import { useEffect, useRef, useState } from 'react'
import api from '../../lib/api'
import { resolveApiAssetUrl } from '../../lib/apiAssetUrl'
import useAuthStore from '../../hooks/useAuth'
import Button from '../common/Button'
import Card from '../common/Card'

async function refreshAuthUser(updateUser) {
  const d = await api.get('/auth/me')
  if (d?.user) updateUser(d.user)
}

export default function CourseBrandingForm({ onSaved, showHint = true, submitLabel = 'Yadda saxla' }) {
  const { updateUser } = useAuthStore()
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState(null)
  const [courseName, setCourseName] = useState('')
  const [branchAddress, setBranchAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .get('/course/settings')
      .then((res) => {
        if (cancelled) return
        const s = res.settings || {}
        setCourseName(s.course_name || '')
        setBranchAddress(s.branch_address || '')
        setLogoUrl(s.logo_url || null)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || 'Parametrlər yüklənmədi')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const displayLogo = logoPreview || (logoUrl ? resolveApiAssetUrl(logoUrl) : null)
  const initials = (courseName || 'K')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const onPickLogo = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Yalnız şəkil faylı seçin (PNG, JPG)')
      return
    }
    setError(null)
    setLogoPreview(URL.createObjectURL(file))
    void uploadLogo(file)
  }

  const uploadLogo = async (file) => {
    setUploadingLogo(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('logo', file)
      const res = await api.post('/course/settings/logo', form)
      setLogoUrl(res.logo_url || res.settings?.logo_url || null)
      setLogoPreview(null)
      await refreshAuthUser(updateUser)
    } catch (err) {
      setError(err?.response?.data?.message || 'Loqo yüklənmədi')
      setLogoPreview(null)
    } finally {
      setUploadingLogo(false)
    }
  }

  const save = async (e) => {
    e?.preventDefault?.()
    const name = courseName.trim()
    if (!name) {
      setError('Kurs adını daxil edin (məs: Telman Abdullayev Tədris Mərkəzi)')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.patch('/course/settings', {
        course_name: name,
        branch_address: branchAddress.trim() || null,
      })
      await refreshAuthUser(updateUser)
      onSaved?.()
    } catch (err) {
      setError(err?.response?.data?.message || 'Yadda saxlanmadı')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-token-textMuted">Yüklənir…</p>
  }

  return (
    <form onSubmit={(e) => void save(e)} className="space-y-5">
      {showHint ? (
        <p className="text-sm text-token-textMuted leading-relaxed">
          Kurs panelində görünəcək ad və loqonu təyin edin. Məsələn:{' '}
          <span className="text-white/90">Telman Abdullayev Tədris Mərkəzi</span>.
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}

      <Card className="p-5 border border-white/10">
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="relative w-20 h-20 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 flex items-center justify-center overflow-hidden shrink-0">
            {displayLogo ? (
              <img src={displayLogo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-emerald-100/90">{initials}</span>
            )}
            {uploadingLogo ? (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-xs text-white">
                …
              </div>
            ) : null}
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <p className="text-sm font-medium text-white">Kurs loqosu</p>
            <p className="text-xs text-token-textMuted">PNG və ya JPG, maksimum 2 MB</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadingLogo}
              onClick={() => fileRef.current?.click()}
              className="justify-center"
            >
              {uploadingLogo ? 'Yüklənir…' : 'Loqo seç'}
            </Button>
          </div>
        </div>
      </Card>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-token-textMuted">Kurs adı</span>
        <input
          type="text"
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="Telman Abdullayev Tədris Mərkəzi"
          className="w-full rounded-xl px-3 py-2.5 text-sm border border-white/10 bg-white/[0.04] text-white placeholder:text-token-textMuted focus:border-emerald-500/40 outline-none"
          maxLength={120}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium uppercase tracking-wider text-token-textMuted">Filial ünvanı (istəyə bağlı)</span>
        <input
          type="text"
          value={branchAddress}
          onChange={(e) => setBranchAddress(e.target.value)}
          placeholder="Bakı, Nərimanov rayonu…"
          className="w-full rounded-xl px-3 py-2.5 text-sm border border-white/10 bg-white/[0.04] text-white placeholder:text-token-textMuted focus:border-emerald-500/40 outline-none"
        />
      </label>

      <Button type="submit" loading={saving} className="w-full sm:w-auto justify-center">
        {submitLabel}
      </Button>
    </form>
  )
}
