import { useMemo, useState } from 'react'
import useMentorWorkspace from '../../../hooks/useMentorWorkspace'
import { useToast } from '../../../components/common/Toast'
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
  ProgressBar,
  SecondaryButton,
  SectionTitle,
  StatusPill,
  menteeName,
} from '../../../components/mentor/MentorWorkspaceUI'

const feedbackDimensions = [
  ['goal_clarity', 'Məqsəd aydınlığı'],
  ['session_value', 'Sessiya faydası'],
  ['psychological_safety', 'Psixoloji təhlükəsizlik'],
  ['progress_confidence', 'İrəliləyiş inamı'],
]

export default function MentorOutcomes() {
  const { data, loading, requestFeedback } = useMentorWorkspace()
  const toast = useToast()
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestForm, setRequestForm] = useState({ mentee_id: '', session_id: '' })
  const [saving, setSaving] = useState(false)
  const completedGoals = data.goals.filter((item) => item.status === 'completed')
  const completedSessions = data.sessions.filter((item) => item.status === 'completed')
  const completedActions = data.actions.filter((item) => item.status === 'done')
  const responses = data.feedback.filter((item) => item.status === 'completed')
  const pendingFeedback = data.feedback.filter((item) => item.status === 'pending')
  const actionRate = data.actions.length ? Math.round(completedActions.length / data.actions.length * 100) : 0
  const averageProgress = data.goals.length ? Math.round(data.goals.reduce((sum, item) => sum + Number(item.progress || 0), 0) / data.goals.length) : 0
  const qualityScore = useMemo(() => {
    const values = responses.flatMap((item) => feedbackDimensions.map(([key]) => Number(item[key])).filter(Boolean))
    return values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1) : '—'
  }, [responses])

  async function sendRequest() {
    if (!requestForm.mentee_id || !requestForm.session_id) return toast('Mentee və tamamlanmış sessiya seçin', 'error')
    setSaving(true)
    try {
      await requestFeedback(requestForm)
      setRequestOpen(false)
      setRequestForm({ mentee_id: '', session_id: '' })
      toast('Mentee-yə refleksiya sorğusu göndərildi', 'success')
    } catch (err) { toast(err?.message || 'Sorğu göndərilmədi', 'error') }
    finally { setSaving(false) }
  }

  const selectableSessions = completedSessions.filter((item) => !requestForm.mentee_id || String(item.mentee_id) === String(requestForm.mentee_id))

  return <MentorPage>
    <MentorPageHeader
      eyebrow="Keyfiyyət və nəticə"
      title="Rəylər və mentorluq nəticələri"
      description="Məqsəd tərəqqisi, öhdəlik icrası, sessiya davamlılığı və mentee refleksiyası birlikdə ölçülür."
      action={<PrimaryButton onClick={() => setRequestOpen(true)}><MentorIcon name="message" size={15} /> Rəy istə</PrimaryButton>}
    />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricWithProgress label="Məqsəd tərəqqisi" value={loading ? '—' : `${averageProgress}%`} progress={averageProgress} />
      <MetricWithProgress label="Öhdəlik icrası" value={`${actionRate}%`} progress={actionRate} />
      <MentorCard className="p-4"><p className="text-xs text-slate-500">Keyfiyyət balı</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{qualityScore}<span className="text-sm text-slate-400">/5</span></p><p className="mt-1 text-[11px] text-slate-400">{responses.length} məxfi refleksiya</p></MentorCard>
      <MentorCard className="p-4"><p className="text-xs text-slate-500">Gözləyən rəylər</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{pendingFeedback.length}</p><p className="mt-1 text-[11px] text-slate-400">Mentee cavabı gözlənilir</p></MentorCard>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <MentorCard>
        <SectionTitle title="Mentee üzrə nəticə xəritəsi" description="Münasibətlər müqayisə edilmir; hər mentee-nin öz başlanğıc nöqtəsinə görə tərəqqisi göstərilir." />
        <div className="mt-5 space-y-4">
          {!data.mentees.length && <EmptyState icon="trend" title="Nəticə məlumatı hələ formalaşmayıb" text="Mentee, məqsəd və sessiya əlavə etdikcə göstəricilər burada yaranacaq." />}
          {data.mentees.map((mentee) => {
            const goals = data.goals.filter((item) => String(item.mentee_id) === String(mentee.id))
            const sessions = completedSessions.filter((item) => String(item.mentee_id) === String(mentee.id))
            const actions = data.actions.filter((item) => String(item.mentee_id) === String(mentee.id))
            const progress = goals.length ? Math.round(goals.reduce((sum, item) => sum + Number(item.progress || 0), 0) / goals.length) : 0
            const completion = actions.length ? Math.round(actions.filter((item) => item.status === 'done').length / actions.length * 100) : 0
            const lastSession = sessions[0]
            const waiting = pendingFeedback.some((item) => String(item.mentee_id) === String(mentee.id))
            return <article key={mentee.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-[#087f70]">{menteeName(mentee, 'M').slice(0, 1)}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-[#0a2928]">{menteeName(mentee)}</p><p className="mt-1 text-[11px] text-slate-400">{goals.length} məqsəd · {sessions.length} tamamlanmış sessiya</p></div>
                {waiting ? <StatusPill value="planned" /> : lastSession && <button type="button" onClick={() => { setRequestForm({ mentee_id: mentee.id, session_id: lastSession.id }); setRequestOpen(true) }} className="text-[11px] font-extrabold text-[#087f70]">Rəy istə</button>}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2"><ProgressMetric label="Məqsəd tərəqqisi" value={progress} /><ProgressMetric label="Öhdəlik icrası" value={completion} /></div>
            </article>
          })}
        </div>
      </MentorCard>

      <div className="space-y-6">
        <MentorCard><SectionTitle title="Keyfiyyət dövrü" description="Hər 4–6 həftədə qısa refleksiya aparın." /><div className="mt-5 space-y-4">{[['Məqsəd','Hələ də doğru və aktualdır?'],['Münasibət','Etibar, təhlükəsizlik və gözlənti aydındır?'],['İcra','Növbəti addımlar vaxtında tamamlanır?'],['Nəticə','Bacarıq, əminlik və davranış dəyişir?']].map(([title,text], index) => <div key={title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-black text-[#087f70]">{index + 1}</span><div><p className="text-xs font-extrabold text-[#0a2928]">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p></div></div>)}</div></MentorCard>
        <MentorCard className="bg-[#f7faf8]"><div className="flex gap-3"><span className="text-[#087f70]"><MentorIcon name="shield" size={21} /></span><div><p className="text-sm font-black text-[#0a2928]">Məxfilik prinsipi</p><p className="mt-2 text-xs leading-5 text-slate-500">Şəxsi sessiya qeydləri analitikaya daxil edilmir. Burada yalnız fəaliyyət və mentee tərəfindən verilmiş strukturlaşdırılmış nəticə siqnalları görünür.</p></div></div></MentorCard>
      </div>
    </div>

    <MentorCard>
      <SectionTitle title="Mentee refleksiyaları" description="Rəylər marketinq reytinqi deyil; mentorluq prosesini yaxşılaşdırmaq üçün siqnaldır." />
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {!responses.length && <div className="lg:col-span-2"><EmptyState icon="message" title="Hələ mentee refleksiyası yoxdur" text="Tamamlanmış sessiyadan sonra dörd suallıq qısa rəy göndərin." /></div>}
        {responses.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex justify-between"><p className="text-xs font-extrabold text-[#0a2928]">{menteeName(data.mentees.find((x) => String(x.id) === String(item.mentee_id)))}</p><span className="text-[10px] text-slate-400">{formatDate(item.responded_at)}</span></div><div className="mt-4 grid grid-cols-2 gap-2">{feedbackDimensions.map(([key,label]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">{label}</p><p className="mt-1 text-base font-black text-[#087f70]">{item[key]}/5</p></div>)}</div>{item.comment && <p className="mt-4 border-l-2 border-emerald-300 pl-3 text-xs italic leading-5 text-slate-600">“{item.comment}”</p>}</article>)}
      </div>
    </MentorCard>

    <MentorCard><SectionTitle title="Tamamlanmış nəticələr" description="Mentee ilə birlikdə təsdiqlənmiş inkişaf nailiyyətləri." /><div className="mt-5">{!completedGoals.length ? <EmptyState icon="star" title="Tamamlanmış məqsəd yoxdur" text="Məqsəd 100%-ə çatdıqda onu tamamlanmış kimi qeyd edin və nəticəni mentee ilə refleksiya edin." /> : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{completedGoals.map((goal) => <div key={goal.id} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"><span className="text-[#087f70]"><MentorIcon name="star" size={18} /></span><p className="mt-3 text-sm font-black text-[#0a2928]">{goal.title}</p><p className="mt-2 text-xs leading-5 text-slate-500">{goal.success_metric || 'Uğur ölçüsü qeyd edilməyib.'}</p></div>)}</div>}</div></MentorCard>

    <MentorModal open={requestOpen} title="Mentee refleksiyası istə" description="Sorğu yalnız seçilmiş tamamlanmış sessiyaya bağlanır." onClose={() => setRequestOpen(false)} footer={<><SecondaryButton onClick={() => setRequestOpen(false)}>Ləğv et</SecondaryButton><PrimaryButton disabled={saving} onClick={sendRequest}>Sorğunu göndər</PrimaryButton></>}><div className="space-y-4"><Field label="Mentee"><select className={inputClass} value={requestForm.mentee_id} onChange={(e) => setRequestForm({ mentee_id: e.target.value, session_id: '' })}><option value="">Mentee seçin</option>{data.mentees.map((item) => <option key={item.id} value={item.id}>{menteeName(item)}</option>)}</select></Field><Field label="Tamamlanmış sessiya"><select className={inputClass} value={requestForm.session_id} onChange={(e) => setRequestForm({ ...requestForm, session_id: e.target.value })}><option value="">Sessiya seçin</option>{selectableSessions.map((item) => <option key={item.id} value={item.id}>{item.title} · {formatDate(item.scheduled_at)}</option>)}</select></Field></div></MentorModal>
  </MentorPage>
}

function ProgressMetric({ label, value }) {
  return <div><div className="flex justify-between text-[11px]"><span className="text-slate-500">{label}</span><b className="text-[#087f70]">{value}%</b></div><div className="mt-2"><ProgressBar value={value} /></div></div>
}

function MetricWithProgress({ label, value, progress }) {
  return <MentorCard className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{value}</p><div className="mt-3"><ProgressBar value={progress} /></div></MentorCard>
}
