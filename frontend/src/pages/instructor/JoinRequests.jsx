import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
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
  const [examApproveModal, setExamApproveModal] = useState(null)
  const [examApproveSendSms, setExamApproveSendSms] = useState(false)

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

  const approve = async (requestId, kind = 'group_join', opts = {}) => {
    setActingId(requestId)
    try {
      const body = { kind }
      if (kind === 'exam_access') body.send_sms = Boolean(opts.sendSms)
      const r = await api.post(`/instructor/join-requests/${encodeURIComponent(requestId)}/approve`, body)
      toast(r?.message || 'Təsdiqləndi', 'success')
      await load()
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
      window.dispatchEvent(new CustomEvent('mx:join-requests-changed'))
      window.dispatchEvent(new CustomEvent('mx:students-changed'))
    } catch (err) {
      toast(err?.message || 'Xəta', 'error')
    } finally {
      setActingId(null)
      setExamApproveModal(null)
    }
  }

  const openExamApprove = (req) => {
    setExamApproveSendSms(false)
    setExamApproveModal(req)
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
        Tələbənin imtahan, tapşırıq və ya qrup qoşulma sorğuları.
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
        <Card className="p-8 text-center text-token-textMuted text-sm border border-[color:var(--border-subtle)]">
          <p>Gözləyən sorğu yoxdur.</p>
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
                  ) : req.kind === 'task_access' ? (
                    <>
                      {' '}
                      <span className="text-token-textMuted font-normal">·</span> «{req.task_title || 'Tapşırıq'}»
                      tapşırığına giriş istəyir
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
                {req.kind === 'task_access' && (
                  <p className="text-[10px] uppercase tracking-wide text-violet-400/90 mt-1">Tapşırıq sorğusu</p>
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
                    onClick={() =>
                      req.kind === 'exam_access'
                        ? openExamApprove(req)
                        : approve(req.request_id, req.kind || 'group_join')
                    }
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

      <Modal
        open={!!examApproveModal}
        onClose={() => setExamApproveModal(null)}
        title="İmtahan sorğusunu təsdiqlə"
        size="sm"
      >
        {examApproveModal && (
          <div className="space-y-4 text-sm text-gray-300">
            <p>
              <strong className="text-white">{examApproveModal.student_name}</strong>
              {examApproveModal.exam_title
                ? ` — «${examApproveModal.exam_title}»`
                : ''}
            </p>
            <p className="text-xs text-emerald-200/90">
              Təsdiqdən sonra tələbəyə <strong>Gmail-ə</strong> «Müraciətiniz təsdiqləndi» mesajı gedəcək (tətbiqdə
              olmasa da görəcək). Paneldə də bildiriş olacaq.
            </p>
            <label className="flex items-start gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
                checked={examApproveSendSms}
                onChange={(e) => setExamApproveSendSms(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-white block">SMS / WhatsApp da göndər</span>
                <span className="text-xs text-gray-400">
                  Yalnız tələbənin profilində telefon varsa. Gmail qeydiyyatlı tələbələrə əvvəlcə email kifayətdir.
                </span>
              </span>
            </label>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
              <Button variant="secondary" onClick={() => setExamApproveModal(null)}>
                Ləğv et
              </Button>
              <Button
                loading={actingId === examApproveModal.request_id}
                onClick={() =>
                  approve(examApproveModal.request_id, 'exam_access', { sendSms: examApproveSendSms })
                }
              >
                Təsdiqlə
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
