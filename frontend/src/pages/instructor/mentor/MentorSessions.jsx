import { useMemo, useState } from 'react'
import useMentorWorkspace from '../../../hooks/useMentorWorkspace'
import useAuthStore from '../../../hooks/useAuth'
import { useToast } from '../../../components/common/Toast'
import BookingModal from '../../../components/common/BookingModal'
import { EmptyState, Field, formatDate, inputClass, MentorCard, MentorIcon, MentorModal, MentorPage, MentorPageHeader, PrimaryButton, SecondaryButton, SectionTitle, StatusPill, menteeName } from '../../../components/mentor/MentorWorkspaceUI'

const newSessionState = { id: null, title: '', mentee_id: '', goal_id: '', scheduled_at: '', duration_minutes: 60, format: 'online', agenda_text: 'Check-in\nMəqsəd üzrə irəliləyiş\nManeələr və qərarlar\nNövbəti addımlar' }

export default function MentorSessions() {
  const { user } = useAuthStore()
  const { data, loading, createSession, updateSession, createAction } = useMentorWorkspace()
  const toast = useToast()
  const [bookingOpen, setBookingOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState(newSessionState)
  const [notes, setNotes] = useState({ private_notes: '', shared_summary: '', check_in: 3, action: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const upcoming = useMemo(() => data.sessions.filter((item) => item.status === 'planned' && (!item.scheduled_at || new Date(item.scheduled_at) >= now)), [data.sessions])
  const completed = data.sessions.filter((item) => item.status === 'completed')

  async function saveSession() {
    if (!form.title.trim()) return toast('Sessiyanın adını yazın', 'error')
    setSaving(true)
    try {
      const payload = { ...form, scheduled_at: form.scheduled_at || null, agenda: form.agenda_text.split('\n').map((x) => x.trim()).filter(Boolean) }
      if (form.id) await updateSession(form.id, payload)
      else await createSession(payload)
      setForm(newSessionState)
      setCreateOpen(false)
      toast(form.id ? 'Sessiya yeniləndi' : 'Sessiya planlaşdırıldı', 'success')
    } catch (err) { toast(err?.message || 'Sessiya planlaşdırılmadı', 'error') }
    finally { setSaving(false) }
  }

  function openRecord(session) {
    setDetail(session)
    setNotes({ private_notes: session.private_notes || '', shared_summary: session.shared_summary || '', check_in: session.check_in || 3, action: '', due_date: '' })
  }

  function openEdit(session) {
    const stamp = session.scheduled_at ? new Date(session.scheduled_at) : null
    const scheduledAt = stamp && !Number.isNaN(stamp.getTime())
      ? new Date(stamp.getTime() - stamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : ''
    setForm({
      id: session.id,
      title: session.title,
      mentee_id: session.mentee_id || '',
      goal_id: session.goal_id || '',
      scheduled_at: scheduledAt,
      duration_minutes: session.duration_minutes || 60,
      format: session.format || 'online',
      agenda_text: Array.isArray(session.agenda) ? session.agenda.join('\n') : '',
    })
    setCreateOpen(true)
  }

  async function completeSession() {
    setSaving(true)
    try {
      await updateSession(detail.id, { ...notes, status: 'completed' })
      if (notes.action.trim()) await createAction({ title: notes.action, due_date: notes.due_date || null, session_id: detail.id, goal_id: detail.goal_id, mentee_id: detail.mentee_id, owner_type: 'mentee' })
      setDetail(null)
      toast('Sessiya qeydi və növbəti addım saxlanıldı', 'success')
    } catch (err) { toast(err?.message || 'Sessiya qeydi saxlanmadı', 'error') }
    finally { setSaving(false) }
  }

  return <MentorPage>
    <MentorPageHeader eyebrow="Görüşlər" title="Sessiyalar və cədvəl" description="Görüşü yalnız təqvim hadisəsi kimi yox, hazırlıq gündəliyi, söhbət qeydi və növbəti öhdəliklə birlikdə idarə edin." secondary={<SecondaryButton onClick={() => setBookingOpen(true)}><MentorIcon name="calendar" size={15} /> Sürətli rezervasiya</SecondaryButton>} action={<PrimaryButton onClick={() => { setForm(newSessionState); setCreateOpen(true) }}><MentorIcon name="plus" size={15} /> Sessiya planla</PrimaryButton>} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><MentorCard className="p-4"><p className="text-xs text-slate-500">Qarşıdakı sessiya</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{loading ? '—' : upcoming.length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Tamamlanan</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{completed.length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Açıq öhdəlik</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{data.actions.filter((x) => x.status !== 'done').length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Orta check-in</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{completed.filter((x) => x.check_in).length ? (completed.reduce((sum, x) => sum + Number(x.check_in || 0), 0) / completed.filter((x) => x.check_in).length).toFixed(1) : '—'}</p></MentorCard></div>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <MentorCard><SectionTitle title="Qarşıdakı sessiyalar" description="Hər görüşdən əvvəl gündəliyi nəzərdən keçirin və gözlənilən nəticəni dəqiqləşdirin." />
        <div className="mt-5 space-y-3">{!upcoming.length && !loading && <EmptyState icon="calendar" title="Sessiya planlaşdırılmayıb" text="İlk görüş üçün məqsəd, gündəlik və vaxtı əvvəlcədən müəyyənləşdirin." action="Sessiya planla" />}{upcoming.map((session) => { const goal = data.goals.find((item) => String(item.id) === String(session.goal_id)); return <article key={session.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#087f70]"><MentorIcon name="calendar" size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusPill value={session.status} /><span className="text-[10px] text-slate-400">{session.duration_minutes} dəq · {session.format === 'in_person' ? 'Canlı' : 'Onlayn'}</span></div><h3 className="mt-2 text-sm font-black text-[#0a2928]">{session.title}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(session.scheduled_at)} · {menteeName(data.mentees.find((x) => String(x.id) === String(session.mentee_id)))}</p>{goal && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#087f70]"><MentorIcon name="target" size={12} /> {goal.title}</p>}</div><div className="flex flex-col gap-2"><SecondaryButton onClick={() => openRecord(session)}>Sessiyanı aç</SecondaryButton><button type="button" onClick={() => openEdit(session)} className="text-[10px] font-bold text-slate-400 hover:text-[#087f70]">Tarix/gündəlik</button></div></div>{Array.isArray(session.agenda) && session.agenda.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Gündəliyin istiqamətləri</p><div className="mt-2 flex flex-wrap gap-2">{session.agenda.map((item, index) => <span key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">{item}</span>)}</div></div>}</article>})}</div>
      </MentorCard>
      <MentorCard><SectionTitle title="Sessiya ritmi" description="Keyfiyyətli mentorluq görüşdən əvvəl, görüş zamanı və görüşdən sonra davam edir." /><div className="mt-5 space-y-5">{[['1','Hazırlaş','Son məqsəd tərəqqisini və açıq öhdəlikləri yoxlayın.'],['2','Danış','Check-in, əsas mövzu, maneə və mümkün həlli müzakirə edin.'],['3','Razılaşdır','Bir konkret növbəti addım, məsul şəxs və tarix təyin edin.'],['4','Qeyd et','Paylaşılan xülasə ilə şəxsi mentor qeydlərini ayırın.']].map(([n,title,text]) => <div key={n} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#087f70] text-[11px] font-black text-white">{n}</span><div><p className="text-xs font-extrabold text-[#0a2928]">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>)}</div></MentorCard>
    </div>

    <MentorCard><SectionTitle title="Sessiya tarixçəsi" description="Tamamlanmış görüşlərin xülasəsi və qeydə alınmış check-in nəticəsi." /><div className="mt-5">{!completed.length ? <EmptyState icon="note" title="Sessiya tarixçəsi boşdur" text="Sessiyanı tamamladıqda xülasə və öhdəliklər burada görünəcək." /> : <div className="grid gap-3 md:grid-cols-2">{completed.map((session) => <button key={session.id} type="button" onClick={() => openRecord(session)} className="rounded-xl border border-slate-200 p-4 text-left hover:border-[#087f70]"><div className="flex justify-between"><StatusPill value="completed" /><span className="text-xs font-black text-[#087f70]">{session.check_in ? `${session.check_in}/5` : '—'}</span></div><p className="mt-3 text-sm font-black text-[#0a2928]">{session.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{session.shared_summary || 'Paylaşılan xülasə yoxdur.'}</p></button>)}</div>}</div></MentorCard>

    <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} mentorName={user?.full_name || 'Mentor'} onBookSuccess={() => toast('Sessiya rezervasiya edildi', 'success')} />
    <MentorModal open={createOpen} title={form.id ? 'Sessiyanı redaktə et' : 'Mentorluq sessiyası planla'} description="Gündəlik görüşün məqsəddən yayınmasının qarşısını alır." onClose={() => setCreateOpen(false)} footer={<><SecondaryButton onClick={() => setCreateOpen(false)}>Ləğv et</SecondaryButton><PrimaryButton disabled={saving} onClick={saveSession}>{form.id ? 'Yenilə' : 'Planlaşdır'}</PrimaryButton></>}><div className="space-y-4"><Field label="Sessiyanın mövzusu"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="məsələn, Karyera istiqamətinin dəqiqləşdirilməsi" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Mentee"><select className={inputClass} value={form.mentee_id} onChange={(e) => setForm({ ...form, mentee_id: e.target.value, goal_id: '' })}><option value="">Mentee seçilməyib</option>{data.mentees.map((item) => <option key={item.id} value={item.id}>{menteeName(item)}</option>)}</select></Field><Field label="Aid olduğu məqsəd"><select className={inputClass} value={form.goal_id} onChange={(e) => setForm({ ...form, goal_id: e.target.value })}><option value="">Ümumi check-in</option>{data.goals.filter((goal) => !form.mentee_id || String(goal.mentee_id) === String(form.mentee_id)).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Tarix və vaxt"><input type="datetime-local" className={inputClass} value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></Field><Field label="Format"><select className={inputClass} value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}><option value="online">Onlayn</option><option value="in_person">Canlı</option><option value="phone">Telefon</option></select></Field></div><Field label="Gündəlik" hint="Hər sətirdə bir mövzu"><textarea rows="6" className={inputClass} value={form.agenda_text} onChange={(e) => setForm({ ...form, agenda_text: e.target.value })} /></Field></div></MentorModal>
    <MentorModal open={Boolean(detail)} title="Sessiya qeydi" description={detail?.title} onClose={() => setDetail(null)} footer={<><SecondaryButton onClick={() => setDetail(null)}>Bağla</SecondaryButton>{detail?.status !== 'completed' && <PrimaryButton disabled={saving} onClick={completeSession}>Sessiyanı tamamla</PrimaryButton>}</>}><div className="space-y-4"><Field label="Mentee check-in" hint="Sessiyanın sonunda vəziyyət"><div className="flex gap-2">{[1,2,3,4,5].map((n) => <button key={n} type="button" onClick={() => setNotes({ ...notes, check_in: n })} className={`h-9 w-9 rounded-lg text-xs font-black ${notes.check_in === n ? 'bg-[#087f70] text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</button>)}</div></Field><Field label="Paylaşılan xülasə"><textarea rows="4" className={inputClass} value={notes.shared_summary} onChange={(e) => setNotes({ ...notes, shared_summary: e.target.value })} placeholder="Müzakirə edilən əsas məqamlar və qərarlar" /></Field><Field label="Şəxsi mentor qeydi" hint="Mentee ilə paylaşılmır"><textarea rows="4" className={inputClass} value={notes.private_notes} onChange={(e) => setNotes({ ...notes, private_notes: e.target.value })} placeholder="Növbəti görüşdə diqqət ediləcək müşahidələr" /></Field><div className="grid gap-4 sm:grid-cols-[1fr_160px]"><Field label="Növbəti öhdəlik"><input className={inputClass} value={notes.action} onChange={(e) => setNotes({ ...notes, action: e.target.value })} placeholder="Mentee nə edəcək?" /></Field><Field label="Son tarix"><input type="date" className={inputClass} value={notes.due_date} onChange={(e) => setNotes({ ...notes, due_date: e.target.value })} /></Field></div></div></MentorModal>
  </MentorPage>
}
