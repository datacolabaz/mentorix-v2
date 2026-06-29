import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import { useToast } from '../../components/common/Toast'
import { groupInvitationLink } from '../../lib/joinInvite'
import useUiStore from '../../hooks/useUi'
import { QRCodeCanvas } from 'qrcode.react'
import GroupPackageFields, {
  emptyGroupPackage,
  groupPackageFromApi,
  groupPackagePayload,
} from '../../components/instructor/GroupPackageFields'
import { formatAzn } from '../../lib/pricing'
import { normalizeTeachingSubjects } from '../../lib/teachingSubjects'
import { useBillingStatus } from '../../hooks/useBillingStatus'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { basicTrialExpiredMessage } from '../../lib/subscriptionPlanGuards'

function formatIncomeAzn(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '0 ₼'
  return `${formatAzn(v)} ₼`
}

export default function InstructorTeachingGroups() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const blocked = Boolean(billing?.should_block)
  const blockMessage = billing?.messages?.banner || basicTrialExpiredMessage(plans)
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [newSubject, setNewSubject] = useState('')
  const [newGroupBySubject, setNewGroupBySubject] = useState({})
  const [groupModal, setGroupModal] = useState(null)
  const [groupModalError, setGroupModalError] = useState('')
  const [groupPkg, setGroupPkg] = useState(emptyGroupPackage)
  const [busy, setBusy] = useState({})
  const [qrOpen, setQrOpen] = useState(false)
  const [qrGroup, setQrGroup] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [liveNotifyModal, setLiveNotifyModal] = useState(null)
  const [liveNotifySms, setLiveNotifySms] = useState(false)
  const [liveNotifyEmail, setLiveNotifyEmail] = useState(false)

  const safeSubjects = useMemo(
    () => normalizeTeachingSubjects(subjects).filter((s) => s && !s.is_system),
    [subjects],
  )

  const load = useCallback(async (opts = {}) => {
    const silent = Boolean(opts.silent)
    if (silent) setRefreshing(true)
    else setInitialLoading(true)
    try {
      const d = await api.get('/instructor/teaching')
      setSubjects(Array.isArray(d.subjects) ? d.subjects : [])
    } catch (e) {
      toast(e?.message || t('teachingGroups.toasts.loadFailed'), 'error')
    } finally {
      if (silent) setRefreshing(false)
      else setInitialLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    void load()
  }, [load])

  const requestRemoveSubject = (subject) => {
    if (subject?.is_system) {
      toast(t('teachingGroups.toasts.systemSubjectNoDelete'), 'info')
      return
    }
    setConfirmDelete({ type: 'subject', id: subject?.id, name: subject?.name || t('teachingGroups.defaultSubject') })
  }

  const requestRemoveGroup = (group) => {
    if (group?.is_system) {
      toast(t('teachingGroups.toasts.systemGroupNoDelete'), 'info')
      return
    }
    setConfirmDelete({ type: 'group', id: group?.id, name: group?.name || t('teachingGroups.defaultGroup') })
  }

  const addSubject = async () => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    const name = newSubject.trim()
    if (!name) {
      toast(t('teachingGroups.toasts.subjectNameRequired'), 'error')
      return
    }
    setBusy((b) => ({ ...b, addSub: true }))
    try {
      const d = await api.post('/instructor/teaching/subjects', { name })
      const created = d?.subject
      if (created?.id) {
        setSubjects((prev) => [
          ...(Array.isArray(prev) ? prev : []),
          {
            ...created,
            groups: Array.isArray(created.groups) ? created.groups : [],
            student_count: Number(created.student_count) || 0,
            income_this_month: Number(created.income_this_month) || 0,
          },
        ])
      }
      setNewSubject('')
      toast(t('teachingGroups.toasts.subjectAdded'))
      await load({ silent: true })
    } catch (e) {
      toast(e?.message || t('teachingGroups.toasts.error'), 'error')
    } finally {
      setBusy((b) => ({ ...b, addSub: false }))
    }
  }

  const removeSubject = async (id) => {
    setBusy((b) => ({ ...b, [`dels-${id}`]: true }))
    try {
      await api.delete('/instructor/teaching/subjects/' + encodeURIComponent(id))
      toast(t('teachingGroups.toasts.deleted'))
      await load({ silent: true })
    } catch (e) {
      toast(e?.message || t('teachingGroups.toasts.error'), 'error')
    } finally {
      setBusy((b) => ({ ...b, [`dels-${id}`]: false }))
    }
  }

  const openCreateGroup = (subjectId) => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    const raw = newGroupBySubject[subjectId] || ''
    const name = String(raw).trim()
    if (!name) {
      toast(t('teachingGroups.toasts.groupNameRequired'), 'error')
      return
    }
    setGroupPkg(emptyGroupPackage())
    setGroupModalError('')
    setGroupModal({ mode: 'create', subjectId, name })
  }

  const openEditGroupPackage = (subjectId, group) => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    if (group?.is_system) {
      toast(t('teachingGroups.toasts.systemGroupNoEdit'), 'info')
      return
    }
    setGroupPkg(groupPackageFromApi(group))
    setGroupModalError('')
    setGroupModal({ mode: 'edit', subjectId, group })
  }

  const saveGroupModal = async () => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    if (!groupModal) return
    const lwd = groupPkg.default_lesson_weekdays || []
    if (!lwd.length) {
      const msg = t('teachingGroups.toasts.weekdayRequired')
      setGroupModalError(msg)
      toast(msg, 'error')
      return
    }
    const fee = String(groupPkg.default_package_fee || '').trim()
    if (!fee) {
      const msg = t('teachingGroups.toasts.feeRequired')
      setGroupModalError(msg)
      toast(msg, 'error')
      return
    }
    setGroupModalError('')
    setBusy((b) => ({ ...b, groupModal: true }))
    try {
      const body = groupPackagePayload(groupPkg, groupModal.mode === 'create' ? groupModal.name : groupModal.group?.name)
      if (groupModal.mode === 'create') {
        await api.post('/instructor/teaching/groups', { subject_id: groupModal.subjectId, ...body })
        setNewGroupBySubject((p) => ({ ...p, [groupModal.subjectId]: '' }))
        toast(t('teachingGroups.toasts.groupCreated'))
      } else if (groupModal.group?.id) {
        await api.patch(`/instructor/teaching/groups/${encodeURIComponent(groupModal.group.id)}`, body)
        toast(t('teachingGroups.toasts.groupUpdated'))
      }
      setGroupModal(null)
      await load({ silent: true })
    } catch (e) {
      const msg = e?.message || t('teachingGroups.toasts.error')
      setGroupModalError(msg)
      toast(msg, 'error')
    } finally {
      setBusy((b) => ({ ...b, groupModal: false }))
    }
  }

  const removeGroup = async (groupId) => {
    setBusy((b) => ({ ...b, [`delg-${groupId}`]: true }))
    try {
      await api.delete('/instructor/teaching/groups/' + encodeURIComponent(groupId))
      toast(t('teachingGroups.toasts.deleted'))
      await load({ silent: true })
    } catch (e) {
      toast(e?.message || t('teachingGroups.toasts.error'), 'error')
    } finally {
      setBusy((b) => ({ ...b, [`delg-${groupId}`]: false }))
    }
  }

  const requestStartLiveClass = (group, subjectName) => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    if (!group?.id) return
    setLiveNotifySms(false)
    setLiveNotifyEmail(false)
    setLiveNotifyModal({ group, subjectName })
  }

  const startLiveClass = async ({ group, subjectName, notifySms, notifyEmail }) => {
    if (!group?.id) return
    setBusy((b) => ({ ...b, [`live-${group.id}`]: true }))
    try {
      const res = await api.post('/live/create', {
        groupId: group.id,
        title: `${subjectName ? `${subjectName} · ` : ''}${group.name}`,
        notifySms: Boolean(notifySms),
        notifyEmail: Boolean(notifyEmail),
      })
      const code = res?.room?.room_code
      if (!code) throw new Error(t('teachingGroups.toasts.roomCreateFailed'))
      const n = res?.notifications || {}
      const smsN = Number(n.sms) || 0
      const emailN = Number(n.email) || 0
      if (notifySms && notifyEmail) {
        toast(t('teachingGroups.toasts.liveStartedBoth', { sms: smsN, email: emailN }), 'success')
      } else if (notifySms) {
        toast(t('teachingGroups.toasts.liveStartedSms', { sms: smsN }), 'success')
      } else if (notifyEmail) {
        toast(t('teachingGroups.toasts.liveStartedEmail', { email: emailN }), 'success')
      } else {
        toast(t('teachingGroups.toasts.liveStarted'), 'success')
      }
      setLiveNotifyModal(null)
      navigate(`/live/${encodeURIComponent(code)}`)
    } catch (e) {
      toast(e?.message || t('teachingGroups.toasts.liveStartFailed'), 'error')
    } finally {
      setBusy((b) => ({ ...b, [`live-${group.id}`]: false }))
    }
  }

  const cardTitleCls = [
    'text-sm font-semibold uppercase tracking-wider',
    theme === 'dark' ? 'text-indigo-200/90' : 'text-token-textMain',
  ].join(' ')

  const cardTextCls = ['text-xs leading-relaxed', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')

  const inp = [
    'w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 border',
    theme === 'dark'
      ? 'bg-[#13112e] border-indigo-500/20 text-white placeholder:text-gray-500'
      : 'bg-token-surfaceMain border-[color:var(--border-subtle)] text-token-textMain placeholder:text-token-textMuted',
  ].join(' ')

  const secondaryBtnCls = [
    'whitespace-nowrap',
    theme === 'dark'
      ? 'border-white/15 text-white hover:bg-white/[0.06] hover:border-white/25'
      : '!border-slate-200 !text-slate-800 hover:!text-slate-900 hover:!border-slate-300 hover:bg-slate-500/10',
  ].join(' ')

  const groupActionBtnCls = [
    'text-xs px-2.5 py-2 rounded-lg border min-h-[40px] inline-flex items-center justify-center',
    theme === 'dark'
      ? 'border-white/10 text-gray-200 hover:bg-white/[0.06]'
      : 'border-slate-200 text-token-textMain hover:bg-slate-50',
  ].join(' ')

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">
          {t('teachingGroups.title')}
        </h1>
        <p className="text-token-textMuted text-sm mt-1 max-w-2xl">{t('teachingGroups.subtitle')}</p>
      </div>

      <Card className="w-full p-5 border border-indigo-500/20 space-y-4">
        <h2 className={cardTitleCls}>{t('teachingGroups.sectionTitle')}</h2>
        <p className={cardTextCls}>{t('teachingGroups.sectionDesc')}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            className={inp}
            placeholder={t('teachingGroups.subjectPh')}
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void addSubject()
              }
            }}
            disabled={busy.addSub || blocked}
          />
          <Button
            type="button"
            variant="secondary"
            loading={busy.addSub}
            disabled={blocked}
            onClick={() => void addSubject()}
            className={['w-full sm:w-auto justify-center', secondaryBtnCls].join(' ')}
          >
            {t('teachingGroups.addSubject')}
          </Button>
        </div>
        {refreshing ? (
          <p className={['text-xs', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
            {t('teachingGroups.refreshing')}
          </p>
        ) : null}
        {initialLoading ? (
          <p className={['text-sm', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
            {t('teachingGroups.loading')}
          </p>
        ) : (
          <ul className="space-y-4">
              {!safeSubjects.length ? (
                <li className={['text-sm', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                  {t('teachingGroups.emptySubjects')}
                </li>
              ) : null}
              {safeSubjects.map((s) => (
                <li
                  key={s.id}
                  className={[
                    'rounded-xl border p-4 space-y-3',
                    theme === 'dark'
                      ? 'border-indigo-500/15 bg-[#0f0c29]/60'
                      : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/60',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className={['font-medium text-base', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                        {s.name}
                      </div>
                      <div
                        className={[
                          'mt-1.5 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1 text-xs tabular-nums',
                          theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted',
                        ].join(' ')}
                      >
                        <span className="font-medium text-token-textMain">
                          {t('teachingGroups.studentCount', { count: Number(s.student_count) || 0 })}
                        </span>
                        <span>
                          {t('teachingGroups.incomeThisMonth')}{' '}
                          <span className="font-medium text-emerald-400/95">
                            {formatIncomeAzn(s.income_this_month)}
                          </span>
                        </span>
                        <span>{t('teachingGroups.groupCount', { count: (s.groups || []).length })}</span>
                      </div>
                    </div>
                    {!s.is_system ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        loading={busy[`dels-${s.id}`]}
                        onClick={() => requestRemoveSubject(s)}
                      >
                        {t('teachingGroups.delete')}
                      </Button>
                    ) : null}
                  </div>
                  <div
                    className={[
                      'space-y-3 sm:pl-3 sm:border-l',
                      theme === 'dark' ? 'sm:border-indigo-500/20' : 'sm:border-[color:var(--border-subtle)]',
                    ].join(' ')}
                  >
                    {(s.groups || []).length === 0 ? (
                      <p className={['text-xs', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                        {t('teachingGroups.noGroups')}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {(s?.groups || []).filter(Boolean).map((g) => (
                          <li
                            key={g.id}
                            className={[
                              'rounded-xl border p-3 space-y-2.5 text-sm',
                              theme === 'dark'
                                ? 'border-white/10 bg-white/[0.02] text-gray-300'
                                : 'border-slate-200 bg-white text-token-textMain',
                            ].join(' ')}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap font-medium">
                                  <span className="break-words">{g.name}</span>
                                  {g?.is_system ? (
                                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-indigo-400/30 text-indigo-200/90 shrink-0">
                                      {t('teachingGroups.system')}
                                    </span>
                                  ) : null}
                                </div>
                                {g?.is_system ? (
                                  <div className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                    {t('teachingGroups.systemGroupHint')}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {!g?.is_system && g.join_code ? (
                              <div
                                className={[
                                  'text-xs rounded-lg px-2.5 py-2 space-y-1',
                                  theme === 'dark' ? 'bg-white/[0.03] text-gray-400' : 'bg-slate-50 text-token-textMuted',
                                ].join(' ')}
                              >
                                <p>
                                  {g.invite_ready ? (
                                    <span className="text-emerald-500 font-medium">{t('teachingGroups.packageReady')}</span>
                                  ) : (
                                    <span className="text-amber-600 dark:text-amber-400/90 font-medium">
                                      {t('teachingGroups.packageMissing')}
                                    </span>
                                  )}
                                  <span className="mx-1.5">·</span>
                                  {g.default_billing_type === '12_lessons'
                                    ? t('teachingGroups.pack12')
                                    : t('teachingGroups.pack8')}
                                  {g.default_package_fee != null ? ` · ${g.default_package_fee} ₼` : ''}
                                </p>
                                <p>
                                  {t('teachingGroups.codeLabel')}{' '}
                                  <span className="font-mono font-semibold text-token-textMain">{g.join_code}</span>
                                </p>
                              </div>
                            ) : null}
                            {!g?.is_system ? (
                              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                                <button
                                  type="button"
                                  className={[groupActionBtnCls, 'text-emerald-400'].join(' ')}
                                  onClick={() =>
                                    navigate(`/instructor/chat?groupId=${encodeURIComponent(g.id)}`)
                                  }
                                >
                                  {t('teachingGroups.chat')}
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(busy[`live-${g.id}`])}
                                  className={[
                                    groupActionBtnCls,
                                    'col-span-2 sm:col-span-1 font-semibold text-red-400',
                                    busy[`live-${g.id}`] ? 'opacity-60' : '',
                                  ].join(' ')}
                                  onClick={() => requestStartLiveClass(g, s.name)}
                                >
                                  {busy[`live-${g.id}`] ? t('teachingGroups.liveStarting') : t('teachingGroups.liveClass')}
                                </button>
                                <button
                                  type="button"
                                  className={[groupActionBtnCls, theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'].join(' ')}
                                  onClick={() => openEditGroupPackage(s.id, g)}
                                >
                                  {t('teachingGroups.package')}
                                </button>
                                {g.join_code ? (
                                  <>
                                    <button
                                      type="button"
                                      className={[groupActionBtnCls, 'text-primary'].join(' ')}
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(String(g.join_code))
                                          toast(t('teachingGroups.toasts.codeCopied'), 'success')
                                        } catch {
                                          toast(t('teachingGroups.toasts.copyFailed'), 'error')
                                        }
                                      }}
                                    >
                                      {t('teachingGroups.code')}
                                    </button>
                                    <button
                                      type="button"
                                      className={[
                                        groupActionBtnCls,
                                        'col-span-2 sm:col-span-1 font-semibold',
                                        theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700',
                                      ].join(' ')}
                                      onClick={async () => {
                                        const link = groupInvitationLink(g)
                                        try {
                                          await navigator.clipboard.writeText(link)
                                          toast(t('teachingGroups.toasts.groupLinkCopied'), 'success')
                                        } catch {
                                          toast(t('teachingGroups.toasts.copyFailed'), 'error')
                                        }
                                      }}
                                    >
                                      {t('teachingGroups.copyLink')}
                                    </button>
                                    <button
                                      type="button"
                                      className={[groupActionBtnCls, 'text-primary'].join(' ')}
                                      onClick={async () => {
                                        const link = groupInvitationLink(g)
                                        try {
                                          if (navigator.share) {
                                            await navigator.share({
                                              title: t('teachingGroups.shareTitle'),
                                              text: t('teachingGroups.shareText'),
                                              url: link,
                                            })
                                            return
                                          }
                                        } catch {
                                          /* ignore */
                                        }
                                        try {
                                          await navigator.clipboard.writeText(link)
                                          toast(t('teachingGroups.toasts.linkCopied'), 'success')
                                        } catch {
                                          toast(t('teachingGroups.toasts.linkCopyFailed'), 'error')
                                        }
                                      }}
                                    >
                                      {t('teachingGroups.share')}
                                    </button>
                                    <button
                                      type="button"
                                      className={[groupActionBtnCls, 'text-primary'].join(' ')}
                                      onClick={() => {
                                        setQrGroup({ ...g, subjectName: s.name })
                                        setQrOpen(true)
                                      }}
                                    >
                                      {t('teachingGroups.qr')}
                                    </button>
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  className={[
                                    groupActionBtnCls,
                                    'disabled:opacity-40',
                                    theme === 'dark' ? 'text-rose-300' : 'text-rose-700',
                                  ].join(' ')}
                                  disabled={busy[`delg-${g.id}`]}
                                  onClick={() => requestRemoveGroup(g)}
                                >
                                  {t('teachingGroups.delete')}
                                </button>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                                <button
                                  type="button"
                                  className={[groupActionBtnCls, 'text-emerald-400'].join(' ')}
                                  onClick={() =>
                                    navigate(`/instructor/chat?groupId=${encodeURIComponent(g.id)}`)
                                  }
                                >
                                  {t('teachingGroups.chat')}
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {!s.is_system ? (
                    <div className="flex flex-col gap-2 pt-1">
                      <input
                        className={inp + ' text-sm'}
                        placeholder={t('teachingGroups.newGroupPh')}
                        value={newGroupBySubject[s.id] || ''}
                        onChange={(e) =>
                          setNewGroupBySubject((p) => ({
                            ...p,
                            [s.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={blocked}
                        onClick={() => openCreateGroup(s.id)}
                        className={[secondaryBtnCls, 'w-full sm:w-auto justify-center'].join(' ')}
                      >
                        {t('teachingGroups.groupPlusPackage')}
                      </Button>
                    </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
        )}
      </Card>

      <Modal
        open={Boolean(liveNotifyModal)}
        onClose={() => setLiveNotifyModal(null)}
        title={t('teachingGroups.liveModal.title')}
        size="sm"
        zIndex={10055}
        footer={
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[120px] justify-center"
              onClick={() => setLiveNotifyModal(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className="min-w-[140px] justify-center"
              loading={liveNotifyModal?.group?.id ? Boolean(busy[`live-${liveNotifyModal.group.id}`]) : false}
              onClick={() => {
                const m = liveNotifyModal
                if (!m?.group) return
                void startLiveClass({
                  group: m.group,
                  subjectName: m.subjectName,
                  notifySms: liveNotifySms,
                  notifyEmail: liveNotifyEmail,
                })
              }}
            >
              {t('teachingGroups.liveModal.startLesson')}
            </Button>
          </div>
        }
      >
        {liveNotifyModal ? (
          <div className="space-y-4">
            <p className="text-sm text-token-textMuted leading-relaxed">
              {t('teachingGroups.liveModal.notifyPrompt', {
                name: `${liveNotifyModal.subjectName ? `${liveNotifyModal.subjectName} · ` : ''}${liveNotifyModal.group?.name}`,
              })}
            </p>
            <p className="text-xs text-token-textMuted">{t('teachingGroups.liveModal.noNotifyHint')}</p>
            <div className="space-y-3 rounded-xl border border-[color:var(--border-subtle)] p-4">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={liveNotifySms}
                  onChange={(e) => setLiveNotifySms(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-token-textMain">
                    {t('teachingGroups.liveModal.smsLabel')}
                  </span>
                  <span className="block text-xs text-token-textMuted mt-0.5">
                    {t('teachingGroups.liveModal.smsHint')}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-primary"
                  checked={liveNotifyEmail}
                  onChange={(e) => setLiveNotifyEmail(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-token-textMain">
                    {t('teachingGroups.liveModal.emailLabel')}
                  </span>
                  <span className="block text-xs text-token-textMuted mt-0.5">
                    {t('teachingGroups.liveModal.emailHint')}
                  </span>
                </span>
              </label>
            </div>
            {liveNotifySms && liveNotifyEmail ? (
              <p className="text-xs text-primary/90">{t('teachingGroups.liveModal.bothChannels')}</p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={t('teachingGroups.confirmModal.title')}
        size="sm"
        zIndex={10060}
        footer={
          <div className="flex justify-center gap-3">
            <Button
              type="button"
              variant="secondary"
              className="min-w-[120px] justify-center"
              disabled={confirmDelete?.type ? false : true}
              onClick={() => setConfirmDelete(null)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="min-w-[140px] justify-center"
              loading={
                confirmDelete?.type === 'subject'
                  ? Boolean(busy[`dels-${confirmDelete.id}`])
                  : confirmDelete?.type === 'group'
                    ? Boolean(busy[`delg-${confirmDelete.id}`])
                    : false
              }
              onClick={async () => {
                const d = confirmDelete
                setConfirmDelete(null)
                if (!d?.id) return
                if (d.type === 'subject') await removeSubject(d.id)
                else await removeGroup(d.id)
              }}
            >
              {t('teachingGroups.confirmModal.confirm')}
            </Button>
          </div>
        }
      >
        {confirmDelete ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-zinc-200 leading-relaxed">
              {confirmDelete.type === 'subject'
                ? t('teachingGroups.confirmModal.deleteSubject', { name: confirmDelete.name })
                : t('teachingGroups.confirmModal.deleteGroup', { name: confirmDelete.name })}
            </p>
            <p className="text-xs text-zinc-500">{t('teachingGroups.confirmModal.irreversible')}</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(groupModal)}
        onClose={() => {
          setGroupModal(null)
          setGroupModalError('')
        }}
        title={groupModal?.mode === 'edit' ? t('teachingGroups.groupModal.editTitle') : t('teachingGroups.groupModal.createTitle')}
        size="lg"
        zIndex={10050}
      >
        {groupModal ? (
          <div className="space-y-4">
            {groupModalError ? (
              <div
                className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm text-red-100"
                role="alert"
              >
                <strong className="font-semibold text-red-200">{t('teachingGroups.groupModal.errorLabel')}</strong>{' '}
                {groupModalError}
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">
                {t('teachingGroups.groupModal.groupName')}
              </label>
              <input
                className={inp}
                value={groupModal.mode === 'create' ? groupModal.name : groupModal.group?.name || ''}
                readOnly={groupModal.mode === 'create'}
                onChange={
                  groupModal.mode === 'edit'
                    ? (e) =>
                        setGroupModal((m) => ({
                          ...m,
                          group: { ...m.group, name: e.target.value },
                        }))
                    : undefined
                }
              />
            </div>
            <GroupPackageFields value={groupPkg} onChange={setGroupPkg} />
            <div className="flex gap-2">
              <Button className="flex-1 justify-center" loading={busy.groupModal} onClick={() => void saveGroupModal()}>
                {t('students.save')}
              </Button>
              <Button
                variant="secondary"
                className="flex-1 justify-center"
                onClick={() => {
                  setGroupModal(null)
                  setGroupModalError('')
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title={t('teachingGroups.qrModal.title')} size="sm">
        <div className="space-y-4">
          <div className="text-sm text-gray-400 text-center">
            {qrGroup?.subjectName ? <div className="text-xs text-gray-500">{qrGroup.subjectName}</div> : null}
            <div className="text-white font-semibold">{qrGroup?.name}</div>
            {qrGroup?.join_code ? (
              <div className="mt-1">
                {t('teachingGroups.qrModal.joinCode')}{' '}
                <span className="text-gray-200 font-semibold">{qrGroup.join_code}</span>
              </div>
            ) : null}
          </div>
          {qrGroup?.join_code ? (
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl p-4">
                <QRCodeCanvas
                  value={`${window.location.origin}/join/${encodeURIComponent(String(qrGroup.join_code))}`}
                  size={220}
                  includeMargin
                />
              </div>
            </div>
          ) : null}
          {qrGroup?.join_code ? (
            <Button
              className="w-full justify-center"
              variant="secondary"
              onClick={async () => {
                const link = `${window.location.origin}/join/${encodeURIComponent(String(qrGroup.join_code))}`
                try {
                  await navigator.clipboard.writeText(link)
                  toast(t('teachingGroups.toasts.linkCopied'), 'success')
                } catch {
                  toast(t('teachingGroups.toasts.linkCopyFailed'), 'error')
                }
              }}
            >
              {t('teachingGroups.copyLink')}
            </Button>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}
