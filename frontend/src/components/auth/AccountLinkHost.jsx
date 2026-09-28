import { useEffect, useState } from 'react'
import api from '../../lib/api'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { ACCOUNT_LINK_EVENT } from '../../lib/googleAuth'

const ROLE_LABEL = {
  instructor: 'Müəllim',
  student: 'Tələbə',
  course: 'Tədris mərkəzi',
  parent: 'Valideyn',
  admin: 'Admin',
}

function sinceYear(iso) {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null
}

/**
 * Google girişi mövcud (köhnə) hesabın email-i ilə üst-üstə düşəndə açıq təsdiq pəncərəsi.
 * Təsdiq olmadan heç bir hesab birləşdirilmir və yeni hesab yaradılmır.
 */
export default function AccountLinkHost() {
  const [request, setRequest] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onRequest = (e) => {
      setError('')
      setRequest(e.detail)
    }
    window.addEventListener(ACCOUNT_LINK_EVENT, onRequest)
    return () => window.removeEventListener(ACCOUNT_LINK_EVENT, onRequest)
  }, [])

  if (!request) return null
  const { offer, resolve, reject } = request
  const account = offer?.account || {}
  const year = sinceYear(account.created_at)

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await api.post('/auth/google/link/confirm', { link_token: offer.link_token })
      setRequest(null)
      resolve(r)
    } catch (e) {
      setError(e?.message || 'Hesab bağlanmadı. Yenidən cəhd edin.')
    } finally {
      setBusy(false)
    }
  }

  const decline = async () => {
    setBusy(true)
    let message = 'Hesab bağlanmadı.'
    try {
      const r = await api.post('/auth/google/link/decline', { link_token: offer.link_token })
      if (r?.message) message = r.message
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
      setRequest(null)
      reject(Object.assign(new Error(message), { code: 'ACCOUNT_LINK_DECLINED' }))
    }
  }

  return (
    <Modal open onClose={() => !busy && void decline()} title="Mövcud hesab tapıldı" size="sm" closeLabel="Bağla" zIndex={12000}>
      <div className="space-y-4 text-sm">
        <p className="text-token-textMain">
          Bu Google hesabının email ünvanı ilə Mentorix-də artıq hesab var. Google hesabınızı həmin hesaba bağlasanız,
          köhnə imtahanlarınız, nəticələriniz, qruplarınız, materiallarınız və paketiniz yerində qalacaq.
        </p>
        <div className="rounded-xl border border-[color:var(--border-subtle)] px-3 py-2.5">
          <p className="font-semibold text-token-textMain">{account.full_name || 'Adsız hesab'}</p>
          <p className="text-xs text-token-textMuted">
            {account.email_masked}
            {account.role ? ` · ${ROLE_LABEL[account.role] || account.role}` : ''}
            {year ? ` · ${year}-ci ildən` : ''}
          </p>
        </div>
        <p className="text-xs text-token-textMuted">
          Bu sizin hesabınız deyilsə, bağlamayın. Yeni hesab yaradılmayacaq; kömək üçün dəstəklə əlaqə saxlayın.
        </p>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => void decline()}>
            Bu mənim hesabım deyil
          </Button>
          <Button size="sm" loading={busy} onClick={() => void confirm()}>
            Bəli, hesabımı bağla
          </Button>
        </div>
      </div>
    </Modal>
  )
}
