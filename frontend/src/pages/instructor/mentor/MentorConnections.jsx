import { useState } from 'react'
import { Link } from 'react-router-dom'
import useMentorWorkspace from '../../../hooks/useMentorWorkspace'
import { useToast } from '../../../components/common/Toast'
import { EmptyState, Field, inputClass, MentorCard, MentorIcon, MentorModal, MentorPage, MentorPageHeader, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle, StatusPill, menteeName } from '../../../components/mentor/MentorWorkspaceUI'

export default function MentorConnections() {
  const { data, loading, saveAgreement } = useMentorWorkspace()
  const toast = useToast()
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [agreement, setAgreement] = useState({ meeting_cadence: 'Hər 2 həftədən bir, 60 dəqiqə', communication_channel: 'Mentorix mesajları', confidentiality: 'Sessiyada paylaşılan şəxsi məlumatlar tərəflərin razılığı olmadan paylaşılmır.', boundaries: 'Mentor istiqamət verir və rəy bildirir; mentee qərar və icraya görə məsuliyyət daşıyır.', success_definition: '', status: 'draft' })

  function openAgreement(mentee) {
    const current = data.agreements.find((item) => String(item.mentee_id) === String(mentee.id))
    setSelected(mentee)
    setAgreement(current ? { meeting_cadence: current.meeting_cadence || '', communication_channel: current.communication_channel || '', confidentiality: current.confidentiality || '', boundaries: current.boundaries || '', success_definition: current.success_definition || '', status: current.status || 'draft' } : { meeting_cadence: 'Hər 2 həftədən bir, 60 dəqiqə', communication_channel: 'Mentorix mesajları', confidentiality: 'Sessiyada paylaşılan şəxsi məlumatlar tərəflərin razılığı olmadan paylaşılmır.', boundaries: 'Mentor istiqamət verir və rəy bildirir; mentee qərar və icraya görə məsuliyyət daşıyır.', success_definition: '', status: 'draft' })
  }

  async function submitAgreement() {
    setSaving(true)
    try { await saveAgreement({ ...agreement, mentee_id: selected.id }); setSelected(null); toast('Mentorluq razılaşması saxlanıldı', 'success') }
    catch (err) { toast(err?.message || 'Razılaşma saxlanmadı', 'error') }
    finally { setSaving(false) }
  }

  function relationStats(mentee) {
    const goals = data.goals.filter((item) => String(item.mentee_id) === String(mentee.id))
    const sessions = data.sessions.filter((item) => String(item.mentee_id) === String(mentee.id))
    const actions = data.actions.filter((item) => String(item.mentee_id) === String(mentee.id) && item.status !== 'done')
    const agreementItem = data.agreements.find((item) => String(item.mentee_id) === String(mentee.id))
    const progress = goals.length ? Math.round(goals.reduce((sum, item) => sum + Number(item.progress || 0), 0) / goals.length) : 0
    const health = agreementItem && sessions.length && goals.length ? 'Güclü' : agreementItem || goals.length ? 'Qurulur' : 'Başlanğıc'
    return { goals, sessions, actions, agreementItem, progress, health }
  }

  return <MentorPage>
    <MentorPageHeader eyebrow="Əlaqələr" title="Mentee münasibətləri" description="Hər mentee üçün məqsəd, görüş ritmi, razılaşma və açıq öhdəlikləri bir münasibət kartında görün." action={<Link to="/mentorship?tab=mentees" className="inline-flex items-center gap-2 rounded-xl bg-[#087f70] px-4 py-2.5 text-xs font-extrabold text-white"><MentorIcon name="users" size={15} /> Yeni əlaqə</Link>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><MentorCard className="p-4"><p className="text-xs text-slate-500">Aktiv mentee</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{loading ? '—' : data.mentees.length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Razılaşma tamamlanıb</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{data.agreements.filter((x) => x.status === 'accepted').length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Aktiv məqsəd</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{data.goals.filter((x) => x.status === 'active').length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Açıq öhdəlik</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{data.actions.filter((x) => x.status !== 'done').length}</p></MentorCard></div>

    <MentorCard><SectionTitle title="Mentee portfeli" description="Münasibətin sağlamlığını sadəcə sessiya sayı ilə deyil, məqsəd, ritm və öhdəliklərlə qiymətləndirin." />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{!data.mentees.length && !loading && <div className="lg:col-span-2"><EmptyState icon="users" title="Aktiv mentee əlaqəsi yoxdur" text="Uyğun mentee ilə əlaqə qurduqda məqsədlər, görüşlər və razılaşma burada birləşəcək." action="Mentee-ləri kəşf et" link="/mentorship?tab=mentees" /></div>}{data.mentees.map((mentee) => { const stats = relationStats(mentee); return <article key={mentee.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex items-start gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-[#087f70]">{menteeName(mentee, 'M').slice(0, 1)}</div><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-black text-[#0a2928]">{menteeName(mentee)}</h3><p className="mt-1 text-[11px] text-slate-400">Münasibət statusu: <span className="font-bold text-[#087f70]">{stats.health}</span></p></div>{stats.agreementItem ? <StatusPill value={stats.agreementItem.status} /> : <StatusPill value="draft" />}</div><div className="mt-5"><div className="flex justify-between text-[11px]"><span className="font-semibold text-slate-500">Məqsəd tərəqqisi</span><span className="font-black text-[#087f70]">{stats.progress}%</span></div><div className="mt-2"><ProgressBar value={stats.progress} /></div></div><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-base font-black text-[#0a2928]">{stats.goals.length}</p><p className="text-[10px] text-slate-400">Məqsəd</p></div><div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-base font-black text-[#0a2928]">{stats.sessions.length}</p><p className="text-[10px] text-slate-400">Sessiya</p></div><div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-base font-black text-[#0a2928]">{stats.actions.length}</p><p className="text-[10px] text-slate-400">Öhdəlik</p></div></div><div className="mt-4 flex gap-2 border-t border-slate-100 pt-4"><SecondaryButton onClick={() => openAgreement(mentee)} className="flex-1"><MentorIcon name="shield" size={14} /> Razılaşma</SecondaryButton><Link to="/instructor/roadmap" className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#087f70] px-3 py-2.5 text-xs font-extrabold text-white">Yol xəritəsi</Link></div></article>})}</div>
    </MentorCard>

    <MentorCard className="bg-[#f7faf8]"><SectionTitle title="Sağlam mentorluq münasibətinin 4 dayağı" description="Razılaşma anlaşılmazlığı azaldır və tərəflərin məsuliyyətini aydınlaşdırır." /><div className="mt-5 grid gap-3 md:grid-cols-4">{[['Məqsəd','Nəyi dəyişmək istəyirik?'],['Ritm','Nə vaxt və necə görüşürük?'],['Sərhəd','Mentorun rolu harada bitir?'],['Məxfilik','Nə paylaşılır, nə paylaşılmır?']].map(([title,text], i) => <div key={title} className="rounded-xl border border-slate-200 bg-white p-4"><span className="text-[10px] font-black text-[#087f70]">0{i + 1}</span><p className="mt-2 text-xs font-extrabold text-[#0a2928]">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p></div>)}</div></MentorCard>

    <MentorModal open={Boolean(selected)} title="Mentorluq razılaşması" description={`${menteeName(selected)} ilə gözləntiləri və sərhədləri əvvəlcədən razılaşdırın.`} onClose={() => setSelected(null)} footer={<><SecondaryButton onClick={() => setSelected(null)}>Bağla</SecondaryButton><PrimaryButton disabled={saving} onClick={submitAgreement}>Razılaşmanı saxla</PrimaryButton></>}><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Görüş ritmi"><input className={inputClass} value={agreement.meeting_cadence} onChange={(e) => setAgreement({ ...agreement, meeting_cadence: e.target.value })} /></Field><Field label="Əlaqə kanalı"><input className={inputClass} value={agreement.communication_channel} onChange={(e) => setAgreement({ ...agreement, communication_channel: e.target.value })} /></Field></div><Field label="Uğurun tərifi"><textarea rows="3" className={inputClass} value={agreement.success_definition} onChange={(e) => setAgreement({ ...agreement, success_definition: e.target.value })} placeholder="Bu mentorluq münasibəti nə vaxt uğurlu sayılacaq?" /></Field><Field label="Məxfilik"><textarea rows="3" className={inputClass} value={agreement.confidentiality} onChange={(e) => setAgreement({ ...agreement, confidentiality: e.target.value })} /></Field><Field label="Sərhədlər və məsuliyyət"><textarea rows="3" className={inputClass} value={agreement.boundaries} onChange={(e) => setAgreement({ ...agreement, boundaries: e.target.value })} /></Field><Field label="Status"><select className={inputClass} value={agreement.status} onChange={(e) => setAgreement({ ...agreement, status: e.target.value })}><option value="draft">Qaralama</option><option value="shared">Mentee ilə paylaşılıb</option><option value="accepted">Qəbul edilib</option></select></Field></div></MentorModal>
  </MentorPage>
}
