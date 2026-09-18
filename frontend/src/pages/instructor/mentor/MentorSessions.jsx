import { useMemo, useState } from 'react'
import useMentorWorkspace from '../../../hooks/useMentorWorkspace'
import useAuthStore from '../../../hooks/useAuth'
import { useToast } from '../../../components/common/Toast'
import BookingModal from '../../../components/common/BookingModal'
import {
  EmptyState,
  Field,
  formatDate,
  inputClass,
  MentorCard,
  MentorIcon,
  MentorModal,
  MentorPage,
  MentorPageHeader,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusPill,
  menteeName,
} from '../../../components/mentor/MentorWorkspaceUI'

const DEFAULT_AGENDA = 'Check-in\nMəqsəd üzrə irəliləyiş\nManeələr və qərarlar\nNövbəti addımlar'
const newSessionState = { id: null, title: '', mentee_id: '', goal_id: '', scheduled_at: '', duration_minutes: 60, format: 'online', agenda_text: DEFAULT_AGENDA }
const emptyNotes = { private_notes: '', shared_summary: '', check_in: 3, action: '', due_date: '' }

function dueDateFromDays(days) {
  const date = new Date()
  date.setDate(date.getDate() + Math.max(0, Number(days) || 0))
  return date.toISOString().slice(0, 10)
}

export default function MentorSessions() {
  const { user } = useAuthStore()
  const { data, loading, createSession, updateSession, analyzeSession, completeSession: finalizeSession } = useMentorWorkspace()
  const toast = useToast()
  const [bookingOpen, setBookingOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState(newSessionState)
  const [notes, setNotes] = useState(emptyNotes)
  const [aiDraft, setAiDraft] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const upcoming = useMemo(() => data.sessions.filter((item) => item.status === 'planned' && (!item.scheduled_at || new Date(item.scheduled_at) >= now)), [data.sessions])
  const completed = data.sessions.filter((item) => item.status === 'completed')

  async function saveSession() {
    if (!form.title.trim()) return toast('Sessiyanın adını yazın', 'error')
    setSaving(true)
    try {
      const payload = { ...form, scheduled_at: form.scheduled_at || null, agenda: form.agenda_text.split('\n').map((item) => item.trim()).filter(Boolean) }
      if (form.id) await updateSession(form.id, payload)
      else await createSession(payload)
      setForm(newSessionState)
      setCreateOpen(false)
      toast(form.id ? 'Sessiya yeniləndi' : 'Sessiya planlaşdırıldı', 'success')
    } catch (err) { toast(err?.message || 'Sessiya saxlanmadı', 'error') }
    finally { setSaving(false) }
  }

  function openRecord(session) {
    setDetail(session)
    setNotes({ private_notes: session.private_notes || '', shared_summary: session.shared_summary || '', check_in: session.check_in || 3, action: '', due_date: '' })
    setAiDraft(null)
  }

  function openEdit(session) {
    const stamp = session.scheduled_at ? new Date(session.scheduled_at) : null
    const scheduledAt = stamp && !Number.isNaN(stamp.getTime()) ? new Date(stamp.getTime() - stamp.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
    setForm({ id: session.id, title: session.title, mentee_id: session.mentee_id || '', goal_id: session.goal_id || '', scheduled_at: scheduledAt, duration_minutes: session.duration_minutes || 60, format: session.format || 'online', agenda_text: Array.isArray(session.agenda) ? session.agenda.join('\n') : '' })
    setCreateOpen(true)
  }

  async function generateAiDraft() {
    if (!notes.private_notes.trim() || notes.private_notes.trim().length < 40) return toast('AI analizi üçün ən azı 40 simvol sessiya qeydi yazın', 'error')
    setAiLoading(true)
    try {
      const result = await analyzeSession(detail.id, { raw_notes: notes.private_notes })
      const draft = result?.draft || {}
      const actionItems = Array.isArray(draft.action_items) ? draft.action_items.map((item, index) => ({ ...item, id: `ai-${index}`, selected: true, due_date: dueDateFromDays(item.due_in_days) })) : []
      setAiDraft({ ...draft, action_items: actionItems, meta: result?.meta })
      setNotes((current) => ({ ...current, shared_summary: draft.summary || current.shared_summary }))
      toast('AI qaralaması hazırdır — paylaşmadan əvvəl yoxlayın', 'success')
    } catch (err) { toast(err?.message || 'AI xülasəsi yaradıla bilmədi', 'error') }
    finally { setAiLoading(false) }
  }

  async function saveCompletion() {
    if (!notes.shared_summary.trim()) return toast('Mentee ilə paylaşılacaq xülasəni yazın və ya AI ilə yaradın', 'error')
    const selectedAiActions = (aiDraft?.action_items || []).filter((item) => item.selected && item.title?.trim()).map((item) => ({ title: item.title.trim(), owner_type: item.owner_type, due_date: item.due_date || null }))
    const manualAction = notes.action.trim() ? [{ title: notes.action.trim(), owner_type: 'mentee', due_date: notes.due_date || null }] : []
    setSaving(true)
    try {
      await finalizeSession(detail.id, {
        private_notes: notes.private_notes,
        shared_summary: notes.shared_summary,
        check_in: notes.check_in,
        action_items: [...selectedAiActions, ...manualAction].slice(0, 10),
      })
      setDetail(null)
      setAiDraft(null)
      toast('Sessiya xülasəsi və seçilmiş tapşırıqlar saxlanıldı', 'success')
    } catch (err) { toast(err?.message || 'Sessiya qeydi saxlanmadı', 'error') }
    finally { setSaving(false) }
  }

  function updateAiAction(id, patch) {
    setAiDraft((current) => ({ ...current, action_items: current.action_items.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  }

  return <MentorPage>
    <MentorPageHeader eyebrow="Görüşlər" title="Sessiyalar və cədvəl" description="Hazırlıq gündəliyi, AI dəstəkli xülasə və icra edilə bilən növbəti addımlarla görüşün tam həyat dövrünü idarə edin." secondary={<SecondaryButton onClick={() => setBookingOpen(true)}><MentorIcon name="calendar" size={15} /> Sürətli rezervasiya</SecondaryButton>} action={<PrimaryButton onClick={() => { setForm(newSessionState); setCreateOpen(true) }}><MentorIcon name="plus" size={15} /> Sessiya planla</PrimaryButton>} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric label="Qarşıdakı sessiya" value={loading ? '—' : upcoming.length} />
      <Metric label="Tamamlanan" value={completed.length} />
      <Metric label="Açıq öhdəlik" value={data.actions.filter((item) => item.status !== 'done').length} />
      <Metric label="Orta check-in" value={completed.filter((item) => item.check_in).length ? (completed.reduce((sum, item) => sum + Number(item.check_in || 0), 0) / completed.filter((item) => item.check_in).length).toFixed(1) : '—'} />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <MentorCard>
        <SectionTitle title="Qarşıdakı sessiyalar" description="Görüşdən əvvəl məqsədi və gündəliyi dəqiqləşdirin." />
        <div className="mt-5 space-y-3">
          {!upcoming.length && !loading && <EmptyState icon="calendar" title="Sessiya planlaşdırılmayıb" text="İlk görüş üçün məqsəd, gündəlik və vaxtı əvvəlcədən müəyyənləşdirin." action="Sessiya planla" onAction={() => { setForm(newSessionState); setCreateOpen(true) }} />}
          {upcoming.map((session) => {
            const goal = data.goals.find((item) => String(item.id) === String(session.goal_id))
            return <article key={session.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#087f70]"><MentorIcon name="calendar" size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><StatusPill value={session.status} /><span className="text-[10px] text-slate-400">{session.duration_minutes} dəq · {session.format === 'in_person' ? 'Canlı' : session.format === 'phone' ? 'Telefon' : 'Onlayn'}</span></div><h3 className="mt-2 text-sm font-black text-[#0a2928]">{session.title}</h3><p className="mt-1 text-xs text-slate-500">{formatDate(session.scheduled_at)} · {menteeName(data.mentees.find((item) => String(item.id) === String(session.mentee_id)))}</p>{goal && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#087f70]"><MentorIcon name="target" size={12} /> {goal.title}</p>}</div><div className="flex flex-col gap-2"><SecondaryButton onClick={() => openRecord(session)}>Sessiyanı aç</SecondaryButton><button type="button" onClick={() => openEdit(session)} className="text-[10px] font-bold text-slate-400 hover:text-[#087f70]">Tarix/gündəlik</button></div></div>
              {Array.isArray(session.agenda) && session.agenda.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Gündəlik</p><div className="mt-2 flex flex-wrap gap-2">{session.agenda.map((item, index) => <span key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">{item}</span>)}</div></div>}
            </article>
          })}
        </div>
      </MentorCard>
      <MentorCard><SectionTitle title="AI dəstəkli qeyd axını" description="AI qərar vermir; qaralama yaradır, mentor yoxlayıb təsdiqləyir." /><div className="mt-5 space-y-5">{[['1','Xam qeydi yaz','Faktları, qərarları və razılaşdırılan addımları qeyd edin.'],['2','AI qaralaması yarat','Sistem paylaşılan xülasə, qərar, risk və tapşırıqları ayırır.'],['3','Yoxla və redaktə et','Yanlış və ya həssas hissələri dəyişin, tapşırıqları seçin.'],['4','Bir dəfə təsdiqlə','Xülasə və seçilmiş tapşırıqlar atomik şəkildə saxlanır.']].map(([number,title,text]) => <div key={number} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#087f70] text-[11px] font-black text-white">{number}</span><div><p className="text-xs font-extrabold text-[#0a2928]">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>)}</div></MentorCard>
    </div>

    <MentorCard><SectionTitle title="Sessiya tarixçəsi" description="Tamamlanmış görüşlərin təsdiqlənmiş xülasələri." /><div className="mt-5">{!completed.length ? <EmptyState icon="note" title="Sessiya tarixçəsi boşdur" text="Sessiyanı tamamladıqda xülasə burada görünəcək." /> : <div className="grid gap-3 md:grid-cols-2">{completed.map((session) => <button key={session.id} type="button" onClick={() => openRecord(session)} className="rounded-xl border border-slate-200 p-4 text-left hover:border-[#087f70]"><div className="flex justify-between"><StatusPill value="completed" /><span className="text-xs font-black text-[#087f70]">{session.check_in ? `${session.check_in}/5` : '—'}</span></div><p className="mt-3 text-sm font-black text-[#0a2928]">{session.title}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{session.shared_summary || 'Paylaşılan xülasə yoxdur.'}</p></button>)}</div>}</div></MentorCard>

    <BookingModal open={bookingOpen} onClose={() => setBookingOpen(false)} mentorName={user?.full_name || 'Mentor'} onBookSuccess={() => toast('Sessiya rezervasiya edildi', 'success')} />
    <SessionFormModal open={createOpen} form={form} setForm={setForm} data={data} saving={saving} onClose={() => setCreateOpen(false)} onSave={saveSession} />
    <SessionNotesModal detail={detail} notes={notes} setNotes={setNotes} aiDraft={aiDraft} aiLoading={aiLoading} saving={saving} onClose={() => { setDetail(null); setAiDraft(null) }} onGenerate={generateAiDraft} onUpdateAction={updateAiAction} onSave={saveCompletion} />
  </MentorPage>
}

function Metric({ label, value }) {
  return <MentorCard className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{value}</p></MentorCard>
}

function SessionFormModal({ open, form, setForm, data, saving, onClose, onSave }) {
  return <MentorModal open={open} title={form.id ? 'Sessiyanı redaktə et' : 'Mentorluq sessiyası planla'} description="Gündəlik görüşün məqsəddən yayınmasının qarşısını alır." onClose={onClose} footer={<><SecondaryButton onClick={onClose}>Ləğv et</SecondaryButton><PrimaryButton disabled={saving} onClick={onSave}>{form.id ? 'Yenilə' : 'Planlaşdır'}</PrimaryButton></>}><div className="space-y-4"><Field label="Sessiyanın mövzusu"><input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Mentee"><select className={inputClass} value={form.mentee_id} onChange={(event) => setForm({ ...form, mentee_id: event.target.value, goal_id: '' })}><option value="">Mentee seçilməyib</option>{data.mentees.map((item) => <option key={item.id} value={item.id}>{menteeName(item)}</option>)}</select></Field><Field label="Aid olduğu məqsəd"><select className={inputClass} value={form.goal_id} onChange={(event) => setForm({ ...form, goal_id: event.target.value })}><option value="">Ümumi check-in</option>{data.goals.filter((goal) => !form.mentee_id || String(goal.mentee_id) === String(form.mentee_id)).map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="Tarix və vaxt"><input type="datetime-local" className={inputClass} value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} /></Field><Field label="Format"><select className={inputClass} value={form.format} onChange={(event) => setForm({ ...form, format: event.target.value })}><option value="online">Onlayn</option><option value="in_person">Canlı</option><option value="phone">Telefon</option></select></Field></div><Field label="Gündəlik" hint="Hər sətirdə bir mövzu"><textarea rows="6" className={inputClass} value={form.agenda_text} onChange={(event) => setForm({ ...form, agenda_text: event.target.value })} /></Field></div></MentorModal>
}

function SessionNotesModal({ detail, notes, setNotes, aiDraft, aiLoading, saving, onClose, onGenerate, onUpdateAction, onSave }) {
  const completed = detail?.status === 'completed'
  return <MentorModal open={Boolean(detail)} title="Sessiya qeydi" description={detail?.title} onClose={onClose} footer={<><SecondaryButton onClick={onClose}>Bağla</SecondaryButton>{!completed && <PrimaryButton disabled={saving || aiLoading} onClick={onSave}>Xülasə və tapşırıqları saxla</PrimaryButton>}</>}>
    <div className="space-y-5">
      <Field label="Mentee check-in" hint="Sessiyanın sonunda vəziyyət"><div className="flex gap-2">{[1,2,3,4,5].map((value) => <button key={value} disabled={completed} type="button" onClick={() => setNotes({ ...notes, check_in: value })} className={`h-9 w-9 rounded-lg text-xs font-black ${notes.check_in === value ? 'bg-[#087f70] text-white' : 'bg-slate-100 text-slate-500'} disabled:cursor-default`}>{value}</button>)}</div></Field>
      <Field label="Xam sessiya qeydi" hint={completed ? 'Yalnız mentor görür' : 'AI bu mətndən qaralama hazırlayır'}><textarea readOnly={completed} rows="7" className={inputClass} value={notes.private_notes} onChange={(event) => setNotes({ ...notes, private_notes: event.target.value })} placeholder="Müzakirə, qərarlar, maneələr və razılaşdırılan addımları yazın..." /></Field>
      {!completed && <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-extrabold text-[#0a2928]">AI ilə strukturlaşdır</p><p className="mt-1 text-[11px] leading-5 text-slate-500">Qeyd AI provayderinə göndərilir. Nəticə yalnız qaralamadır və təsdiqiniz olmadan mentee ilə paylaşılmır. 1 AI generasiya krediti istifadə olunur.</p></div><PrimaryButton disabled={aiLoading} onClick={onGenerate}>{aiLoading ? 'Analiz edilir…' : <><MentorIcon name="star" size={14} /> AI xülasə yarat</>}</PrimaryButton></div></div>}

      {aiDraft && <div className="rounded-2xl border border-emerald-200 p-4"><div className="flex items-center justify-between"><p className="text-xs font-black text-[#087f70]">AI qaralaması</p><span className="text-[10px] text-slate-400">Yoxlama tələb olunur</span></div>{aiDraft.decisions?.length > 0 && <DraftList title="Qərarlar" items={aiDraft.decisions} />}{aiDraft.risks?.length > 0 && <DraftList title="Risk və maneələr" items={aiDraft.risks} />}{aiDraft.action_items?.length > 0 && <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Təklif olunan tapşırıqlar</p><div className="mt-2 space-y-3">{aiDraft.action_items.map((item) => <div key={item.id} className={`rounded-xl border p-3 ${item.selected ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50 opacity-60'}`}><label className="flex items-start gap-2"><input type="checkbox" checked={item.selected} onChange={(event) => onUpdateAction(item.id, { selected: event.target.checked })} className="mt-1 accent-[#087f70]"/><input value={item.title} onChange={(event) => onUpdateAction(item.id, { title: event.target.value })} className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[#0a2928] outline-none" /></label><div className="mt-3 grid grid-cols-2 gap-2"><select value={item.owner_type} onChange={(event) => onUpdateAction(item.id, { owner_type: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]"><option value="mentee">Mentee</option><option value="mentor">Mentor</option><option value="shared">Birgə</option></select><input type="date" value={item.due_date} onChange={(event) => onUpdateAction(item.id, { due_date: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px]" /></div>{item.rationale && <p className="mt-2 text-[10px] leading-4 text-slate-400">{item.rationale}</p>}</div>)}</div></div>}</div>}

      <Field label="Mentee ilə paylaşılacaq xülasə" hint="Göndərilməzdən əvvəl mütləq yoxlayın"><textarea readOnly={completed} rows="5" className={inputClass} value={notes.shared_summary} onChange={(event) => setNotes({ ...notes, shared_summary: event.target.value })} placeholder="AI qaralaması burada görünəcək və ya xülasəni əl ilə yaza bilərsiniz." /></Field>
      {!completed && <div className="grid gap-4 sm:grid-cols-[1fr_160px]"><Field label="Əlavə manual tapşırıq"><input className={inputClass} value={notes.action} onChange={(event) => setNotes({ ...notes, action: event.target.value })} placeholder="AI siyahısından kənar addım" /></Field><Field label="Son tarix"><input type="date" className={inputClass} value={notes.due_date} onChange={(event) => setNotes({ ...notes, due_date: event.target.value })} /></Field></div>}
    </div>
  </MentorModal>
}

function DraftList({ title, items }) {
  return <div className="mt-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p><ul className="mt-2 space-y-1.5">{items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2 text-xs leading-5 text-slate-600"><span className="text-[#087f70]">•</span><span>{item}</span></li>)}</ul></div>
}
