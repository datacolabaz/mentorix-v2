import { useCallback, useState } from 'react'
import api from '../../lib/api'
import Card from '../common/Card'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { formatNamedDate } from '../../lib/azMonths'

const STATUS_LABEL = { issued: 'Aktiv', superseded: 'Yenilənib', revoked: 'Ləğv edilib' }

/**
 * Admin: find a certificate and revoke it (reason required) or reinstate a revoked one.
 * The server writes the admin audit log first; the public verify page then shows "revoked" + date
 * (never the reason) and the student gets the status-change notification.
 */
export default function CertificateRevocations() {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(null) // { id, action }
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const search = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get(`/admin/certificates?q=${encodeURIComponent(q.trim())}`)
      setItems(Array.isArray(d?.items) ? d.items : [])
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [q, toast])

  async function submit() {
    if (!open) return
    const r = reason.trim()
    if (r.length < 5) {
      toast('Səbəb yazın (ən azı 5 simvol)', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post(`/admin/certificates/${open.id}/${open.action}`, { reason: r })
      toast(open.action === 'revoke' ? 'Sertifikat ləğv edildi' : 'Sertifikat yenidən aktivdir')
      setOpen(null)
      setReason('')
      await search()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 space-y-4" data-testid="certificate-revocations">
      <div>
        <h2 className="text-lg font-display font-bold text-token-textMain">Sertifikatı ləğv et</h2>
        <p className="text-sm text-token-textMuted">
          Seriya nömrəsi, tələbə adı/emaili və ya imtahan adı ilə axtarın. Ləğv üçün səbəb məcburidir və audit jurnalına
          yazılır; doğrulama səhifəsində yalnız «ləğv edilib» və tarix görünür. Tələbəyə bildiriş göndərilir.
        </p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <label htmlFor="cert-admin-search" className="sr-only">
          Sertifikat axtar
        </label>
        <input
          id="cert-admin-search"
          className="min-w-[14rem] flex-1 rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm text-token-textMain"
          placeholder="MX-2026-… / tələbə / imtahan"
          value={q}
          maxLength={120}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" size="sm" loading={loading}>
          Axtar
        </Button>
      </form>
      {items && !items.length ? <p className="text-sm text-token-textMuted">Sertifikat tapılmadı.</p> : null}
      {items && items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border-subtle)] text-left text-xs uppercase text-token-textMuted">
                <th className="py-2 pr-4 font-semibold">Seriya</th>
                <th className="py-2 pr-4 font-semibold">Tələbə</th>
                <th className="py-2 pr-4 font-semibold">İmtahan</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 font-semibold">Əməliyyat</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const action = c.status === 'issued' ? 'revoke' : c.status === 'revoked' ? 'reinstate' : null
                return (
                  <tr key={c.id} className="border-b border-[color:var(--border-subtle)]/60 align-top">
                    <td className="py-3 pr-4 font-mono text-xs text-token-textMain">{c.certificate_no}</td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-token-textMain">{c.student_name || '—'}</div>
                      <div className="text-xs text-token-textMuted">{c.student_email}</div>
                    </td>
                    <td className="py-3 pr-4 text-token-textMain">{c.title}</td>
                    <td className="py-3 pr-4 text-xs text-token-textMuted">
                      {STATUS_LABEL[c.status] || c.status}
                      {c.revoked_at ? ` · ${formatNamedDate(c.revoked_at, 'az', { month: 'short', padDay: true })}` : ''}
                    </td>
                    <td className="py-3">
                      {!action ? (
                        <span className="text-xs text-token-textMuted">—</span>
                      ) : open?.id === c.id ? (
                        <div className="flex min-w-[16rem] flex-col gap-2">
                          <label className="text-xs font-semibold text-token-textMain" htmlFor={`cert-reason-${c.id}`}>
                            {open.action === 'revoke' ? 'Ləğv səbəbi (daxili)' : 'Bərpa səbəbi'}
                          </label>
                          <textarea
                            id={`cert-reason-${c.id}`}
                            className="w-full rounded-lg border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm text-token-textMain"
                            rows={2}
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" loading={busy} onClick={() => void submit()}>
                              Təsdiqlə
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                setOpen(null)
                                setReason('')
                              }}
                            >
                              İmtina
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant={action === 'revoke' ? 'secondary' : 'primary'}
                          onClick={() => {
                            setReason('')
                            setOpen({ id: c.id, action })
                          }}
                        >
                          {action === 'revoke' ? 'Ləğv et' : 'Bərpa et'}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  )
}
