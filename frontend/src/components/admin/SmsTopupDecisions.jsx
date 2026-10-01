import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../common/Card'
import Button from '../common/Button'
import { useToast } from '../common/Toast'

const STATUS_LABEL = { pending: 'Gözləyir', expired: 'Vaxtı bitib (köçürmə)' }

/**
 * Retired SMS top-ups: the admin decides each one manually — «Geri qaytar» (refunded + note) or
 * «Kreditə çevir» (account credit applied to the teacher's next plan/storage payment).
 * A reason is required; the server writes the admin audit log before changing anything.
 */
export default function SmsTopupDecisions() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null) // { id, decision }
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/admin/billing/sms-topups')
      setItems(Array.isArray(d?.items) ? d.items : [])
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    if (!open) return
    const r = reason.trim()
    if (r.length < 5) {
      toast('Səbəb yazın (ən azı 5 simvol)', 'error')
      return
    }
    setBusy(true)
    try {
      const path = open.decision === 'refund' ? 'refund' : 'convert-credit'
      await api.post(`/admin/billing/sms-topups/${open.id}/${path}`, { reason: r })
      toast(open.decision === 'refund' ? 'Geri qaytarılmış kimi qeyd edildi' : 'Hesab kreditinə çevrildi')
      setOpen(null)
      setReason('')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5 space-y-4" data-testid="sms-topup-decisions">
      <div>
        <h2 className="text-lg font-display font-bold text-token-textMain">Gözləyən SMS paket ödənişləri</h2>
        <p className="text-sm text-token-textMuted">
          SMS xidməti dayandırılıb. Hər ödəniş üçün əl ilə qərar verin: «Geri qaytar» (pul tətbiqdən kənarda qaytarılır)
          və ya «Kreditə çevir» (məbləğ müəllimin növbəti paket/yaddaş ödənişinə tətbiq olunur). Səbəb məcburidir və
          audit jurnalına yazılır. Avtomatik emal yoxdur.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-token-textMuted">Yüklənir…</p>
      ) : !items.length ? (
        <p className="text-sm text-token-textMuted">Qərar gözləyən SMS ödənişi yoxdur.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border-subtle)] text-left text-xs uppercase text-token-textMuted">
                <th className="py-2 pr-4 font-semibold">Müəllim</th>
                <th className="py-2 pr-4 font-semibold">Paket</th>
                <th className="py-2 pr-4 font-semibold">Məbləğ</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">Tarix</th>
                <th className="py-2 font-semibold">Qərar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-[color:var(--border-subtle)]/60 align-top">
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-token-textMain">{p.full_name || '—'}</div>
                    <div className="text-xs text-token-textMuted">{p.email}</div>
                  </td>
                  <td className="py-3 pr-4 text-token-textMain">{p.sms_quantity ? `${p.sms_quantity} SMS` : 'SMS'}</td>
                  <td className="py-3 pr-4 font-semibold text-token-textMain">
                    {(Number(p.amount_cents || 0) / 100).toFixed(2)} ₼
                  </td>
                  <td className="py-3 pr-4 text-xs text-token-textMuted">
                    {STATUS_LABEL[p.status] || p.status} · {p.payment_method === 'cash' ? 'Köçürmə' : 'Kart'}
                  </td>
                  <td className="py-3 pr-4 text-xs text-token-textMuted">
                    {p.created_at ? new Date(p.created_at).toLocaleString('az-AZ') : '—'}
                  </td>
                  <td className="py-3">
                    {open?.id === p.id ? (
                      <div className="flex min-w-[16rem] flex-col gap-2">
                        <label className="text-xs font-semibold text-token-textMain" htmlFor={`sms-reason-${p.id}`}>
                          {open.decision === 'refund' ? 'Geri qaytarma səbəbi / qeyd' : 'Kreditə çevirmə səbəbi'}
                        </label>
                        <textarea
                          id={`sms-reason-${p.id}`}
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
                            Ləğv et
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setOpen({ id: p.id, decision: 'refund' })}>
                          Geri qaytar
                        </Button>
                        <Button size="sm" onClick={() => setOpen({ id: p.id, decision: 'credit' })}>
                          Kreditə çevir
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
