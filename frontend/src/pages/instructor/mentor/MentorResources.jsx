import { useState } from 'react'
import useMentorWorkspace from '../../../hooks/useMentorWorkspace'
import { useToast } from '../../../components/common/Toast'
import { EmptyState, Field, inputClass, MentorCard, MentorIcon, MentorModal, MentorPage, MentorPageHeader, PrimaryButton, SecondaryButton, SectionTitle, StatusPill } from '../../../components/mentor/MentorWorkspaceUI'

const blank = { title: '', resource_type: 'link', url: '', category: '', visibility: 'private' }
const ethics = [
  { title: 'Məxfilik', text: 'Sessiya məlumatını yalnız əvvəlcədən razılaşdırılmış sərhədlərdə saxlayın və paylaşın.' },
  { title: 'Səlahiyyət sərhədi', text: 'Mentorluğu terapiya, hüquqi, tibbi və ya investisiya məsləhəti kimi təqdim etməyin.' },
  { title: 'Maraq toqquşması', text: 'İşə qəbul, satış və şəxsi fayda ilə bağlı marağı mentee-yə əvvəlcədən açıqlayın.' },
  { title: 'Mentee agentliyi', text: 'Qərarı mentor yox, məlumatlı mentee verir. Mentor düşünməyə və seçimlərə kömək edir.' },
  { title: 'İnklüzivlik', text: 'Fərqli təcrübələrə hörmət edin; stereotip və ayrı-seçkilikdən uzaq olun.' },
  { title: 'Bağlanış', text: 'Əlaqə fayda vermədikdə dürüst refleksiya, yönləndirmə və etik bağlanış təklif edin.' },
]

export default function MentorResources() {
  const { data, loading, createResource, deleteResource } = useMentorWorkspace()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!form.title.trim()) return toast('Resursun adını yazın', 'error')
    setSaving(true)
    try { await createResource(form); setForm(blank); setOpen(false); toast('Resurs kitabxanaya əlavə edildi', 'success') }
    catch (err) { toast(err?.message || 'Resurs əlavə edilmədi', 'error') }
    finally { setSaving(false) }
  }

  async function remove(id) {
    try { await deleteResource(id); toast('Resurs silindi', 'success') }
    catch (err) { toast(err?.message || 'Resurs silinmədi', 'error') }
  }

  return <MentorPage>
    <MentorPageHeader eyebrow="Keyfiyyət və resurslar" title="Resurs kitabxanası və etika" description="Materialları mentee-lərlə məqsədli paylaşın, mentorluq sərhədlərini və təhlükəsiz münasibət prinsiplərini görünən edin." action={<PrimaryButton onClick={() => setOpen(true)}><MentorIcon name="plus" size={15} /> Resurs əlavə et</PrimaryButton>} />
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <MentorCard><SectionTitle title="Mentor resursları" description="Link, məqalə, video, şablon və kitabları mövzuya görə saxlayın." /><div className="mt-5 space-y-3">{!data.resources.length && !loading && <EmptyState icon="book" title="Şəxsi resurs kitabxananız boşdur" text="Sessiyalarda tez-tez tövsiyə etdiyiniz materialları burada saxlayın." action="İlk resursu əlavə et" />}{data.resources.map((item) => <article key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#087f70]"><MentorIcon name={item.resource_type === 'link' ? 'link' : 'book'} size={18} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-[#0a2928]">{item.title}</p><StatusPill value={item.visibility} /></div><p className="mt-1 text-[11px] text-slate-400">{item.category || 'Kateqoriyasız'} · {item.resource_type}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-xs font-bold text-[#087f70] hover:underline">{item.url}</a>}</div><button type="button" aria-label="Resursu sil" onClick={() => remove(item.id)} className="rounded-lg p-2 text-slate-350 hover:bg-rose-50 hover:text-rose-500"><MentorIcon name="trash" size={16} /></button></article>)}</div></MentorCard>
      <MentorCard className="bg-[#f7faf8]"><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-[#087f70]"><MentorIcon name="shield" size={21} /></span><div><h2 className="text-base font-black text-[#0a2928]">Etik qərar kompası</h2><p className="mt-1 text-xs leading-5 text-slate-500">Qərar verməzdən əvvəl dörd sual.</p></div></div><div className="mt-5 space-y-3">{['Bu addım mentee-nin xeyrinədirmi?','Mentee sərbəst və məlumatlı seçim edirmi?','Məxfilik və sərhədlər qorunurmu?','Eyni vəziyyətdə hər mentee-yə ədalətli davranardım?'].map((text, index) => <div key={text} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3"><span className="text-xs font-black text-[#087f70]">0{index + 1}</span><p className="text-xs font-semibold leading-5 text-slate-600">{text}</p></div>)}</div><a href="/mentorship/safety" className="mt-5 inline-flex items-center gap-1 text-xs font-extrabold text-[#087f70]">Təhlükəsizlik qaydalarına bax <MentorIcon name="arrow" size={13} /></a></MentorCard>
    </div>
    <MentorCard><SectionTitle title="Mentor davranış çərçivəsi" description="Bu prinsiplər Mentorix-də etibarlı və məsuliyyətli mentorluğun minimum standartıdır." /><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{ethics.map((item, index) => <div key={item.title} className="rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-black text-[#087f70]">{index + 1}</span><p className="text-xs font-extrabold text-[#0a2928]">{item.title}</p></div><p className="mt-3 text-[11px] leading-5 text-slate-500">{item.text}</p></div>)}</div></MentorCard>
    <MentorCard><SectionTitle title="Mentorluq razılaşmalarının vəziyyəti" description="Hər aktiv əlaqədə görüş ritmi, məxfilik, sərhədlər və uğur tərifi razılaşdırılmalıdır." /><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Qəbul edilmiş</p><p className="mt-2 text-2xl font-black text-[#0a2928]">{data.agreements.filter((x) => x.status === 'accepted').length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Paylaşılan</p><p className="mt-2 text-2xl font-black text-[#0a2928]">{data.agreements.filter((x) => x.status === 'shared').length}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Qaralama</p><p className="mt-2 text-2xl font-black text-[#0a2928]">{data.agreements.filter((x) => x.status === 'draft').length}</p></div></div></MentorCard>
    <MentorModal open={open} title="Resurs əlavə et" description="Materialı şəxsi saxlayın və ya bütün mentee-lərə görünən edin." onClose={() => setOpen(false)} footer={<><SecondaryButton onClick={() => setOpen(false)}>Ləğv et</SecondaryButton><PrimaryButton disabled={saving} onClick={submit}>Əlavə et</PrimaryButton></>}><div className="space-y-4"><Field label="Resursun adı"><input autoFocus className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Növ"><select className={inputClass} value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })}><option value="link">Link</option><option value="article">Məqalə</option><option value="video">Video</option><option value="template">Şablon</option><option value="book">Kitab</option></select></Field><Field label="Görünürlük"><select className={inputClass} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}><option value="private">Yalnız mən</option><option value="mentees">Mentee-lərim</option></select></Field></div><Field label="Kateqoriya"><input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="məsələn, Karyera, Data, Liderlik" /></Field><Field label="URL"><input type="url" className={inputClass} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" /></Field></div></MentorModal>
  </MentorPage>
}
