import { Link } from 'react-router-dom'

export function MentorIcon({ name, size = 18, stroke = 1.8 }) {
  const paths = {
    target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    note: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
    trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/></>,
    star: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1Z"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.target}</svg>
}

export function MentorPage({ children, className = '' }) {
  return <div className={`mx-auto max-w-[1440px] space-y-6 pb-16 ${className}`}>{children}</div>
}

export function MentorPageHeader({ eyebrow, title, description, action, secondary }) {
  return <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
    <div className="max-w-3xl">
      {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-[#087f70]">{eyebrow}</p>}
      <h1 className="mt-2 text-2xl font-black tracking-[-.025em] text-[#0a2928] sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
    {(action || secondary) && <div className="flex flex-wrap gap-2">{secondary}{action}</div>}
  </header>
}

export function PrimaryButton({ children, onClick, type = 'button', disabled = false, className = '' }) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#087f70] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#06685d] active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}>{children}</button>
}

export function SecondaryButton({ children, onClick, type = 'button', className = '' }) {
  return <button type={type} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-[#087f70] hover:text-[#087f70] active:scale-[.98] ${className}`}>{children}</button>
}

export function MentorCard({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_6px_24px_rgba(15,23,42,.035)] sm:p-6 ${className}`}>{children}</section>
}

export function SectionTitle({ title, description, action }) {
  return <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-extrabold text-[#0a2928] sm:text-base">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>{action}</div>
}

export function Metric({ label, value, note, icon = 'trend' }) {
  return <MentorCard className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{label}</p><span className="text-[#087f70]"><MentorIcon name={icon} size={18} /></span></div><p className="mt-4 text-2xl font-black tracking-tight text-[#0a2928]">{value}</p>{note && <p className="mt-1 text-[11px] text-slate-400">{note}</p>}</MentorCard>
}

export function EmptyState({ icon = 'target', title, text, action, link }) {
  const body = <><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-[#087f70]"><MentorIcon name={icon} size={20} /></span><p className="mt-3 text-sm font-extrabold text-[#0a2928]">{title}</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{text}</p>{action && <span className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-[#087f70]">{action} <MentorIcon name="arrow" size={13} /></span>}</>
  return link ? <Link to={link} className="block rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center transition hover:border-[#087f70]">{body}</Link> : <div className="rounded-xl border border-dashed border-slate-200 px-5 py-8 text-center">{body}</div>
}

export function StatusPill({ value }) {
  const labels = { active: 'Aktiv', draft: 'Qaralama', paused: 'Dayandırılıb', completed: 'Tamamlanıb', planned: 'Planlanıb', cancelled: 'Ləğv edilib', todo: 'Gözləyir', doing: 'İcradadır', done: 'Hazırdır', private: 'Şəxsi', mentees: 'Mentee-lər', accepted: 'Qəbul edilib', shared: 'Paylaşılıb' }
  const positive = ['active', 'completed', 'done', 'accepted'].includes(value)
  const muted = ['draft', 'paused', 'cancelled', 'private'].includes(value)
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${positive ? 'bg-emerald-50 text-[#087f70]' : muted ? 'bg-slate-100 text-slate-500' : 'bg-[#eff5ed] text-[#52715c]'}`}>{labels[value] || value}</span>
}

export function ProgressBar({ value }) {
  const safe = Math.min(100, Math.max(0, Number(value) || 0))
  return <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#087f70] transition-all" style={{ width: `${safe}%` }} /></div>
}

export function MentorModal({ open, title, description, children, onClose, footer }) {
  if (!open) return null
  return <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 className="text-base font-black text-[#0a2928]">{title}</h2>{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div><button type="button" onClick={onClose} className="rounded-lg px-2 text-xl text-slate-400 hover:bg-slate-100">×</button></div><div className="p-5">{children}</div>{footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-5 py-4">{footer}</div>}</div></div>
}

export function Field({ label, hint, children }) {
  return <label className="block"><span className="text-xs font-bold text-slate-700">{label}</span>{hint && <span className="ml-2 text-[10px] text-slate-400">{hint}</span>}<span className="mt-1.5 block">{children}</span></label>
}

export const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-350 focus:border-[#087f70] focus:ring-2 focus:ring-[#087f70]/10'

export function formatDate(value, fallback = 'Tarix seçilməyib') {
  if (!value) return fallback
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback
  return new Intl.DateTimeFormat('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
}

export function menteeName(mentee, fallback = 'Mentee seçilməyib') {
  return mentee?.full_name || mentee?.name || mentee?.email || fallback
}
