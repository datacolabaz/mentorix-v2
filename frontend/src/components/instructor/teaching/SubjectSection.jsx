import { useRef } from 'react'
import { Link } from 'react-router-dom'
import PortalMenu from '../../common/PortalMenu'
import { incomeText, packageSummary } from './teachingUi'

export const iconBtn =
  'inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard text-token-textMuted hover:bg-token-surfaceCardHover hover:text-token-textMain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:h-9 sm:w-9'
export const textBtn =
  'inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 text-sm font-semibold text-token-textMain hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 sm:h-9'
const menuItem = 'block w-full px-3 py-2.5 text-left text-sm text-token-textMain hover:bg-token-surfaceCardHover focus-visible:bg-token-surfaceCardHover focus-visible:outline-none'
const menuDanger = 'block w-full px-3 py-2.5 text-left text-sm font-medium text-error hover:bg-error-subtle focus-visible:bg-error-subtle focus-visible:outline-none'

/** Live button reflects the real lesson state: on air → join; otherwise → the existing scheduling flow. */
export function LiveLessonButton({ group, liveLesson, onSchedule, className = '' }) {
  if (liveLesson) {
    const url = liveLesson.start_url || liveLesson.join_url
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`${textBtn} border-error/30 text-error ${className}`}
        aria-label={`${group.name}: canlı dərs gedir — dərsə qoşul`}
      >
        <span className="h-2 w-2 rounded-full bg-error animate-pulse" aria-hidden />
        Dərsə qoşul
      </a>
    ) : (
      <Link to="/instructor/live-lessons" className={`${textBtn} text-error ${className}`}>
        <span className="h-2 w-2 rounded-full bg-error" aria-hidden />
        Dərs gedir
      </Link>
    )
  }
  return (
    <button type="button" className={`${textBtn} ${className}`} onClick={onSchedule} aria-label={`${group.name}: canlı dərs planla`}>
      Canlı dərs
    </button>
  )
}

function GroupMenu({ group, open, onToggle, onClose, onChat, onEdit, onDelete }) {
  const anchor = useRef(null)
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={iconBtn}
        aria-label={`${group.name} — qrup əməliyyatları`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span aria-hidden>⋯</span>
      </button>
      <PortalMenu open={open} onClose={onClose} anchorRef={anchor} align="end" width={210}>
        <div className="py-1" role="none">
          <button type="button" role="menuitem" className={menuItem} onClick={onChat}>
            Çatı aç
          </button>
          {!group.is_system ? (
            <>
              <button type="button" role="menuitem" className={menuItem} onClick={onEdit}>
                Paket, cədvəl və ad
              </button>
              <div className="my-1 border-t border-[color:var(--border-subtle)]" role="separator" />
              <button type="button" role="menuitem" className={menuDanger} onClick={onDelete}>
                Qrupu sil
              </button>
            </>
          ) : null}
        </div>
      </PortalMenu>
    </>
  )
}

export function GroupRow({ group, subjectName, liveLesson, menuOpen, onMenuToggle, onMenuClose, actions }) {
  const pkg = packageSummary(group)
  const count = Number(group.student_count) || 0
  const names = Array.isArray(group.student_names) ? group.student_names.filter(Boolean).join(', ') : ''
  const detailHref = `/instructor/teaching-groups/${encodeURIComponent(group.id)}`
  return (
    <li
      data-testid="group-row"
      className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-t border-[color:var(--border-subtle)] px-4 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_5rem_10rem_16.5rem] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            to={detailHref}
            className="min-w-0 break-words rounded font-semibold text-token-textMain hover:text-brand-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            title={names || undefined}
          >
            {group.name}
          </Link>
          {group.is_system ? (
            <span className="rounded-full border border-[color:var(--border-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-token-textMuted">
              Sistem
            </span>
          ) : null}
        </div>
        {/* Phones: counts and package under the name */}
        <p className="mt-0.5 text-xs text-token-textMuted sm:hidden">
          {count} tələbə · {group.is_system ? 'Avtomatik qrup' : pkg || <span className="text-warning">Paket təyin edilməyib</span>}
        </p>
      </div>
      <div className="hidden text-sm tabular-nums text-token-textMain sm:block">{count}</div>
      <div className="hidden min-w-0 text-sm sm:block">
        {group.is_system ? (
          <span className="text-token-textMuted">Avtomatik qrup</span>
        ) : pkg ? (
          <span className="text-token-textMain">{pkg}</span>
        ) : (
          <span className="text-warning">Paket təyin edilməyib</span>
        )}
      </div>
      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1 sm:col-start-4 sm:row-start-1">
        {!group.is_system ? (
          <>
            <LiveLessonButton group={group} liveLesson={liveLesson} onSchedule={actions.onLive} className="flex-1 sm:flex-none" />
            <button
              type="button"
              className={`${textBtn} flex-1 border-primary/40 text-brand-text sm:flex-none`}
              onClick={(e) => actions.onInvite(e.currentTarget)}
              aria-label={`${subjectName} / ${group.name}: dəvət et`}
              data-testid="group-invite-button"
            >
              Dəvət et
            </button>
          </>
        ) : null}
        <GroupMenu
          group={group}
          open={menuOpen}
          onToggle={onMenuToggle}
          onClose={onMenuClose}
          onChat={() => {
            onMenuClose()
            actions.onChat()
          }}
          onEdit={() => {
            onMenuClose()
            actions.onEdit()
          }}
          onDelete={() => {
            onMenuClose()
            actions.onDelete()
          }}
        />
      </div>
    </li>
  )
}

/**
 * One subject: header row (toggle | «+ Qrup» | ⋯ — siblings, never nested buttons) and its group rows.
 */
export default function SubjectSection({
  subject,
  groups,
  open,
  onToggle,
  onAddGroup,
  subjectMenuOpen,
  onSubjectMenuToggle,
  onSubjectMenuClose,
  onDeleteSubject,
  renderGroup,
}) {
  const anchor = useRef(null)
  const listId = `subject-groups-${subject.id}`
  const groupCount = (subject.groups || []).length
  return (
    <section data-testid="subject-section" className="border-t border-[color:var(--border-subtle)] first:border-t-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          aria-expanded={open}
          aria-controls={listId}
          onClick={onToggle}
        >
          <svg
            className={`h-4 w-4 shrink-0 text-token-textMuted transition-transform ${open ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="min-w-0">
            <span className="block break-words text-base font-semibold text-token-textMain">{subject.name}</span>
            <span className="mt-0.5 block text-xs text-token-textMuted">
              {groupCount} qrup · {Number(subject.student_count) || 0} tələbə · Bu ay gəlir: {incomeText(subject.income_this_month)}
            </span>
          </span>
        </button>
        <button
          type="button"
          className={`${textBtn} shrink-0`}
          onClick={(e) => onAddGroup(e.currentTarget)}
          aria-label={`${subject.name} sahəsinə qrup əlavə et`}
        >
          <span aria-hidden>+</span> Qrup
        </button>
        <button
          ref={anchor}
          type="button"
          className={`${iconBtn} shrink-0`}
          aria-label={`${subject.name} — sahə əməliyyatları`}
          aria-haspopup="menu"
          aria-expanded={subjectMenuOpen}
          onClick={onSubjectMenuToggle}
        >
          <span aria-hidden>⋯</span>
        </button>
        <PortalMenu open={subjectMenuOpen} onClose={onSubjectMenuClose} anchorRef={anchor} align="end" width={200}>
          <div className="py-1" role="none">
            <button
              type="button"
              role="menuitem"
              className={menuDanger}
              onClick={() => {
                onSubjectMenuClose()
                onDeleteSubject()
              }}
            >
              Sahəni sil
            </button>
          </div>
        </PortalMenu>
      </div>
      {open ? (
        <div id={listId} className="pb-2 sm:pl-7">
          {groups.length ? (
            <div className="mx-2 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] sm:mx-4">
              <div
                className="hidden grid-cols-[minmax(0,1fr)_5rem_10rem_16.5rem] gap-x-3 bg-canvas-subtle px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-token-textMuted sm:grid"
                aria-hidden
              >
                <span>Qrup</span>
                <span>Tələbə</span>
                <span>Dərs paketi</span>
                <span className="text-right">Əməliyyatlar</span>
              </div>
              <ul>{groups.map((g) => renderGroup(g))}</ul>
            </div>
          ) : (
            <div className="mx-2 rounded-xl border border-dashed border-[color:var(--border-subtle)] px-4 py-4 text-sm text-token-textMuted sm:mx-4">
              Bu sahədə hələ qrup yoxdur.{' '}
              <button type="button" className="font-semibold text-brand-text underline-offset-2 hover:underline" onClick={(e) => onAddGroup(e.currentTarget)}>
                İlk qrupu yaradın
              </button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}
