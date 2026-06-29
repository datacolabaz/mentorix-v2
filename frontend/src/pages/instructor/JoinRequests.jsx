import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { useQueryClient } from '@tanstack/react-query'
import { BILLING_STATUS_QUERY_KEY } from '../../hooks/useBillingStatus'

function fmtDate(iso, locale) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(locale === 'ru' ? 'ru-RU' : 'az-AZ', {
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
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [requests, setRequests] = useState([])
  const [warnings, setWarnings] = useState([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState(null)
  const [examApproveModal, setExamApproveModal] = useState(null)
  const [examApproveSendSms, setExamApproveSendSms] = useState(false)
  const [profileIncompleteModal, setProfileIncompleteModal] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/instructor/join-requests')
      setRequests(Array.isArray(d?.requests) ? d.requests : [])
      setWarnings(Array.isArray(d?.warnings) ? d.warnings : [])
    } catch (err) {
      toast(err?.message || t('joinRequests.loadFailed'), 'error')
      setRequests([])
      setWarnings([])
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (requestId, kind = 'group_join', opts = {}) => {
    setActingId(requestId)
    try {
      const body = { kind }
      if (kind === 'exam_access') body.send_sms = Boolean(opts.sendSms)
      const r = await api.post(`/instructor/join-requests/${encodeURIComponent(requestId)}/approve`, body)
      toast(r?.message || t('joinRequests.approved'), 'success')
      await load()
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
      window.dispatchEvent(new CustomEvent('mx:join-requests-changed'))
      window.dispatchEvent(new CustomEvent('mx:students-changed'))
    } catch (err) {
      if (err?.code === 'STUDENT_PROFILE_INCOMPLETE' || err?.code === 'PROFILE_INCOMPLETE') {
        setProfileIncompleteModal({
          studentName: err?.student_name || t('joinRequests.defaultStudent'),
          message: err?.message || t('joinRequests.profileIncomplete'),
        })
      } else {
        toast(err?.message || t('joinRequests.error'), 'error')
      }
    } finally {
      setActingId(null)
      setExamApproveModal(null)
    }
  }

  const openExamApprove = (req) => {
    if (!req?.profile_complete) {
      setProfileIncompleteModal({
        studentName: req.student_name || t('joinRequests.defaultStudent'),
        message: t('joinRequests.profileIncompleteExam'),
      })
      return
    }
    setExamApproveSendSms(false)
    setExamApproveModal(req)
  }

  const tryApprove = (req) => {
    if (req.kind === 'exam_access' || req.kind === 'task_access') {
      if (!req.profile_complete) {
        setProfileIncompleteModal({
          studentName: req.student_name || t('joinRequests.defaultStudent'),
          message:
            req.kind === 'task_access'
              ? t('joinRequests.profileIncompleteTask')
              : t('joinRequests.profileIncompleteExam'),
        })
        return
      }
      if (req.kind === 'exam_access') {
        openExamApprove(req)
        return
      }
    }
    void approve(req.request_id, req.kind || 'group_join')
  }

  const reject = async (requestId, kind = 'group_join') => {
    if (!window.confirm(t('joinRequests.rejectConfirm'))) return
    setActingId(requestId)
    try {
      const r = await api.post(`/instructor/join-requests/${encodeURIComponent(requestId)}/reject`, {
        kind,
      })
      toast(r?.message || t('joinRequests.rejected'), 'info')
      await load()
      window.dispatchEvent(new CustomEvent('mx:join-requests-changed'))
    } catch (err) {
      toast(err?.message || t('joinRequests.error'), 'error')
    } finally {
      setActingId(null)
    }
  }

  const requestActionText = (req) => {
    if (req.kind === 'exam_access') {
      return t('joinRequests.examAccessSuffix', {
        title: req.exam_title || t('joinRequests.defaultExam'),
      })
    }
    if (req.kind === 'task_access') {
      return t('joinRequests.taskAccessSuffix', {
        title: req.task_title || t('joinRequests.defaultTask'),
      })
    }
    if (req.group_name) {
      return t('joinRequests.groupJoinSuffix', { name: req.group_name })
    }
    return t('joinRequests.groupJoinFallback')
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">{t('joinRequests.title')}</h1>
      <p className="text-token-textMuted text-sm mt-1 mb-6">{t('joinRequests.subtitle')}</p>

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
          <p>{t('joinRequests.empty')}</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((req) => (
            <li key={req.request_id}>
              <Card className="p-4 border border-[color:var(--border-subtle)]">
                <p className="text-token-textMain font-semibold">
                  <span className="text-primary">{req.student_name}</span> {requestActionText(req)}
                </p>
                {req.kind === 'exam_access' && (
                  <p className="text-[10px] uppercase tracking-wide text-amber-400/90 mt-1">{t('joinRequests.badgeExam')}</p>
                )}
                {req.kind === 'task_access' && (
                  <p className="text-[10px] uppercase tracking-wide text-violet-400/90 mt-1">{t('joinRequests.badgeTask')}</p>
                )}
                {req.subject_name && (
                  <p className="text-xs text-token-textMuted mt-1">
                    {t('joinRequests.subject')} {req.subject_name}
                  </p>
                )}
                {(req.package_label || req.package_fee) && (
                  <p className="text-xs text-primary/90 mt-1">
                    {t('joinRequests.groupPackage')} {req.package_label}
                    {req.package_fee ? ` · ${req.package_fee}` : ''}
                  </p>
                )}
                <div className="text-xs text-token-textMuted mt-2 space-y-0.5">
                  {(req.phone_number || req.phone) && (
                    <div>
                      {t('joinRequests.phone')} {req.phone_number || req.phone}
                    </div>
                  )}
                  {req.profile_complete === false && (
                    <div className="text-amber-200/90 font-medium">{t('joinRequests.phonePending')}</div>
                  )}
                  {req.student_email && (
                    <div>
                      {t('joinRequests.email')} {req.student_email}
                    </div>
                  )}
                  {req.parent_name && (
                    <div>
                      {t('joinRequests.parent')} {req.parent_name}
                      {req.parent_phone ? ` · ${req.parent_phone}` : ''}
                    </div>
                  )}
                  {(req.referral_source_name || req.referral_notes) && (
                    <div>
                      {t('joinRequests.referral')}{' '}
                      {[req.referral_source_name, req.referral_notes].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="text-[10px] opacity-70">{fmtDate(req.created_at, i18n.language)}</div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    className="flex-1 justify-center"
                    loading={actingId === req.request_id}
                    onClick={() => tryApprove(req)}
                  >
                    {t('joinRequests.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 justify-center"
                    disabled={actingId === req.request_id}
                    onClick={() => reject(req.request_id, req.kind || 'group_join')}
                  >
                    {t('joinRequests.reject')}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(profileIncompleteModal)}
        onClose={() => setProfileIncompleteModal(null)}
        title={t('joinRequests.profileModalTitle')}
        size="sm"
        zIndex={10200}
        footer={
          <div className="flex justify-center">
            <Button type="button" className="min-w-[120px] justify-center" onClick={() => setProfileIncompleteModal(null)}>
              {t('joinRequests.ok')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-center text-zinc-300 leading-relaxed">
          <strong className="text-white">{profileIncompleteModal?.studentName}</strong>
        </p>
        <p className="text-sm text-center text-amber-200/95 mt-3 leading-relaxed">
          {profileIncompleteModal?.message}
        </p>
      </Modal>

      <Modal
        open={!!examApproveModal}
        onClose={() => setExamApproveModal(null)}
        title={t('joinRequests.examApproveTitle')}
        size="sm"
      >
        {examApproveModal && (
          <div className="space-y-4 text-sm text-gray-300">
            <p>
              <strong className="text-white">{examApproveModal.student_name}</strong>
              {examApproveModal.exam_title ? ` — «${examApproveModal.exam_title}»` : ''}
            </p>
            <p className="text-xs text-emerald-200/90">{t('joinRequests.examApproveEmailHint')}</p>
            <label className="flex items-start gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-blue-500 shrink-0"
                checked={examApproveSendSms}
                onChange={(e) => setExamApproveSendSms(e.target.checked)}
              />
              <span>
                <span className="font-semibold text-white block">{t('joinRequests.examApproveSmsLabel')}</span>
                <span className="text-xs text-gray-400">{t('joinRequests.examApproveSmsHint')}</span>
              </span>
            </label>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
              <Button variant="secondary" onClick={() => setExamApproveModal(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                loading={actingId === examApproveModal.request_id}
                onClick={() =>
                  approve(examApproveModal.request_id, 'exam_access', { sendSms: examApproveSendSms })
                }
              >
                {t('joinRequests.approve')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
