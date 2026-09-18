import { useEffect, useState } from 'react'
import api from '../../../lib/api'
import { useToast } from '../../../components/common/Toast'
import { EmptyState, formatDate, MentorCard, MentorIcon, MentorPage, MentorPageHeader, PrimaryButton, SecondaryButton, SectionTitle, StatusPill } from '../../../components/mentor/MentorWorkspaceUI'

export default function MentorRequests() {
  const toast = useToast()
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState(null)

  async function load() {
    setLoading(true)
    try { const result = await api.get('/instructor/inquiries'); setInquiries(Array.isArray(result?.inquiries) ? result.inquiries : []); setUsage(result?.usage || null) }
    catch (err) { toast(err?.message || 'Müraciətlər yüklənmədi', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function changeStatus(id, status) {
    try { await api.patch(`/mentor/inquiries/${encodeURIComponent(id)}/status`, { status }); setInquiries((items) => items.map((item) => item.id === id ? { ...item, status } : item)); toast(status === 'accepted' ? 'Müraciət qəbul edildi' : 'Müraciət bağlandı', 'success') }
    catch (err) { toast(err?.message || 'Status dəyişmədi', 'error') }
  }

  async function reveal(item) {
    try { const result = await api.post(`/instructor/inquiries/${encodeURIComponent(item.id)}/reveal-contact`, {}); setInquiries((items) => items.map((x) => x.id === item.id ? { ...x, requester_phone: result.phone, phone_masked: result.phone, phone_visible: true, can_reveal_contact: false } : x)) }
    catch (err) { toast(err?.message || 'Əlaqə məlumatı açılmadı', 'error') }
  }

  const pending = inquiries.filter((item) => item.status === 'pending')
  return <MentorPage>
    <MentorPageHeader eyebrow="Yeni əlaqələr" title="Mentorluq müraciətləri" description="Müraciəti qəbul etməzdən əvvəl məqsəd uyğunluğunu, gözləntiləri və mentorluq sərhədlərini qiymətləndirin." />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><MentorCard className="p-4"><p className="text-xs text-slate-500">Yeni müraciət</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{loading ? '—' : pending.length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Qəbul edilən</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{inquiries.filter((x) => x.status === 'accepted').length}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Kontakt limiti</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{usage?.premium ? 'Limitsiz' : `${usage?.contacts_viewed_this_month || 0}/${usage?.monthly_limit || 0}`}</p></MentorCard><MentorCard className="p-4"><p className="text-xs text-slate-500">Cavab faizi</p><p className="mt-3 text-2xl font-black text-[#0a2928]">{inquiries.length ? `${Math.round(inquiries.filter((x) => x.status !== 'pending').length / inquiries.length * 100)}%` : '0%'}</p></MentorCard></div>
    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <MentorCard><SectionTitle title="Müraciət qutusu" description="Ən yeni müraciətlər yuxarıda göstərilir." /><div className="mt-5 space-y-4">{!inquiries.length && !loading && <EmptyState icon="message" title="Yeni müraciət yoxdur" text="Mentor profilinizi tamamlayın və nəticə yönümlü təkliflər yaradın." />}{inquiries.map((item) => <article key={item.id} className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-sm font-black text-[#0a2928]">{item.requester_name}</h3><StatusPill value={item.status} /></div><p className="mt-1 text-[11px] text-slate-400">{formatDate(item.created_at)} · {item.category_name || 'Ümumi mentorluq'} · {item.delivery_format || 'Format seçilməyib'}</p></div><span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-600">{item.student_level || 'Səviyyə qeyd edilməyib'}</span></div><blockquote className="mt-4 rounded-xl bg-[#f7faf8] p-4 text-xs leading-5 text-slate-600">“{item.message || 'Məqsəd haqqında əlavə məlumat yazılmayıb.'}”</blockquote><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] text-slate-400">Əlaqə</p><p className="mt-1 text-xs font-bold text-slate-700">{item.phone_visible ? item.requester_phone : item.phone_masked}</p></div><div className="flex gap-2">{item.can_reveal_contact && <SecondaryButton onClick={() => reveal(item)}>Kontakta bax</SecondaryButton>}{item.status === 'pending' && <><SecondaryButton onClick={() => changeStatus(item.id, 'declined')}>Uyğun deyil</SecondaryButton><PrimaryButton onClick={() => changeStatus(item.id, 'accepted')}>Qəbul et</PrimaryButton></>}</div></div></article>)}</div></MentorCard>
      <MentorCard className="h-fit bg-[#f7faf8]"><SectionTitle title="Uyğunluq yoxlaması" description="Qəbuldan əvvəl bu sualları yoxlayın." /><div className="mt-5 space-y-4">{[['Ekspertiza uyğunluğu','Bu məqsəd mənim real təcrübə sahəmə daxildirmi?'],['Gözlənti uyğunluğu','Mentee mentorluqdan nə gözlədiyini aydın ifadə edibmi?'],['İcra hazırlığı','Mentee sessiyalar arasında addım atmağa hazırdırmı?'],['Sərhəd və risk','Ehtiyac psixoloji, hüquqi və ya tibbi mütəxəssis tələb edirmi?']].map(([title,text], index) => <div key={title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-[#087f70]">0{index + 1}</span><div><p className="text-xs font-extrabold text-[#0a2928]">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{text}</p></div></div>)}</div></MentorCard>
    </div>
  </MentorPage>
}
