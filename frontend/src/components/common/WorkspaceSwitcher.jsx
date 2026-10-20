import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from './Toast'
import CreateOrganizationModal from './CreateOrganizationModal'

const ICONS = { student: '🎓', teacher: '👨‍🏫', organization: '🏫', parent: '👪', partner: '🤝', admin: '🛡️' }
const ORG_ROLE_LABELS = { owner: 'Sahib', org_admin: 'Admin' }
const PARTNER_STATUS_LABELS = { pending: 'Təsdiq gözləyir', approved: 'Təsdiqlənib', rejected: 'Rədd edilib' }

const ROLE_TO_CABINET = { instructor: 'teacher', course: 'organization', student: 'student', parent: 'parent' }
const FALLBACK_LABELS = {
  student: 'Tələbə kabineti',
  teacher: 'Müəllim kabineti',
  organization: 'Təşkilat kabineti',
  parent: 'Valideyn kabineti',
}

function useIsPhone() {
  const query = '(max-width: 639px)'
  const get = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false)
  const [phone, setPhone] = useState(get)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mq = window.matchMedia(query)
    const on = () => setPhone(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return phone
}

function cabinetSubtitle(c) {
  if (c.type === 'organization') return ORG_ROLE_LABELS[c.role_key] || 'Təşkilat'
  if (c.type === 'partner') return PARTNER_STATUS_LABELS[c.status] || 'Partner'
  return null
}

/**
 * «Kabinetlərim»: the cabinets this account really holds (GET /auth/workspaces decides; nothing is inferred here).
 * Switching keeps the session — the server swaps the active cabinet and returns a new token.
 */
export default function WorkspaceSwitcher({ className = '' }) {
  const navigate = useNavigate()
  const toast = useToast()
  const user = useAuthStore((s) => s.user)
  const switchWorkspace = useAuthStore((s) => s.switchWorkspace)
  const isPhone = useIsPhone()

  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [orgModal, setOrgModal] = useState(false)
  const rootRef = useRef(null)
  const sheetRef = useRef(null)

  const userId = user?.id
  const role = String(user?.role || '').toLowerCase()

  const load = useCallback(async () => {
    setLoadError('')
    try {
      const d = await api.get('/auth/workspaces')
      setData(d && Array.isArray(d.cabinets) ? d : { cabinets: [], actions: [], active: null })
    } catch (e) {
      setLoadError(e?.message || 'Kabinetlər yüklənmədi')
    }
  }, [])

  useEffect(() => {
    if (userId && role !== 'admin') void load()
  }, [userId, role, load])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || sheetRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user || role === 'admin') return null

  const cabinets = data?.cabinets || []
  const actions = data?.actions || []
  const active = cabinets.find((c) => c.active)
  const activeType = active?.type || ROLE_TO_CABINET[role] || 'student'
  const activeLabel = active?.label || FALLBACK_LABELS[activeType] || 'Kabinet'

  const openCabinet = async (c) => {
    if (busyKey) return
    if (c.active || c.type === 'partner') {
      setOpen(false)
      navigate(c.path)
      return
    }
    setBusyKey(c.key)
    try {
      const res = await switchWorkspace(c.type, c.type === 'organization' ? { organizationId: c.organization_id } : undefined)
      if (res?.pending_approval) {
        toast(res.message || 'Sorğunuz göndərildi.', 'success')
        await load()
        return
      }
      setOpen(false)
      toast(`${c.label} açıldı`, 'success')
      await load()
      navigate(c.path)
    } catch (e) {
      toast(e?.message || 'Kabinetə keçid alınmadı', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const requestTeacher = async () => {
    if (busyKey) return
    setBusyKey('request_teacher')
    try {
      const res = await switchWorkspace('teacher')
      if (res?.pending_approval) {
        toast(res.message || 'Müəllim icazəsi sorğunuz göndərildi.', 'success')
      } else {
        setOpen(false)
        navigate('/instructor')
      }
      await load()
    } catch (e) {
      toast(e?.message || 'Sorğu göndərilmədi', 'error')
    } finally {
      setBusyKey(null)
    }
  }

  const rowClass = (isActive) =>
    [
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-colors min-h-[44px]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35',
      isActive ? 'bg-primary/10 text-token-textMain' : 'text-token-textMain hover:bg-token-surfaceCardHover',
    ].join(' ')

  const panel = (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-3 pt-1 pb-1.5">
        <span id="mx-workspaces-title" className="text-[11px] font-bold uppercase tracking-wider text-token-textMuted">
          Kabinetlərim
        </span>
        {isPhone ? (
          <button type="button" onClick={() => setOpen(false)} className="text-xs font-semibold text-token-textMuted px-2 py-1">
            Bağla
          </button>
        ) : null}
      </div>

      {loadError ? (
        <div className="px-3 py-2 text-xs text-error flex items-center justify-between gap-2">
          <span>{loadError}</span>
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Yenidən
          </button>
        </div>
      ) : !data ? (
        <div className="space-y-1 px-1" role="status" aria-label="Yüklənir">
          {[0, 1].map((i) => (
            <div key={i} className="h-11 rounded-xl bg-token-surfaceCardHover animate-pulse" />
          ))}
        </div>
      ) : (
        <ul className="space-y-0.5" aria-labelledby="mx-workspaces-title">
          {cabinets.map((c) => {
            const sub = cabinetSubtitle(c)
            return (
              <li key={c.key}>
                <button
                  type="button"
                  className={rowClass(c.active)}
                  aria-current={c.active ? 'true' : undefined}
                  disabled={Boolean(busyKey)}
                  data-testid={`cabinet-${c.key}`}
                  onClick={() => void openCabinet(c)}
                >
                  <span className="text-base shrink-0 w-5 text-center" aria-hidden="true">
                    {ICONS[c.type] || '•'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug break-words line-clamp-2">{c.label}</span>
                    {sub ? <span className="block text-[11px] text-token-textMuted leading-snug">{sub}</span> : null}
                  </span>
                  {busyKey === c.key ? (
                    <span className="text-[11px] text-token-textMuted">…</span>
                  ) : c.active ? (
                    <span className="text-sm font-bold text-brand-text shrink-0" title="Aktiv kabinet">
                      ✓<span className="sr-only"> Aktiv</span>
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {data && actions.length ? (
        <div className="mt-1 pt-2 border-t border-[color:var(--border-subtle)] space-y-0.5">
          {actions.map((a) => {
            if (a.key === 'request_teacher') {
              const pending = a.status === 'pending'
              return (
                <button
                  key={a.key}
                  type="button"
                  className={rowClass(false)}
                  disabled={pending || Boolean(busyKey)}
                  onClick={() => void requestTeacher()}
                  data-testid="action-request_teacher"
                >
                  <span className="text-base shrink-0 w-5 text-center" aria-hidden="true">
                    {ICONS.teacher}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">Müəllim icazəsi istə</span>
                    <span className="block text-[11px] text-token-textMuted leading-snug">
                      {pending
                        ? 'Sorğu təsdiq gözləyir'
                        : a.status === 'rejected'
                          ? `Rədd edildi${a.review_reason ? `: ${a.review_reason}` : ''} — yenidən istəyin`
                          : 'Admin təsdiqindən sonra müəllim kabineti açılır'}
                    </span>
                  </span>
                </button>
              )
            }
            if (a.key === 'create_organization') {
              const pending = a.status === 'pending'
              return (
                <button
                  key={a.key}
                  type="button"
                  className={rowClass(false)}
                  disabled={pending || Boolean(busyKey)}
                  onClick={() => {
                    setOpen(false)
                    setOrgModal(true)
                  }}
                  data-testid="action-create_organization"
                >
                  <span className="text-base shrink-0 w-5 text-center" aria-hidden="true">
                    ＋
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">Təşkilat yarat</span>
                    <span className="block text-[11px] text-token-textMuted leading-snug truncate">
                      {pending
                        ? `«${a.request?.name || 'Sorğu'}» təsdiq gözləyir`
                        : a.status === 'rejected'
                          ? 'Əvvəlki sorğu rədd edilib — yenidən göndərin'
                          : 'Təhsil mərkəzi, məktəb və ya şirkət üçün'}
                    </span>
                  </span>
                </button>
              )
            }
            return null
          })}
        </div>
      ) : null}
    </div>
  )

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard hover:bg-token-surfaceCardHover text-left transition-colors min-h-[44px]"
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0 w-5 text-center" aria-hidden="true">
            {ICONS[activeType] || '•'}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-token-textMain leading-snug">{activeLabel}</span>
            <span className="block text-[10px] text-token-textMuted">Kabinetlərim</span>
          </span>
        </span>
        <span className="text-token-textMuted text-xs shrink-0" aria-hidden="true">
          {open ? '▾' : '▴'}
        </span>
      </button>

      {open && !isPhone ? (
        <div
          role="dialog"
          aria-label="Kabinetlərim"
          className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceCard shadow-xl z-[1200] max-h-[70vh] overflow-y-auto"
        >
          {panel}
        </div>
      ) : null}

      {open && isPhone
        ? createPortal(
            <div className="fixed inset-0 z-[10050] flex items-end bg-black/40" data-testid="workspaces-sheet">
              <div
                ref={sheetRef}
                role="dialog"
                aria-label="Kabinetlərim"
                className="w-full rounded-t-2xl border-t border-[color:var(--border-subtle)] bg-token-surfaceCard p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[80vh] overflow-y-auto shadow-2xl"
              >
                {panel}
              </div>
            </div>,
            document.body,
          )
        : null}

      <CreateOrganizationModal
        open={orgModal}
        previous={actions.find((a) => a.key === 'create_organization')?.request || null}
        onClose={() => setOrgModal(false)}
        onCreated={() => {
          setOrgModal(false)
          toast('Təşkilat sorğunuz göndərildi. Admin təsdiqindən sonra təşkilat kabineti açılacaq.', 'success')
          void load()
        }}
      />
    </div>
  )
}
