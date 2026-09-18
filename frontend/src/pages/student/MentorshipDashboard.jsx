import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../../components/common/Toast'
import { EmptyState, Field, formatDate, inputClass, MentorCard, MentorIcon, MentorModal, MentorPageHeader, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle, StatusPill } from '../../components/mentor/MentorWorkspaceUI'

const EMPTY = { mentors: [], goals: [], sessions: [], actions: [], agreements: [], resources: [], feedback: [] }
const feedbackFields = [
  ['goal_clarity', 'Məqsədlər mənim üçün aydındır'],
  ['session_value', 'Sessiya mənə praktik fayda verdi'],
  ['psychological_safety', 'Fikirlərimi təhlükəsiz paylaşa bildim'],
  ['progress_confidence', 'Növbəti addımlarımı bilirəm'],
]

export default function MentorshipDashboard() {
  const { user } = useAuthStore()
  const toast = useToast()
  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [feedbackForm, setFeedbackForm] = useState({ goal_clarity: 0, session_value: 0, psychological_safety: 0, progress_confidence: 0, comment: '' })
  const [saving, setSaving] = useState(false)
  const firstName = user?.full_name?.trim()?.split(/\s+/)[0] || 'Mentee'

  async function load() {
    setLoading(true)
    try { const result = await api.get('/mentor/mentee-workspace'); setData({ ...EMPTY, ...(result || {}) }) }
    catch (err) { toast(err?.message || 'Mentorluq məlumatları yüklənmədi', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const activeGoal = data.goals.find((item) => item.status === 'active')
  const nextSession = useMemo(() => data.sessions.filter((item) => item.status === 'planned').sort((a, b) => new Date(a.scheduled_at || 0) - new Date(b.scheduled_at || 0))[0], [data.sessions])
  const openActions = data.actions.filter((item) => item.status !== 'done')
  const lastSummary = data.sessions.find((item) => item.status === 'completed' && item.shared_summary)
  const pendingFeedback = data.feedback.filter((item) => item.status === 'pending')
  const mentor = data.mentors[0]

  function openFeedback(item) {
    setFeedback(item)
    setFeedbackForm({ goal_clarity: 0, session_value: 0, psychological_safety: 0, progress_confidence: 0, comment: '' })
  }

  async function submitFeedback() {
    if (feedbackFields.some(([key]) => !feedbackForm[key])) return toast('Bütün göstəriciləri qiymətləndirin', 'error')
    setSaving(true)
    try { await api.post(`/mentor/feedback-requests/${encodeURIComponent(feedback.id)}/respond`, feedbackForm); setFeedback(null); await load(); toast('Rəyiniz mentorla paylaşıldı', 'success') }
    catch (err) { toast(err?.message || 'Rəy göndərilmədi', 'error') }
    finally { setSaving(false) }
  }

  return <div className="min-h-full bg-[#f5f8f7] px-4 py-6 text-slate-800 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <MentorPageHeader eyebrow="Mentorluq" title={`Salam, ${firstName}`} description="Məqsədlərinizi, sessiyaları, mentorunuzla razılaşdırılmış addımları və resursları bir yerdən izləyin." action={<Link to="/mentorship/goals" className="inline-flex items-center gap-2 rounded-xl bg-[#087f70] px-4 py-2.5 text-xs font-extrabold text-white"><MentorIcon name="users" size={15} /> Mentor tap</Link>} />

    {pendingFeedback.length > 0 && <button type="button" onClick={() => openFeedback(pendingFeedback[0])} className="flex w-full items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#087f70]"><MentorIcon name="message" size={18} /></span><div className="flex-1"><p className="text-sm font-black text-[#0a2928]">Mentorunuz qısa refleksiya istəyir</p><p className="mt-1 text-xs text-slate-500">Dörd sual, təxminən bir dəqiqə. Cavabınız mentorluq keyfiyyətini yaxşılaşdırır.</p></div><span className="text-xs font-extrabold text-[#087f70]">Rəy ver →</span></button>}

    <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <MentorCard>{activeGoal ? <><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#087f70]">Aktiv məqsəd</p><h2 className="mt-2 text-xl font-black text-[#0a2928]">{activeGoal.title}</h2><p className="mt-2 text-xs leading-5 text-slate-500">{activeGoal.why_text || activeGoal.success_metric || 'Mentorunuzla razılaşdırılmış inkişaf məqsədi.'}</p></div><span className="text-3xl font-black text-[#087f70]">{activeGoal.progress}%</span></div><div className="mt-6"><ProgressBar value={activeGoal.progress} /></div><div className="mt-5 space-y-2">{(activeGoal.milestones || []).slice(0, 4).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${item.status === 'done' ? 'bg-[#087f70] text-white' : 'border border-slate-200'}`}>{item.status === 'done' && <MentorIcon name="check" size={12} />}</span><p className={`text-xs font-semibold ${item.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-650'}`}>{item.title}</p></div>)}</div></> : <EmptyState icon="target" title="Aktiv məqsədiniz yoxdur" text="Mentorunuzla ilk sessiyada konkret, ölçülə bilən və tarixli məqsəd yaradın." />}</MentorCard>
      <MentorCard><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#087f70]">Növbəti sessiya</p>{nextSession ? <><h2 className="mt-3 text-lg font-black text-[#0a2928]">{nextSession.title}</h2><p className="mt-2 text-xs text-slate-500">{formatDate(nextSession.scheduled_at)} · {nextSession.duration_minutes} dəqiqə</p><div className="mt-5 flex flex-wrap gap-2">{(nextSession.agenda || []).slice(0, 3).map((item) => <span key={item} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold text-slate-600">{item}</span>)}</div></> : <EmptyState icon="calendar" title="Görüş planlaşdırılmayıb" text="Mentorunuz sessiya planlaşdırdıqda burada görünəcək." />}</MentorCard>
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <MentorCard><SectionTitle title="Növbəti addımlar" description="Sessiyalar arasında məsuliyyətinizdə olan öhdəliklər." /><div className="mt-5 space-y-3">{!openActions.length && <EmptyState icon="check" title="Açıq öhdəlik yoxdur" text="Sessiya sonunda razılaşdırılan addımlar burada görünəcək." />}{openActions.slice(0, 5).map((item) => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><span className="mt-0.5 h-4 w-4 rounded border border-slate-300"/><div className="flex-1"><p className="text-xs font-bold text-[#0a2928]">{item.title}</p><p className="mt-1 text-[10px] text-slate-400">{item.owner_type === 'shared' ? 'Mentorla birgə' : item.owner_type === 'mentor' ? 'Mentorun öhdəliyi' : 'Sizin öhdəliyiniz'} · {formatDate(item.due_date)}</p></div><StatusPill value={item.status} /></div>)}</div></MentorCard>
      <MentorCard><SectionTitle title="Son sessiya xülasəsi" description="Mentorunuzun sizinlə paylaşdığı qərarlar və istiqamətlər." /><div className="mt-5">{lastSummary ? <><h3 className="text-sm font-black text-[#0a2928]">{lastSummary.title}</h3><p className="mt-1 text-[11px] text-slate-400">{formatDate(lastSummary.scheduled_at)}</p><blockquote className="mt-4 rounded-xl bg-emerald-50/60 p-4 text-xs leading-6 text-slate-600">{lastSummary.shared_summary}</blockquote></> : <EmptyState icon="note" title="Paylaşılan sessiya qeydi yoxdur" text="Tamamlanan görüşün xülasəsi mentor tərəfindən burada paylaşılacaq." />}</div></MentorCard>
    </div>

    <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr]">
      <MentorCard><SectionTitle title="Mentorunuzla əlaqə" /><div className="mt-5">{mentor ? <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-[#087f70]">{String(mentor.full_name || 'M').slice(0,1)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#0a2928]">{mentor.full_name}</p><p className="mt-1 text-xs text-slate-500">Aktiv mentorluq əlaqəsi</p></div><Link to="/student/direct-chat" className="text-xs font-extrabold text-[#087f70]">Mesaj yaz</Link></div> : <EmptyState icon="users" title="Mentor əlaqəsi yoxdur" text="Məqsədinizə uyğun mentor taparaq inkişaf yolunu başlayın." action="Mentor tap" link="/mentorship/goals" />}</div></MentorCard>
      <MentorCard><SectionTitle title="Mentorunuzun paylaşdığı resurslar" /><div className="mt-5 grid gap-3 sm:grid-cols-2">{!data.resources.length && <div className="sm:col-span-2"><EmptyState icon="book" title="Paylaşılan resurs yoxdur" text="Mentorunuz faydalı materialları paylaşdıqda burada görünəcək." /></div>}{data.resources.slice(0, 4).map((item) => <a key={item.id} href={item.url || '#'} target={item.url ? '_blank' : undefined} rel="noreferrer" className="rounded-xl border border-slate-200 p-4 hover:border-[#087f70]"><span className="text-[#087f70]"><MentorIcon name={item.resource_type === 'link' ? 'link' : 'book'} size={17} /></span><p className="mt-3 text-xs font-black text-[#0a2928]">{item.title}</p><p className="mt-1 text-[10px] text-slate-400">{item.category || item.resource_type}</p></a>)}</div></MentorCard>
    </div>

    <MentorModal open={Boolean(feedback)} title="Mentorluq refleksiyası" description="Dürüst rəyiniz mentorluq prosesinin yaxşılaşdırılması üçündür." onClose={() => setFeedback(null)} footer={<><SecondaryButton onClick={() => setFeedback(null)}>Sonra</SecondaryButton><PrimaryButton disabled={saving} onClick={submitFeedback}>Rəyi göndər</PrimaryButton></>}><div className="space-y-5">{feedbackFields.map(([key,label]) => <Field key={key} label={label}><div className="flex gap-2">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setFeedbackForm({ ...feedbackForm, [key]: value })} className={`h-9 flex-1 rounded-lg text-xs font-black ${feedbackForm[key] === value ? 'bg-[#087f70] text-white' : 'bg-slate-100 text-slate-500'}`}>{value}</button>)}</div></Field>)}<Field label="Əlavə rəy" hint="İstəyə bağlı"><textarea rows="4" className={inputClass} value={feedbackForm.comment} onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })} placeholder="Nə faydalı oldu və nəyi dəyişmək olar?" /></Field></div></MentorModal>
  </div></div>
}
