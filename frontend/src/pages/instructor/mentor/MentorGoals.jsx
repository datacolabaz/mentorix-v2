import { useMemo, useState } from 'react'
import useMentorWorkspace from '../../../hooks/useMentorWorkspace'
import { useToast } from '../../../components/common/Toast'
import { EmptyState, Field, formatDate, inputClass, MentorCard, MentorIcon, MentorModal, MentorPage, MentorPageHeader, PrimaryButton, ProgressBar, SecondaryButton, SectionTitle, StatusPill, menteeName } from '../../../components/mentor/MentorWorkspaceUI'

const emptyGoal = { title: '', mentee_id: '', why_text: '', success_metric: '', target_date: '', progress: 0 }

export default function MentorGoals() {
  const { data, loading, createGoal, updateGoal, createMilestone, updateMilestone } = useMentorWorkspace()
  const toast = useToast()
  const [goalOpen, setGoalOpen] = useState(false)
  const [milestoneGoal, setMilestoneGoal] = useState(null)
  const [form, setForm] = useState(emptyGoal)
  const [milestone, setMilestone] = useState({ title: '', due_date: '' })
  const [saving, setSaving] = useState(false)
  const activeGoals = data.goals.filter((goal) => goal.status === 'active')
  const completedGoals = data.goals.filter((goal) => goal.status === 'completed')
  const overdueActions = data.actions.filter((item) => item.status !== 'done' && item.due_date && new Date(item.due_date) < new Date())
  const overall = useMemo(() => data.goals.length ? Math.round(data.goals.reduce((sum, goal) => sum + Number(goal.progress || 0), 0) / data.goals.length) : 0, [data.goals])

  async function saveGoal() {
    if (!form.title.trim()) return toast('Məqsədin adını yazın', 'error')
    setSaving(true)
    try {
      await createGoal(form)
      setForm(emptyGoal)
      setGoalOpen(false)
      toast('SMART məqsəd yaradıldı', 'success')
    } catch (err) { toast(err?.message || 'Məqsəd yaradılmadı', 'error') }
    finally { setSaving(false) }
  }

  async function saveMilestone() {
    if (!milestone.title.trim()) return toast('Addımın adını yazın', 'error')
    setSaving(true)
    try {
      await createMilestone(milestoneGoal.id, milestone)
      setMilestone({ title: '', due_date: '' })
      setMilestoneGoal(null)
      toast('Yol xəritəsinə addım əlavə edildi', 'success')
    } catch (err) { toast(err?.message || 'Addım əlavə edilmədi', 'error') }
    finally { setSaving(false) }
  }

  async function setProgress(goal, progress) {
    try { await updateGoal(goal.id, { progress, status: progress === 100 ? 'completed' : 'active' }) }
    catch (err) { toast(err?.message || 'Tərəqqi saxlanmadı', 'error') }
  }

  return <MentorPage>
    <MentorPageHeader eyebrow="Məqsəd və inkişaf" title="Məqsədlər və yol xəritəsi" description="Hər mentorluq münasibətini 1–3 ölçülə bilən SMART məqsəd üzərində qurun. Sessiyalar və öhdəliklər bu məqsədlərə bağlanır." action={<PrimaryButton onClick={() => setGoalOpen(true)}><MentorIcon name="plus" size={15} /> Yeni məqsəd</PrimaryButton>} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MentorCard className="p-4"><p className="text-xs text-slate-500">Aktiv məqsədlər</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{loading ? '—' : activeGoals.length}</p></MentorCard>
      <MentorCard className="p-4"><p className="text-xs text-slate-500">Ümumi tərəqqi</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{overall}%</p></MentorCard>
      <MentorCard className="p-4"><p className="text-xs text-slate-500">Tamamlanan</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{completedGoals.length}</p></MentorCard>
      <MentorCard className="p-4"><p className="text-xs text-slate-500">Gecikmiş öhdəlik</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{overdueActions.length}</p></MentorCard>
    </div>

    <MentorCard>
      <SectionTitle title="Aktiv yol xəritələri" description="Məqsədin niyəsini, nəticə ölçüsünü və kiçik mərhələlərini hər sessiyada yeniləyin." />
      <div className="mt-5 space-y-4">
        {!loading && !data.goals.length && <EmptyState icon="target" title="İlk inkişaf məqsədini yaradın" text="Məsələn: 90 gün ərzində portfolio hazırlamaq və üç iş müsahibəsinə müraciət etmək." action="SMART məqsəd yarat" />}
        {data.goals.map((goal) => {
          const mentee = data.mentees.find((item) => String(item.id) === String(goal.mentee_id))
          const done = (goal.milestones || []).filter((item) => item.status === 'done').length
          return <article key={goal.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusPill value={goal.status} /><span className="text-[11px] font-semibold text-slate-400">{menteeName(mentee)}</span></div><h3 className="mt-2 text-base font-black text-[#0a2928]">{goal.title}</h3>{goal.why_text && <p className="mt-1 text-xs leading-5 text-slate-500">{goal.why_text}</p>}</div>
              <div className="shrink-0 text-left sm:text-right"><p className="text-2xl font-black text-[#087f70]">{goal.progress}%</p><p className="text-[10px] text-slate-400">Hədəf: {formatDate(goal.target_date)}</p></div>
            </div>
            <div className="mt-4"><ProgressBar value={goal.progress} /></div>
            {goal.success_metric && <div className="mt-4 rounded-xl bg-[#f4f8f5] p-3"><p className="text-[10px] font-extrabold uppercase tracking-wider text-[#087f70]">Uğur ölçüsü</p><p className="mt-1 text-xs font-semibold text-slate-600">{goal.success_metric}</p></div>}
            <div className="mt-4 space-y-2">
              {(goal.milestones || []).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50"><input type="checkbox" checked={item.status === 'done'} onChange={() => updateMilestone(goal.id, item.id, { status: item.status === 'done' ? 'todo' : 'done' }).catch((err) => toast(err?.message, 'error'))} className="h-4 w-4 rounded border-slate-300 accent-[#087f70]"/><span className={`flex-1 text-xs ${item.status === 'done' ? 'text-slate-400 line-through' : 'font-semibold text-slate-650'}`}>{item.title}</span><span className="text-[10px] text-slate-400">{formatDate(item.due_date, '')}</span></label>)}
              {!(goal.milestones || []).length && <p className="text-xs text-slate-400">Bu məqsəd üçün mərhələ əlavə edilməyib.</p>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={() => { setMilestoneGoal(goal); setMilestone({ title: '', due_date: '' }) }} className="inline-flex items-center gap-1 text-xs font-extrabold text-[#087f70]"><MentorIcon name="plus" size={14} /> Mərhələ əlavə et</button><div className="flex items-center gap-2"><span className="text-[10px] text-slate-400">{done}/{(goal.milestones || []).length} addım</span><select value={goal.progress} onChange={(event) => setProgress(goal, Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600 outline-none"><option value="0">0%</option><option value="25">25%</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option></select></div></div>
          </article>
        })}
      </div>
    </MentorCard>

    <MentorModal open={goalOpen} title="Yeni SMART məqsəd" description="Bir nəticə seçin və onu ölçülə bilən edin." onClose={() => setGoalOpen(false)} footer={<><SecondaryButton onClick={() => setGoalOpen(false)}>Ləğv et</SecondaryButton><PrimaryButton disabled={saving} onClick={saveGoal}>Məqsədi yarat</PrimaryButton></>}>
      <div className="space-y-4"><Field label="Məqsəd"><input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="məsələn, Data analyst portfolio-su hazırlamaq" /></Field><Field label="Mentee"><select className={inputClass} value={form.mentee_id} onChange={(e) => setForm({ ...form, mentee_id: e.target.value })}><option value="">Mentee seçilməyib</option>{data.mentees.map((item) => <option key={item.id} value={item.id}>{menteeName(item)}</option>)}</select></Field><Field label="Bu niyə vacibdir?"><textarea rows="3" className={inputClass} value={form.why_text} onChange={(e) => setForm({ ...form, why_text: e.target.value })} placeholder="Mentee üçün şəxsi və ya peşəkar dəyəri" /></Field><Field label="Uğur necə ölçüləcək?"><input className={inputClass} value={form.success_metric} onChange={(e) => setForm({ ...form, success_metric: e.target.value })} placeholder="məsələn, 3 layihə və 5 müraciət" /></Field><Field label="Hədəf tarixi"><input type="date" className={inputClass} value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} /></Field></div>
    </MentorModal>

    <MentorModal open={Boolean(milestoneGoal)} title="Yol xəritəsinə mərhələ əlavə et" description={milestoneGoal?.title} onClose={() => setMilestoneGoal(null)} footer={<><SecondaryButton onClick={() => setMilestoneGoal(null)}>Ləğv et</SecondaryButton><PrimaryButton disabled={saving} onClick={saveMilestone}>Əlavə et</PrimaryButton></>}><div className="space-y-4"><Field label="Mərhələ"><input autoFocus className={inputClass} value={milestone.title} onChange={(e) => setMilestone({ ...milestone, title: e.target.value })} placeholder="məsələn, Portfolio strukturunu təsdiqlə" /></Field><Field label="Son tarix"><input type="date" className={inputClass} value={milestone.due_date} onChange={(e) => setMilestone({ ...milestone, due_date: e.target.value })} /></Field></div></MentorModal>
  </MentorPage>
}
