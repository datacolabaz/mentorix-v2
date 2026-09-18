import { useState } from 'react'
import useMentorWorkspace from '../../../hooks/useMentorWorkspace'
import { useToast } from '../../../components/common/Toast'
import { EmptyState, Field, inputClass, MentorCard, MentorIcon, MentorModal, MentorPage, MentorPageHeader, PrimaryButton, SecondaryButton, SectionTitle, StatusPill } from '../../../components/mentor/MentorWorkspaceUI'

const blank = { title: '', description: '', delivery_format: 'one_to_one', duration_minutes: 60, price_amount: '', active: true }
const labels = { one_to_one: '1-on-1 sessiya', package: 'Mentorluq paketi', group: 'Qrup mentorluğu' }

export default function MentorOffers() {
  const { data, loading, createService, updateService } = useMentorWorkspace()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(blank)
  const [saving, setSaving] = useState(false)
  const active = data.services.filter((item) => item.active)

  async function submit() {
    if (!form.title.trim()) return toast('Təklifin adını yazın', 'error')
    setSaving(true)
    try { await createService({ ...form, price_amount: form.price_amount === '' ? null : Number(form.price_amount) }); setForm(blank); setOpen(false); toast('Mentorluq təklifi yayımlandı', 'success') }
    catch (err) { toast(err?.message || 'Təklif yaradılmadı', 'error') }
    finally { setSaving(false) }
  }

  async function toggle(item) {
    try { await updateService(item.id, { active: !item.active }); toast(item.active ? 'Təklif dayandırıldı' : 'Təklif aktivləşdirildi', 'success') }
    catch (err) { toast(err?.message || 'Status dəyişmədi', 'error') }
  }

  return <MentorPage>
    <MentorPageHeader eyebrow="Təkliflər" title="Mentorluq modelləri və paketlər" description="Sadəcə qiymət kartı deyil: hər təklifin kimə uyğun olduğunu, nəticəsini, formatını və sərhədlərini aydın göstərin." action={<PrimaryButton onClick={() => setOpen(true)}><MentorIcon name="plus" size={15} /> Yeni təklif</PrimaryButton>} />
    <MentorCard className="bg-[#f7faf8]"><SectionTitle title="Təklif dizaynı" description="Mentee xidmət yox, aydın nəticəyə gedən struktur alır." /><div className="mt-5 grid gap-3 md:grid-cols-4">{[['Kim üçün?','Mentee-nin başlanğıc səviyyəsi və ehtiyacı'],['Nəticə nədir?','Müddətin sonunda əldə ediləcək ölçülə bilən nəticə'],['Necə işləyir?','Sessiya ritmi, tapşırıq və feedback formatı'],['Nə daxil deyil?','Etik sərhəd, zəmanət verilməyən nəticələr']].map(([title,text], i) => <div key={title} className="rounded-xl border border-slate-200 bg-white p-4"><span className="text-[10px] font-black text-[#087f70]">0{i + 1}</span><p className="mt-2 text-xs font-extrabold text-[#0a2928]">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p></div>)}</div></MentorCard>
    <div className="grid gap-5 lg:grid-cols-3">{!data.services.length && !loading && <div className="lg:col-span-3"><EmptyState icon="box" title="Mentorluq təklifiniz yoxdur" text="İlk təklifinizi bir nəticə və konkret format ətrafında yaradın." action="Yeni təklif yarat" /></div>}{data.services.map((item) => <MentorCard key={item.id} className="flex flex-col"><div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-emerald-50 p-2.5 text-[#087f70]"><MentorIcon name="box" size={19} /></span><StatusPill value={item.active ? 'active' : 'paused'} /></div><p className="mt-5 text-[10px] font-black uppercase tracking-wider text-[#087f70]">{labels[item.delivery_format] || item.delivery_format}</p><h2 className="mt-2 text-lg font-black text-[#0a2928]">{item.title}</h2><p className="mt-2 min-h-[60px] text-xs leading-5 text-slate-500">{item.description || 'Bu təklif üçün nəticə və proses təsviri əlavə edin.'}</p><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Müddət</p><p className="mt-1 text-sm font-black text-slate-700">{item.duration_minutes} dəq</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Qiymət</p><p className="mt-1 text-sm font-black text-slate-700">{item.price_amount != null ? `${Number(item.price_amount).toFixed(0)} ${item.currency}` : 'Razılaşma ilə'}</p></div></div><button type="button" onClick={() => toggle(item)} className="mt-5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-extrabold text-slate-600 hover:border-[#087f70] hover:text-[#087f70]">{item.active ? 'Təklifi dayandır' : 'Təklifi aktivləşdir'}</button></MentorCard>)}</div>
    <MentorCard><SectionTitle title="Tövsiyə olunan model seçimi" description="Ehtiyaca uyğun format mentee gözləntisini düzgün qurur." /><div className="mt-5 grid gap-4 md:grid-cols-3">{[['1-on-1 diaqnostik sessiya','Bir qərarı dəqiqləşdirmək, istiqamət seçmək və 30 günlük addım planı yaratmaq üçün.','45–75 dəq'],['8–12 həftəlik paket','Davranış dəyişikliyi, bacarıq inkişafı və ölçülən nəticə üçün davamlı proqram.','4–6 sessiya'],['Kiçik qrup mentorluğu','Oxşar məqsədli mentee-lər üçün peer-learning və daha əlçatan qiymət modeli.','4–8 nəfər']].map(([title,text,time]) => <div key={title} className="rounded-xl border border-slate-200 p-4"><p className="text-sm font-black text-[#0a2928]">{title}</p><p className="mt-2 text-xs leading-5 text-slate-500">{text}</p><p className="mt-4 text-[11px] font-extrabold text-[#087f70]">{time}</p></div>)}</div></MentorCard>
    <MentorModal open={open} title="Yeni mentorluq təklifi" description="Təklifi format yox, nəticə üzərindən adlandırın." onClose={() => setOpen(false)} footer={<><SecondaryButton onClick={() => setOpen(false)}>Ləğv et</SecondaryButton><PrimaryButton disabled={saving} onClick={submit}>Təklifi yarat</PrimaryButton></>}><div className="space-y-4"><Field label="Təklifin adı"><input autoFocus className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="məsələn, 8 həftədə Junior Data Analyst yol xəritəsi" /></Field><Field label="Nəticə və kimə uyğundur"><textarea rows="4" className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Proqramın nəticəsini, uyğun mentee profilini və prosesini yazın" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Model"><select className={inputClass} value={form.delivery_format} onChange={(e) => setForm({ ...form, delivery_format: e.target.value })}><option value="one_to_one">1-on-1 sessiya</option><option value="package">Mentorluq paketi</option><option value="group">Qrup mentorluğu</option></select></Field><Field label="Müddət, dəqiqə"><input type="number" min="15" className={inputClass} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></Field></div><Field label="Qiymət, AZN" hint="Boş saxlasanız razılaşma ilə görünəcək"><input type="number" min="0" className={inputClass} value={form.price_amount} onChange={(e) => setForm({ ...form, price_amount: e.target.value })} /></Field></div></MentorModal>
  </MentorPage>
}
