import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useToast } from '../../components/common/Toast'
import { groupPackageFromApi, groupPackagePayload } from '../../components/instructor/GroupPackageFields'
import { normalizeTeachingSubjects } from '../../lib/teachingSubjects'
import { useBillingStatus } from '../../hooks/useBillingStatus'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { basicTrialExpiredMessage } from '../../lib/subscriptionPlanGuards'
import { LiveLessonButton, textBtn } from '../../components/instructor/teaching/SubjectSection'
import InviteDrawer from '../../components/instructor/teaching/InviteDrawer'
import { GroupFormModal } from '../../components/instructor/teaching/TeachingModals'
import { packageSummary, scheduleSummary, useLiveLessonsByGroup } from '../../components/instructor/teaching/teachingUi'

const TERMINAL = new Set(['rejected', 'left', 'archived', 'deleted'])

function statusLabel(s) {
  const st = String(s?.enrollment_status || '').toLowerCase()
  if (st === 'pending_approval') return { text: 'Təsdiq gözləyir', cls: 'bg-info-subtle text-info' }
  if (st === 'pending_setup') return { text: 'Quraşdırma lazım', cls: 'bg-warning-subtle text-warning' }
  return { text: 'Aktiv', cls: 'bg-success-subtle text-success' }
}

/** One group only: its own row from /instructor/teaching and its own enrollments from /students. */
export default function TeachingGroupDetail() {
  const { groupId } = useParams()
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const billing = useBillingStatus().data || null
  const plans = useSubscriptionPlans().data
  const blocked = Boolean(billing?.should_block)
  const blockMessage = billing?.messages?.banner || basicTrialExpiredMessage(Array.isArray(plans) ? plans : [])
  const liveByGroup = useLiveLessonsByGroup()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subjects, setSubjects] = useState([])
  const [students, setStudents] = useState([])
  const [studentsError, setStudentsError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [pkg, setPkg] = useState(null)
  const [modalError, setModalError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setStudentsError('')
    try {
      const [teaching, st] = await Promise.allSettled([api.get('/instructor/teaching'), api.get('/students')])
      if (teaching.status !== 'fulfilled') throw teaching.reason
      setSubjects(Array.isArray(teaching.value?.subjects) ? teaching.value.subjects : [])
      if (st.status === 'fulfilled') setStudents(Array.isArray(st.value?.students) ? st.value.students : [])
      else setStudentsError(st.reason?.message || 'Tələbələr yüklənmədi')
    } catch (e) {
      setError(e?.message || 'Qrup yüklənmədi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const { subject, group } = useMemo(() => {
    for (const s of normalizeTeachingSubjects(subjects)) {
      const g = (s.groups || []).find((x) => String(x?.id) === String(groupId))
      if (g) return { subject: s, group: g }
    }
    return { subject: null, group: null }
  }, [subjects, groupId])

  const members = useMemo(
    () =>
      students
        .filter((s) => String(s?.group_id || '') === String(groupId) && !TERMINAL.has(String(s?.enrollment_status || '').toLowerCase()))
        .sort((a, b) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'az')),
    [students, groupId],
  )

  const openEdit = () => {
    if (blocked) {
      toast(blockMessage, 'error')
      return
    }
    setPkg(groupPackageFromApi(group))
    setModalError('')
    setModal({ mode: 'edit', subjectId: subject.id, subjectName: subject.name, group: { ...group } })
  }

  const save = async () => {
    if (!modal || busy) return
    const name = String(modal.group?.name || '').trim()
    if (!name) return setModalError(t('teachingGroups.toasts.groupNameRequired'))
    if (!(pkg.default_lesson_weekdays || []).length) return setModalError(t('teachingGroups.toasts.weekdayRequired'))
    if (!String(pkg.default_package_fee || '').trim()) return setModalError(t('teachingGroups.toasts.feeRequired'))
    setBusy(true)
    setModalError('')
    try {
      await api.patch(`/instructor/teaching/groups/${encodeURIComponent(group.id)}`, groupPackagePayload(pkg, name))
      toast(t('teachingGroups.toasts.groupUpdated'), 'success')
      setModal(null)
      await load()
    } catch (e) {
      setModalError(e?.message || t('teachingGroups.toasts.error'))
    } finally {
      setBusy(false)
    }
  }

  const crumbs = (
    <nav aria-label="Naviqasiya" className="text-sm text-token-textMuted">
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5">
        <li>
          <Link to="/instructor/teaching-groups" className="hover:text-token-textMain hover:underline">
            Sahələr və qruplar
          </Link>
        </li>
        {subject ? (
          <>
            <li aria-hidden>/</li>
            <li className="max-w-[12rem] truncate">{subject.name}</li>
          </>
        ) : null}
        {group ? (
          <>
            <li aria-hidden>/</li>
            <li className="max-w-[14rem] truncate font-medium text-token-textMain" aria-current="page">
              {group.name}
            </li>
          </>
        ) : null}
      </ol>
    </nav>
  )

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6" role="status" aria-label="Yüklənir">
        {crumbs}
        <div className="h-8 w-48 animate-pulse rounded-lg bg-canvas-subtle" />
        <div className="h-40 animate-pulse rounded-2xl bg-canvas-subtle" />
      </div>
    )
  }

  if (error || !group) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">
        {crumbs}
        <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard p-8 text-center" role="alert">
          <p className="font-semibold text-token-textMain">{error || 'Qrup tapılmadı'}</p>
          <p className="mt-1 text-sm text-token-textMuted">{error ? 'Bir az sonra yenidən cəhd edin.' : 'Qrup silinib və ya sizə aid deyil.'}</p>
          <div className="mt-4 flex justify-center gap-2">
            {error ? (
              <button type="button" className={textBtn} onClick={() => void load()}>
                Yenidən yüklə
              </button>
            ) : null}
            <Link to="/instructor/teaching-groups" className={textBtn}>
              Siyahıya qayıt
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const pack = packageSummary(group)
  const schedule = scheduleSummary(group)
  const section = 'rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard'

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-4 sm:p-6" data-testid="group-detail">
      {crumbs}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words font-display text-xl font-bold text-token-textMain sm:text-2xl">{group.name}</h1>
          <p className="mt-1 text-sm text-token-textMuted">
            {subject?.name} · {members.length} tələbə · {group.is_system ? 'Avtomatik qrup' : pack || 'Paket təyin edilməyib'}
          </p>
        </div>
        {!group.is_system ? (
          <div className="flex gap-2">
            <LiveLessonButton
              group={group}
              liveLesson={liveByGroup[group.id] || null}
              onSchedule={() => navigate(`/instructor/live-lessons?new=1&group=${encodeURIComponent(group.id)}`)}
              className="flex-1 sm:flex-none"
            />
            <button type="button" className={`${textBtn} flex-1 border-primary/40 text-brand-text sm:flex-none`} onClick={() => setInviteOpen(true)}>
              Dəvət et
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className={section} aria-labelledby="gd-students">
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border-subtle)] px-4 py-3">
            <h2 id="gd-students" className="font-semibold text-token-textMain">
              Tələbələr <span className="font-normal text-token-textMuted">({members.length})</span>
            </h2>
            <Link to="/instructor/students" className="text-sm font-semibold text-brand-text hover:underline">
              Tələbələrimdə idarə et
            </Link>
          </div>
          {studentsError ? (
            <p className="px-4 py-4 text-sm text-error" role="alert">
              {studentsError}
            </p>
          ) : members.length ? (
            <ul>
              {members.map((s) => {
                const st = statusLabel(s)
                return (
                  <li key={s.enrollment_id || s.id} className="flex items-center justify-between gap-3 border-t border-[color:var(--border-subtle)] px-4 py-2.5 first:border-t-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-token-textMain">{s.full_name}</p>
                      {s.phone ? <p className="text-xs tabular-nums text-token-textMuted">{s.phone}</p> : null}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-token-textMuted">Bu qrupda hələ tələbə yoxdur. «Dəvət et» ilə link göndərin.</p>
          )}
        </section>

        <div className="space-y-5">
          {!group.is_system ? (
            <section className={`${section} p-4`} aria-labelledby="gd-package">
              <h2 id="gd-package" className="font-semibold text-token-textMain">
                Paket və cədvəl
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-token-textMuted">Paket</dt>
                  <dd className={pack ? 'text-right text-token-textMain' : 'text-right text-warning'}>{pack || 'Paket təyin edilməyib'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-token-textMuted">Cədvəl</dt>
                  <dd className="text-right text-token-textMain">{schedule || '—'}</dd>
                </div>
              </dl>
              <button type="button" className={`${textBtn} mt-4 w-full`} onClick={openEdit}>
                Paket, cədvəl və adı dəyiş
              </button>
            </section>
          ) : null}
          <section className={`${section} p-4`} aria-labelledby="gd-chat">
            <h2 id="gd-chat" className="font-semibold text-token-textMain">
              Çat
            </h2>
            <p className="mt-1 text-sm text-token-textMuted">Qrupun ümumi çatı — yalnız bu qrupun üzvləri görür.</p>
            <button type="button" className={`${textBtn} mt-3 w-full`} onClick={() => navigate(`/instructor/chat?groupId=${encodeURIComponent(group.id)}`)}>
              Çatı aç
            </button>
          </section>
        </div>
      </div>

      <InviteDrawer open={inviteOpen} group={group} subjectName={subject?.name} onClose={() => setInviteOpen(false)} />
      <GroupFormModal
        state={modal}
        onChange={setModal}
        pkg={pkg}
        onPkgChange={setPkg}
        error={modalError}
        busy={busy}
        onSave={save}
        onClose={() => {
          setModal(null)
          setModalError('')
        }}
      />
    </div>
  )
}
