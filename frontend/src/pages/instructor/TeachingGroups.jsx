import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useToast } from '../../components/common/Toast'
import { emptyGroupPackage, groupPackageFromApi, groupPackagePayload } from '../../components/instructor/GroupPackageFields'
import { normalizeTeachingSubjects } from '../../lib/teachingSubjects'
import { useBillingStatus } from '../../hooks/useBillingStatus'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { basicTrialExpiredMessage } from '../../lib/subscriptionPlanGuards'
import SubjectSection, { GroupRow } from '../../components/instructor/teaching/SubjectSection'
import InviteDrawer from '../../components/instructor/teaching/InviteDrawer'
import { CreateSubjectModal, DeleteConfirmModal, GroupFormModal } from '../../components/instructor/teaching/TeachingModals'
import { useLiveLessonsByGroup } from '../../components/instructor/teaching/teachingUi'

export function subjectStudentTotal(s) {
  const own = Number(s?.student_count) || 0
  const fromGroups = (s?.groups || []).reduce((n, g) => n + (Number(g?.student_count) || 0), 0)
  return Math.max(own, fromGroups)
}

/** Delete targets carry the real consequences; subjects/groups with students are blocked (approved rule A). */
export function subjectDeleteTarget(s) {
  const name = s?.name || 'Sahə'
  const groups = (s?.groups || []).filter(Boolean)
  const students = subjectStudentTotal(s)
  return {
    type: 'subject',
    id: s?.id,
    name,
    groupNames: groups.map((g) => g.name),
    blockedReason:
      students > 0
        ? `«${name}» sahəsində tələbəsi olan qruplar var (${students} tələbə). Sahə silinəndə bütün qrupları da silinir, ona görə əvvəlcə tələbələri başqa sahənin qrupuna köçürün və ya qruplardan çıxarın.`
        : null,
  }
}

export function groupDeleteTarget(g) {
  const name = g?.name || 'Qrup'
  const n = Number(g?.student_count) || 0
  return {
    type: 'group',
    id: g?.id,
    name,
    blockedReason:
      n > 0
        ? `«${name}» qrupunda ${n} tələbə var. Qrupu silmək üçün əvvəlcə tələbələri başqa qrupa köçürün («Tələbələrim» səhifəsində sürükləyib buraxa bilərsiniz).`
        : null,
  }
}

/** Search: a subject-name hit shows all its groups; otherwise only matching groups. */
export function filterSubjects(subjects, query) {
  const q = String(query || '').trim().toLocaleLowerCase('az')
  if (!q) return subjects.map((s) => ({ subject: s, groups: (s.groups || []).filter(Boolean) }))
  const out = []
  for (const s of subjects) {
    const groups = (s.groups || []).filter(Boolean)
    if (String(s.name || '').toLocaleLowerCase('az').includes(q)) {
      out.push({ subject: s, groups })
      continue
    }
    const hits = groups.filter((g) => String(g.name || '').toLocaleLowerCase('az').includes(q))
    if (hits.length) out.push({ subject: s, groups: hits })
  }
  return out
}

export default function InstructorTeachingGroups() {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const blocked = Boolean(billing?.should_block)
  const blockMessage = billing?.messages?.banner || basicTrialExpiredMessage(plans)
  const liveByGroup = useLiveLessonsByGroup()

  const [initialLoading, setInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [subjects, setSubjects] = useState([])
  const [openSubjects, setOpenSubjects] = useState(() => new Set())
  const openInitRef = useRef(false)
  const [search, setSearch] = useState('')
  const [searchToggled, setSearchToggled] = useState(() => new Set())
  const [openMenu, setOpenMenu] = useState(null)

  const [createSubjectOpen, setCreateSubjectOpen] = useState(false)
  const [subjectBusy, setSubjectBusy] = useState(false)
  const [groupModal, setGroupModal] = useState(null)
  const [groupModalError, setGroupModalError] = useState('')
  const [groupPkg, setGroupPkg] = useState(emptyGroupPackage)
  const [groupBusy, setGroupBusy] = useState(false)
  const groupBusyRef = useRef(false)
  const [invite, setInvite] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const safeSubjects = useMemo(() => normalizeTeachingSubjects(subjects).filter((s) => s && !s.is_system), [subjects])

  const load = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent)
      if (silent) setRefreshing(true)
      else {
        setInitialLoading(true)
        setLoadError('')
      }
      try {
        const d = await api.get('/instructor/teaching')
        setSubjects(Array.isArray(d.subjects) ? d.subjects : [])
        setLoadError('')
      } catch (e) {
        if (silent) toast(e?.message || t('teachingGroups.toasts.loadFailed'), 'error')
        else setLoadError(e?.message || 'Sahələr yüklənmədi')
      } finally {
        if (silent) setRefreshing(false)
        else setInitialLoading(false)
      }
    },
    [toast, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  // First visit: only the first subject is open. Later reloads never collapse what the teacher opened.
  useEffect(() => {
    if (openInitRef.current || !safeSubjects.length) return
    openInitRef.current = true
    setOpenSubjects(new Set([String(safeSubjects[0].id)]))
  }, [safeSubjects])

  useEffect(() => {
    setSearchToggled(new Set())
  }, [search])

  const searching = search.trim().length > 0
  const visible = useMemo(() => filterSubjects(safeSubjects, search), [safeSubjects, search])
  const isOpen = (id) => {
    const key = String(id)
    // While searching, every matching subject opens; the teacher can still fold one (XOR with toggles).
    if (searching) return !searchToggled.has(key)
    return openSubjects.has(key)
  }
  const toggleSubject = (id) => {
    const key = String(id)
    setOpenMenu(null)
    const flip = (prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    }
    if (searching) setSearchToggled(flip)
    else setOpenSubjects(flip)
  }
  const ensureOpen = (id) => {
    setOpenSubjects((prev) => (prev.has(String(id)) ? prev : new Set([...prev, String(id)])))
  }

  const guardBlocked = () => {
    if (!blocked) return false
    toast(blockMessage, 'error')
    return true
  }

  /* ---------- subjects ---------- */
  const createSubject = async (name) => {
    if (guardBlocked()) return { error: blockMessage }
    if (subjectBusy) return null
    setSubjectBusy(true)
    try {
      const d = await api.post('/instructor/teaching/subjects', { name })
      const created = d?.subject
      if (created?.id) {
        setSubjects((prev) => [
          ...(Array.isArray(prev) ? prev : []),
          { ...created, groups: Array.isArray(created.groups) ? created.groups : [], student_count: Number(created.student_count) || 0, income_this_month: Number(created.income_this_month) || 0 },
        ])
        ensureOpen(created.id)
        openInitRef.current = true
      }
      setCreateSubjectOpen(false)
      toast(t('teachingGroups.toasts.subjectAdded'), 'success')
      void load({ silent: true })
      return null
    } catch (e) {
      return { error: e?.message || 'Sahə yaradılmadı' }
    } finally {
      setSubjectBusy(false)
    }
  }

  /* ---------- groups ---------- */
  const openCreateGroup = (subject) => {
    if (guardBlocked()) return
    setOpenMenu(null)
    setGroupPkg(emptyGroupPackage())
    setGroupModalError('')
    setGroupModal({ mode: 'create', subjectId: subject.id, subjectName: subject.name, name: '' })
  }

  const openEditGroup = (subject, group) => {
    if (guardBlocked()) return
    if (group?.is_system) {
      toast(t('teachingGroups.toasts.systemGroupNoEdit'), 'info')
      return
    }
    setGroupPkg(groupPackageFromApi(group))
    setGroupModalError('')
    setGroupModal({ mode: 'edit', subjectId: subject.id, subjectName: subject.name, group: { ...group } })
  }

  const saveGroupModal = async () => {
    if (!groupModal || groupBusyRef.current) return
    if (guardBlocked()) return
    const name = String(groupModal.mode === 'create' ? groupModal.name : groupModal.group?.name || '').trim()
    if (!name) {
      setGroupModalError(t('teachingGroups.toasts.groupNameRequired'))
      return
    }
    if (!(groupPkg.default_lesson_weekdays || []).length) {
      setGroupModalError(t('teachingGroups.toasts.weekdayRequired'))
      return
    }
    if (!String(groupPkg.default_package_fee || '').trim()) {
      setGroupModalError(t('teachingGroups.toasts.feeRequired'))
      return
    }
    setGroupModalError('')
    groupBusyRef.current = true
    setGroupBusy(true)
    try {
      const body = groupPackagePayload(groupPkg, name)
      if (groupModal.mode === 'create') {
        await api.post('/instructor/teaching/groups', { subject_id: groupModal.subjectId, ...body })
        ensureOpen(groupModal.subjectId)
        toast(t('teachingGroups.toasts.groupCreated'), 'success')
      } else if (groupModal.group?.id) {
        await api.patch(`/instructor/teaching/groups/${encodeURIComponent(groupModal.group.id)}`, body)
        toast(t('teachingGroups.toasts.groupUpdated'), 'success')
      }
      setGroupModal(null)
      await load({ silent: true })
    } catch (e) {
      // The form keeps everything that was typed.
      setGroupModalError(e?.message || t('teachingGroups.toasts.error'))
    } finally {
      groupBusyRef.current = false
      setGroupBusy(false)
    }
  }

  /* ---------- delete ---------- */
  const askDeleteSubject = (s) => {
    setDeleteError('')
    setDeleteTarget(subjectDeleteTarget(s))
  }
  const askDeleteGroup = (g) => {
    if (g?.is_system) {
      toast(t('teachingGroups.toasts.systemGroupNoDelete'), 'info')
      return
    }
    setDeleteError('')
    setDeleteTarget(groupDeleteTarget(g))
  }
  const confirmDelete = async () => {
    const d = deleteTarget
    if (!d?.id || d.blockedReason || deleteBusy) return
    if (guardBlocked()) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const path = d.type === 'subject' ? '/instructor/teaching/subjects/' : '/instructor/teaching/groups/'
      await api.delete(path + encodeURIComponent(d.id))
      setDeleteTarget(null)
      toast(d.type === 'subject' ? `«${d.name}» sahəsi silindi` : `«${d.name}» qrupu silindi`, 'success')
      await load({ silent: true })
    } catch (e) {
      setDeleteError(e?.message || 'Silmək alınmadı')
    } finally {
      setDeleteBusy(false)
    }
  }

  const totalGroups = safeSubjects.reduce((n, s) => n + (s.groups || []).length, 0)

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 p-4 sm:p-6" data-tour-id="page:instructor-teaching-groups">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-token-textMain sm:text-2xl">Sahələr və qruplar</h1>
          <p className="mt-1 text-sm text-token-textMuted">Qruplarınızı, dərs paketlərini və dəvətləri idarə edin.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-brand-on hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-60"
          onClick={() => {
            if (!guardBlocked()) setCreateSubjectOpen(true)
          }}
        >
          <span aria-hidden>+</span> Sahə yarat
        </button>
      </div>

      <label className="relative block">
        <span className="sr-only">Sahə və ya qrup axtar</span>
        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-token-textMuted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="9" cy="9" r="6" />
          <path d="m13.5 13.5 3.5 3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sahə və ya qrup axtar..."
          className="h-11 w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard pl-9 pr-3 text-sm text-token-textMain placeholder:text-token-textMuted outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      </label>

      {refreshing ? (
        <p className="text-xs text-token-textMuted" role="status">
          {t('teachingGroups.refreshing')}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard">
        {initialLoading ? (
          <div className="space-y-3 p-4" role="status" aria-label="Yüklənir">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-canvas-subtle" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-6 text-center" role="alert">
            <p className="text-sm font-semibold text-error">{loadError}</p>
            <button type="button" className="mt-3 inline-flex h-10 items-center rounded-xl border border-[color:var(--border-subtle)] px-4 text-sm font-semibold text-token-textMain hover:bg-token-surfaceCardHover" onClick={() => void load()}>
              Yenidən yüklə
            </button>
          </div>
        ) : !safeSubjects.length ? (
          <div className="px-6 py-12 text-center">
            <p className="text-base font-semibold text-token-textMain">Hələ sahə yoxdur</p>
            <p className="mt-1 text-sm text-token-textMuted">Sahə yaradın (məs. Riyaziyyat), sonra onun içində qruplar açın.</p>
            <button
              type="button"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-brand-on hover:brightness-105"
              onClick={() => {
                if (!guardBlocked()) setCreateSubjectOpen(true)
              }}
            >
              <span aria-hidden>+</span> Sahə yarat
            </button>
          </div>
        ) : !visible.length ? (
          <div className="px-6 py-10 text-center" role="status">
            <p className="text-base font-semibold text-token-textMain">Uyğun nəticə tapılmadı</p>
            <p className="mt-1 text-sm text-token-textMuted">«{search.trim()}» üzrə sahə və ya qrup yoxdur.</p>
            <button type="button" className="mt-3 text-sm font-semibold text-brand-text hover:underline" onClick={() => setSearch('')}>
              Axtarışı təmizlə
            </button>
          </div>
        ) : (
          visible.map(({ subject: s, groups }) => (
            <SubjectSection
              key={s.id}
              subject={s}
              groups={groups}
              open={isOpen(s.id)}
              onToggle={() => toggleSubject(s.id)}
              onAddGroup={() => openCreateGroup(s)}
              subjectMenuOpen={openMenu === `s:${s.id}`}
              onSubjectMenuToggle={() => setOpenMenu((m) => (m === `s:${s.id}` ? null : `s:${s.id}`))}
              onSubjectMenuClose={() => setOpenMenu(null)}
              onDeleteSubject={() => askDeleteSubject(s)}
              renderGroup={(g) => (
                <GroupRow
                  key={g.id}
                  group={g}
                  subjectName={s.name}
                  liveLesson={liveByGroup[g.id] || null}
                  menuOpen={openMenu === `g:${g.id}`}
                  onMenuToggle={() => setOpenMenu((m) => (m === `g:${g.id}` ? null : `g:${g.id}`))}
                  onMenuClose={() => setOpenMenu(null)}
                  actions={{
                    onLive: () => navigate(`/instructor/live-lessons?new=1&group=${encodeURIComponent(g.id)}`),
                    onInvite: () => setInvite({ group: g, subjectName: s.name }),
                    onChat: () => navigate(`/instructor/chat?groupId=${encodeURIComponent(g.id)}`),
                    onEdit: () => openEditGroup(s, g),
                    onDelete: () => askDeleteGroup(g),
                  }}
                />
              )}
            />
          ))
        )}
      </div>

      {!initialLoading && !loadError && safeSubjects.length ? (
        <p className="text-xs text-token-textMuted">
          {safeSubjects.length} sahə · {totalGroups} qrup
        </p>
      ) : null}

      <CreateSubjectModal open={createSubjectOpen} busy={subjectBusy} onClose={() => setCreateSubjectOpen(false)} onSubmit={createSubject} />
      <GroupFormModal
        state={groupModal}
        onChange={setGroupModal}
        pkg={groupPkg}
        onPkgChange={setGroupPkg}
        error={groupModalError}
        busy={groupBusy}
        onSave={saveGroupModal}
        onClose={() => {
          setGroupModal(null)
          setGroupModalError('')
        }}
      />
      <DeleteConfirmModal
        target={deleteTarget}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onClose={() => {
          setDeleteTarget(null)
          setDeleteError('')
        }}
      />
      <InviteDrawer open={Boolean(invite)} group={invite?.group || null} subjectName={invite?.subjectName} onClose={() => setInvite(null)} />
    </div>
  )
}
