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
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/instructor/join-requests')
      setRequests(Array.isArray(d?.requests) ? d.requests : [])
      setWarnings(Array.isArray(d?.warnings) ? d.warnings : [])
    } catch (err) {
      toast(err?.message || 'Sorğular yüklənmədi', 'error')
      setRequests([])
      setWarnings([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (requestId, kind = 'group_join') => {
    setActingId(requestId)
    try {
      const r = await api.post(`/instructor/join-requests/${encodeURIComponent(requestId)}/approve`, {
        kind,
      })
      toast(r?.message || 'Təsdiqləndi', 'success')
      await load()
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
      window.dispatchEvent(new CustomEvent('mx:join-requests-changed'))
      window.dispatchEvent(new CustomEvent('mx:students-changed'))
    } catch (err) {
      toast(err?.message || 'Xəta', 'error')
    } finally {
      setActingId(null)
    }
  }

  const reject = async (requestId, kind = 'group_join') => {
    if (!window.confirm('Bu sorğunu rədd etmək istəyirsiniz?')) return
    setActingId(requestId)
    try {
      const r = await api.post(`/instructor/join-requests/${encodeURIComponent(requestId)}/reject`, {
        kind,
      })
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
      <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Sorğular</h1>
      <p className="text-token-textMuted text-sm mt-1 mb-6">
        İmtahan linki (<code className="text-xs opacity-80">/exam/…</code>): tələbə klik edəndə sorğu{' '}
        <strong className="text-token-textMain font-medium">avtomatik</strong> buraya düşür. Qrup:{' '}
        <code className="text-xs opacity-80">/join/KOD</code> + forma.
      </p>

      {warnings.length > 0 && (
        <Card className="p-4 mb-4 border border-amber-500/40 bg-amber-500/10 text-amber-100 text-sm">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </Card>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : !requests.length ? (
        <Card className="p-8 text-center text-token-textMuted text-sm border border-[color:var(--border-subtle)] space-y-2">
          <p>Gözləyən sorğu yoxdur.</p>
          <p className="text-xs">
            İmtahan üçün İmtahanlar səhifəsindən <strong className="text-token-textMain">linki kopyalayın</strong> və
            tələbəyə göndərin. Tələbə linkə klik edib Google ilə daxil olanda sorğu avtomatik gələcək — email axtarmaq
            lazım deyil.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.request_id}>
              <Card className="p-4 border border-[color:var(--border-subtle)]">
                <p className="text-token-textMain font-semibold">
                  <span className="text-primary">{req.student_name}</span>
                  {req.kind === 'exam_access' ? (
                    <>
                      {' '}
                      <span className="text-token-textMuted font-normal">·</span> «{req.exam_title || 'İmtahan'}»
                      imtahanına giriş istəyir
                    </>
                  ) : req.group_name ? (
                    <>
                      {' '}
                      <span className="text-token-textMuted font-normal">·</span> «{req.group_name}» qrupunuza
                      qoşulmaq istəyir
                    </>
                  ) : (
                    ' qrupunuza qoşulmaq istəyir'
                  )}
                </p>
                {req.kind === 'exam_access' && (
                  <p className="text-[10px] uppercase tracking-wide text-amber-400/90 mt-1">İmtahan sorğusu</p>
                )}
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
                  {(req.phone_number || req.phone) && (
                    <div>Telefon: {req.phone_number || req.phone}</div>
                  )}
                  {req.student_email && <div>Email: {req.student_email}</div>}
                  {req.parent_name && (
                    <div>
                      Valideyn: {req.parent_name}
                      {req.parent_phone ? ` · ${req.parent_phone}` : ''}
                    </div>
                  )}
                  {(req.referral_source_name || req.referral_notes) && (
                    <div>
                      Yönləndirmə:{' '}
                      {[req.referral_source_name, req.referral_notes].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="text-[10px] opacity-70">{fmtDate(req.created_at)}</div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    className="flex-1 justify-center"
                    loading={actingId === req.request_id}
                    onClick={() => approve(req.request_id, req.kind || 'group_join')}
                  >
                    Təsdiqlə
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 justify-center"
                    disabled={actingId === req.request_id}
                    onClick={() => reject(req.request_id, req.kind || 'group_join')}
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
