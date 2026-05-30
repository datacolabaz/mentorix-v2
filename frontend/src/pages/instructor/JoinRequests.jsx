import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { useQueryClient } from '@tanstack/react-query'
import { BILLING_STATUS_QUERY_KEY } from '../../hooks/useBillingStatus'

function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function InstructorJoinRequests() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/instructor/join-requests')
      setRequests(Array.isArray(d?.requests) ? d.requests : [])
    } catch (err) {
      toast(err?.message || 'Sorğular yüklənmədi', 'error')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (requestId) => {
    setActingId(requestId)
    try {
      const r = await api.post(`/instructor/join-requests/${encodeURIComponent(requestId)}/approve`)
      toast(r?.message || 'Təsdiqləndi', 'success')
      await load()
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
      window.dispatchEvent(new CustomEvent('mx:join-requests-changed'))
    } catch (err) {
      toast(err?.message || 'Xəta', 'error')
    } finally {
      setActingId(null)
    }
  }

  const reject = async (requestId) => {
    if (!window.confirm('Bu sorğunu rədd etmək istəyirsiniz?')) return
    setActingId(requestId)
    try {
      const r = await api.post(`/instructor/join-requests/${encodeURIComponent(requestId)}/reject`, {})
      toast(r?.message || 'Rədd edildi', 'info')
      await load()
      window.dispatchEvent(new CustomEvent('mx:join-requests-changed'))
    } catch (err) {
      toast(err?.message || 'Xəta', 'error')
    } finally {
      setActingId(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Qoşulma sorğuları</h1>
      <p className="text-token-textMuted text-sm mt-1 mb-6">
        Tələbələr dəvət linki ilə öz məlumatlarını doldurub sorğu göndərir. Təsdiqlədikdən sonra qrupa əlavə olunurlar.
      </p>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : !requests.length ? (
        <Card className="p-8 text-center text-token-textMuted text-sm border border-[color:var(--border-subtle)]">
          Gözləyən sorğu yoxdur. Qrup dəvət linkini tələbələrə göndərin.
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.request_id}>
              <Card className="p-4 border border-[color:var(--border-subtle)]">
                <p className="text-token-textMain font-semibold">
                  <span className="text-primary">{req.student_name}</span>
                  {req.group_name ? (
                    <>
                      {' '}
                      <span className="text-token-textMuted font-normal">·</span> «{req.group_name}» qrupunuza
                      qoşulmaq istəyir
                    </>
                  ) : (
                    ' qrupunuza qoşulmaq istəyir'
                  )}
                </p>
                {req.subject_name && (
                  <p className="text-xs text-token-textMuted mt-1">Sahə: {req.subject_name}</p>
                )}
                {(req.package_label || req.package_fee) && (
                  <p className="text-xs text-primary/90 mt-1">
                    Qrup paketi: {req.package_label}
                    {req.package_fee ? ` · ${req.package_fee}` : ''}
                  </p>
                )}
                <div className="text-xs text-token-textMuted mt-2 space-y-0.5">
                  {req.phone_number && <div>Telefon: {req.phone_number}</div>}
                  {req.student_email && <div>Email: {req.student_email}</div>}
                  {req.parent_name && (
                    <div>
                      Valideyn: {req.parent_name}
                      {req.parent_phone ? ` · ${req.parent_phone}` : ''}
                    </div>
                  )}
                  <div className="text-[10px] opacity-70">{fmtDate(req.created_at)}</div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    className="flex-1 justify-center"
                    loading={actingId === req.request_id}
                    onClick={() => approve(req.request_id)}
                  >
                    Təsdiqlə
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 justify-center"
                    disabled={actingId === req.request_id}
                    onClick={() => reject(req.request_id)}
                  >
                    Rədd et
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
