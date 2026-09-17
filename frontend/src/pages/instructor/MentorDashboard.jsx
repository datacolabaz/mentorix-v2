import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthStore from '../../hooks/useAuth'
import api from '../../lib/api'
import BookingModal from '../../components/common/BookingModal'
import { useToast } from '../../components/common/Toast'

const SvgIcon = ({ name, size = 18, stroke = 1.8 }) => {
  const paths = {
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    trend: <><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    spark: <><path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4L12 3Z"/><path d="m19 16-.6 2.4L16 19l2.4.6L19 22l.6-2.4L22 19l-2.4-.6L19 16Z"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const fallbackSessions = [
  { id: 'demo-1', date: '18', month: 'SEN', time: '18:00', name: 'Növbəti sessiyanızı planlaşdırın', topic: 'İlk mentee-nizlə görüş burada görünəcək', tone: 'emerald' },
]

export default function MentorDashboard() {
  const { user } = useAuthStore()
  const toast = useToast()
  const [bookingOpen, setBookingOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [inquiries, setInquiries] = useState([])
  const [onboarding, setOnboarding] = useState(null)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [serviceName, setServiceName] = useState('')
  const [services, setServices] = useState([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      api.get('/students').catch(() => ({ students: [] })),
      api.get('/students/instructor/my-lessons').catch(() => ({ lessons: [] })),
      api.get('/instructor/inquiries').catch(() => ({ inquiries: [] })),
      api.get('/mentor/onboarding').catch(() => null),
    ]).then(([studentData, sessionData, inquiryData, onboardingData]) => {
      if (cancelled) return
      setStudents(Array.isArray(studentData?.students) ? studentData.students : [])
      setSessions(Array.isArray(sessionData?.lessons) ? sessionData.lessons : [])
      setInquiries(Array.isArray(inquiryData?.inquiries) ? inquiryData.inquiries : [])
      setOnboarding(onboardingData)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const firstName = user?.full_name?.trim()?.split(/\s+/)[0] || 'Mentor'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Sabahınız xeyir' : hour < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir'
  const profileCompletion = Number(onboarding?.completion ?? onboarding?.profile_completion ?? 72)
  const activeSessions = sessions.filter((item) => new Date(item?.start_at || item?.date || 0) >= new Date()).slice(0, 3)
  const visibleSessions = activeSessions.length ? activeSessions : fallbackSessions
  const initials = firstName.slice(0, 1).toUpperCase()
  const roadmap = [
    { label: 'Profil və ekspertiza', done: profileCompletion >= 80 },
    { label: 'Mentor xidmətinizi yaradın', done: services.length > 0 },
    { label: 'İlk mentee ilə əlaqə', done: students.length > 0 },
  ]
  const completedSteps = roadmap.filter((step) => step.done).length

  const metrics = useMemo(() => [
    { label: 'Aktiv mentee-lər', value: students.length, note: students.length ? 'Davam edən mentorluq' : 'İlk mentee-nizi gözləyir', icon: 'users' },
    { label: 'Bu ay sessiyalar', value: sessions.length, note: sessions.length ? 'Planlaşdırılmış görüşlər' : 'Hələ sessiya yoxdur', icon: 'calendar' },
    { label: 'Orta reytinq', value: '—', note: 'İlk rəyinizi gözləyir', icon: 'trend' },
    { label: 'Bu ay qazanc', value: '0 ₼', note: 'Sessiyalardan gəlir', icon: 'trend' },
  ], [sessions.length, students.length])

  const handleServiceSave = () => {
    if (!serviceName.trim()) return toast('Xidmətin adını yazın', 'error')
    setServices((items) => [...items, { id: Date.now(), title: serviceName.trim() }])
    setServiceName('')
    setServiceOpen(false)
    toast('Mentor xidməti əlavə edildi', 'success')
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-16">
      <section className="relative overflow-hidden rounded-[28px] bg-[#062f2b] px-6 py-7 text-white shadow-[0_18px_45px_rgba(3,49,44,0.16)] sm:px-8 lg:px-10">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-emerald-300/10" />
        <div className="absolute right-12 top-10 h-40 w-40 rounded-full border border-emerald-300/10" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200"><SvgIcon name="spark" size={14} /> Mentor kabineti</div>
            <h1 className="text-3xl font-extrabold tracking-[-0.03em] sm:text-4xl">{greeting}, {firstName}.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/70">Mentee-lərinizin məqsədlərini izləyin, sessiyalarınızı idarə edin və mentorluq təsirinizi bir yerdən böyüdün.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setBookingOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#b7f34a] px-4 py-2.5 text-xs font-extrabold text-[#062f2b] transition hover:bg-[#c7fa69] active:scale-[.98]"><SvgIcon name="plus" size={16} /> Yeni sessiya təyin et</button>
              <Link to="/instructor/settings" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white/10">Profili idarə et <SvgIcon name="arrow" size={15} /></Link>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm lg:min-w-[275px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#b7f34a] text-xl font-black text-[#062f2b]">{initials}</div>
            <div><p className="text-sm font-bold">{user?.full_name || 'Mentor profili'}</p><p className="mt-1 text-xs text-emerald-100/60">Mentor · Aktiv profil</p><div className="mt-3 h-1.5 w-36 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#b7f34a]" style={{ width: `${Math.min(profileCompletion, 100)}%` }} /></div><p className="mt-1 text-[10px] text-emerald-100/60">Profil {profileCompletion}% tamamlanıb</p></div>
          </div>
        </div>
      </section>

      {profileCompletion < 100 && <section className="flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-extrabold text-[#063e38]">Mentor profilinizi tamamlayın</p><p className="mt-1 text-xs leading-5 text-[#35655f]">Ekspertiza və mövcudluq məlumatlarınızı tamamlayaraq daha çox uyğun mentee-yə çatın.</p></div><Link to="/instructor/settings" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#087f70] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#066d60]">Davam et <SvgIcon name="arrow" size={15} /></Link></section>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => <div key={metric.label} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_7px_24px_rgba(15,23,42,0.04)] sm:p-5"><div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-slate-500">{metric.label}</span><span className="text-[#087f70]"><SvgIcon name={metric.icon} size={18} /></span></div><p className="mt-4 text-2xl font-black tracking-tight text-[#0a2928]">{loading ? '—' : metric.value}</p><p className="mt-1 text-[11px] text-slate-400">{metric.note}</p></div>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_7px_24px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-start justify-between"><div><p className="text-base font-extrabold text-[#0a2928]">Növbəti görüşlər</p><p className="mt-1 text-xs text-slate-500">Bu həftə üçün planlaşdırılmış mentorluq sessiyaları</p></div><Link to="/instructor/schedule" className="text-xs font-bold text-[#087f70] hover:text-[#055c52]">Hamısına bax <span aria-hidden="true">→</span></Link></div><div className="mt-5 space-y-3">{visibleSessions.map((session) => <div key={session.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 text-[#087f70]"><span className="text-[10px] font-extrabold">{session.month || '—'}</span><span className="text-base font-black">{session.date || '—'}</span></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#0a2928]">{session.name || session.student_name || 'Mentee görüşü'}</p><p className="mt-1 truncate text-xs text-slate-500">{session.topic || session.title || 'Mentorluq sessiyası'} · {session.time || 'Vaxt təyin edilməyib'}</p></div><Link to="/instructor/schedule" className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 sm:inline-flex">Aç <SvgIcon name="arrow" size={13} /></Link></div>)}</div></div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_7px_24px_rgba(15,23,42,0.04)] sm:p-6"><div className="flex items-start justify-between"><div><p className="text-base font-extrabold text-[#0a2928]">Bu həftənin fokusu</p><p className="mt-1 text-xs text-slate-500">Mentor kabinetini aktivləşdirin</p></div><span className="rounded-lg bg-emerald-50 p-2 text-[#087f70]"><SvgIcon name="trend" size={16} /></span></div><div className="mt-5 flex items-end justify-between"><div><p className="text-3xl font-black text-[#0a2928]">{Math.round((completedSteps / roadmap.length) * 100)}%</p><p className="mt-1 text-xs text-slate-400">İcra vəziyyəti</p></div><p className="text-xs font-bold text-[#087f70]">{completedSteps}/{roadmap.length} tamamlandı</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#087f70] transition-all" style={{ width: `${(completedSteps / roadmap.length) * 100}%` }} /></div><div className="mt-5 space-y-3">{roadmap.map((step) => <div key={step.label} className="flex items-center gap-2.5 text-xs"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${step.done ? 'bg-[#087f70] text-white' : 'border border-slate-200 text-slate-300'}`}>{step.done && <SvgIcon name="check" size={13} />}</span><span className={step.done ? 'text-slate-400 line-through' : 'font-semibold text-slate-600'}>{step.label}</span></div>)}</div></div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_7px_24px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between"><p className="text-sm font-extrabold text-[#0a2928]">Mentee-lərim</p><Link to="/instructor/students" className="text-xs font-bold text-[#087f70]">İdarə et</Link></div>{students.length ? <div className="mt-4 space-y-3">{students.slice(0, 3).map((student) => <div key={student.id} className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-[#087f70]">{String(student.full_name || student.name || 'M').slice(0, 1)}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-700">{student.full_name || student.name}</p><p className="text-[11px] text-slate-400">Aktiv mentorluq</p></div><span className="ml-auto h-2 w-2 rounded-full bg-[#087f70]" /></div>)}</div> : <Empty text="İlk mentee-nizi əlavə etdikdə burada görünəcək." link="/mentorship?tab=mentees" action="Mentorları kəşf et" />}</div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_7px_24px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between"><p className="text-sm font-extrabold text-[#0a2928]">Gözləyən müraciətlər</p><Link to="/instructor/inquiries" className="text-xs font-bold text-[#087f70]">Hamısına bax</Link></div>{inquiries.length ? <div className="mt-4 space-y-3">{inquiries.slice(0, 2).map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-700">{item.name || item.student_name || 'Yeni müraciət'}</p><p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{item.message || item.goal || 'Mentorluq müraciəti göndərilib.'}</p></div>)}</div> : <Empty text="Hazırda cavab gözləyən müraciət yoxdur." link="/instructor/settings" action="Profilinizi paylaşın" />}</div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_7px_24px_rgba(15,23,42,0.04)]"><div className="flex items-center justify-between"><p className="text-sm font-extrabold text-[#0a2928]">Mentor xidmətləri</p><button type="button" onClick={() => setServiceOpen(true)} className="inline-flex items-center gap-1 text-xs font-bold text-[#087f70]"><SvgIcon name="plus" size={14} /> Əlavə et</button></div>{services.length ? <div className="mt-4 space-y-3">{services.map((service) => <div key={service.id} className="flex items-center justify-between rounded-xl bg-emerald-50/70 p-3"><p className="text-xs font-bold text-[#24544e]">{service.title}</p><span className="text-[10px] font-bold text-[#087f70]">Aktiv</span></div>)}</div> : <Empty text="Mentee-lərin sizə müraciət etməsi üçün xidmət yaradın." action="İlk xidməti əlavə et" onClick={() => setServiceOpen(true)} />}</div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-[#f8fbfa] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="text-sm font-extrabold text-[#0a2928]">Mentorluq prosesini idarə edin</p><p className="mt-1 text-xs text-slate-500">Yol xəritəsi, sessiya qeydləri və resurslar mentorluq keyfiyyətini qorumağa kömək edir.</p></div><div className="flex flex-wrap gap-2"><Link to="/instructor/roadmap" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:border-[#087f70]">Yol xəritəsi</Link><Link to="/instructor/tasks" className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:border-[#087f70]">Sessiya qeydləri</Link></div></section>

      <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} mentorName={user?.full_name || 'Mentor'} onBookSuccess={() => toast('Sessiya uğurla planlaşdırıldı', 'success')} />
      {serviceOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/50 p-4" onClick={(event) => event.target === event.currentTarget && setServiceOpen(false)}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-base font-extrabold text-[#0a2928]">Yeni mentor xidməti</h2><button type="button" onClick={() => setServiceOpen(false)} className="text-xl text-slate-400">×</button></div><p className="mt-2 text-xs text-slate-500">Mentee-lərə hansı mövzuda dəstək verirsiniz?</p><input autoFocus value={serviceName} onChange={(event) => setServiceName(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleServiceSave()} placeholder="məsələn, Karyera planlaması" className="mt-5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-[#087f70]"/><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setServiceOpen(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500">Ləğv et</button><button type="button" onClick={handleServiceSave} className="rounded-xl bg-[#087f70] px-4 py-2.5 text-xs font-bold text-white">Xidməti əlavə et</button></div></div></div>}
    </div>
  )
}

function Empty({ text, action, link, onClick }) {
  const content = <><span className="text-xs text-slate-400">{text}</span><span className="mt-3 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#087f70]">{action} <SvgIcon name="arrow" size={13} /></span></>
  return link ? <Link to={link} className="mt-4 block rounded-xl border border-dashed border-slate-200 p-4 text-center transition hover:border-[#087f70]">{content}</Link> : <button type="button" onClick={onClick} className="mt-4 block w-full rounded-xl border border-dashed border-slate-200 p-4 text-center transition hover:border-[#087f70]">{content}</button>
}
